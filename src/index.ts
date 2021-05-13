import { resolve } from "path";
import config from "../config";
import { parse } from "ts-command-line-args";
import * as tg from "type-guards";
import knex from "knex";
import {
  Web3Provider,
  Migration,
  TemplateEngine,
  Logger,
  EventListener,
  EventLogger,
} from "./utils";
import * as Models from "./models";
import { createAlertHandlers } from "./alerts/index";
import Mustache from "mustache";
import networks from "@bondappetit/networks";
import Web3 from "web3";

const isConfig = tg.isOfShape({
  logInterval: tg.isNumber,
  alertInterval: tg.isNumber,
  logger: tg.isArrayOf(Logger.Config.isConfig),
  events: EventListener.Config.isConfig,
});
if (!isConfig(config)) throw new Error("Invalid config data");

Mustache.escape = (text: string) => text;

interface Args {
  network: string;
}
const args = parse<Args>({
  network: {
    type: String,
    alias: "n",
    description: "Network name",
    defaultValue: "development",
  },
});

function hasNetwork(networkName: string): networkName is keyof typeof networks {
  return networks.hasOwnProperty(networkName);
}

async function main() {
  if (!hasNetwork(args.network)) {
    throw new Error(`Invalid network "${args.network}"`);
  }
  const currentNetwork = networks[args.network];

  const database = knex({
    client: "sqlite3",
    useNullAsDefault: true,
    connection: {
      filename: resolve(__dirname, "../data/database.db"),
    },
  });
  await Migration.initMigrationTable(database);
  await Migration.migrateAll(database, {
    logQueue: Models.LogQueue.migration,
    cache: Models.Cache.migration,
  });
  const cache = new Models.Cache.CacheService(database);
  const web3map = Web3Provider.createMap(config.blockchain);
  web3map.forEach((network) => {
    const provider = network.web3.currentProvider;
    if (!provider || !(provider instanceof Web3.providers.WebsocketProvider))
      return;

    provider.on("end", () => {
      console.error(
        `ERROR: web3 network "${network.network.networkId}" disconnect`
      );
      process.exit(1);
    });
  });
  const network = web3map.get(currentNetwork.networkId);
  if (!network) throw new Error("Mainnet not connected");
  const web3 = network.web3;

  const templateEngine = new TemplateEngine.FileTemplateLoader(
    TemplateEngine.networkRenderFactory(
      web3map,
      network,
      Mustache.render.bind(Mustache)
    )
  );
  await templateEngine.init({
    ...config.events.reduce(
      (result, { events }) => ({
        ...result,
        ...events.reduce(
          (result, { template }) => ({
            ...result,
            [template]: resolve(__dirname, "views", template),
          }),
          {}
        ),
      }),
      {}
    ),
    ...config.alerts.reduce(
      (result, { template }) => ({
        ...result,
        [template]: resolve(__dirname, "views", template),
      }),
      {}
    ),
  });
  const render = templateEngine.render.bind(templateEngine);
  const eventRender = TemplateEngine.eventRenderFactory(network, render);
  const logger = new Logger.AgregateLog(config.logger);
  const events = new EventListener.Listener(network, config.events);
  const logQueue = new EventLogger(
    Models.LogQueue.logQueueTableFactory(database),
    logger.log.bind(logger)
  );
  const lastProcessedBlock = await cache.get("eventLog.lastBlock");
  const currentBlock = await web3.eth.getBlockNumber();
  if (lastProcessedBlock !== null) {
    const nextBlock = parseInt(lastProcessedBlock, 10) + 1;
    if (nextBlock <= currentBlock) {
      events.pastEventsAll({ from: nextBlock, to: currentBlock }, (config, e) =>
        logQueue.push(eventRender(config.template, e))
      );
    }
  }
  await cache.set("eventLog.lastBlock", currentBlock.toString());
  events.listenAll(async ({ template }, e) => {
    await cache.set("eventLog.lastBlock", e.blockNumber.toString());
    await logQueue.push(eventRender(template, e));
  });

  const alertHandlers = createAlertHandlers(
    web3map,
    logQueue,
    render,
    config.alerts
  );
  setInterval(
    () => Promise.all(alertHandlers.map((handler) => handler())),
    config.alertInterval
  );

  setInterval(logQueue.handle.bind(logQueue), config.logInterval);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
