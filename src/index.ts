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
import * as Alerts from "./alerts";
import Mustache from "mustache";
import Web3 from "web3";

const isConfig = tg.isOfShape({
  logInterval: tg.isNumber,
  alertInterval: tg.isNumber,
  blockchain: Web3Provider.isConfig,
  logger: tg.isArrayOf(Logger.Config.isConfig),
  events: EventListener.Config.isConfig,
  alerts: tg.isArrayOf(Alerts.Config.isConfig),
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

async function main() {
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
  const web3Provider = Web3Provider.create(config.blockchain);
  const web3 = new Web3(web3Provider);
  web3Provider.on("end", () => process.exit(1));
  const network = new Web3Provider.Network(web3, args.network);
  const templateEngine = new TemplateEngine.FileTemplateLoader(
    TemplateEngine.networkRenderFactory(network, Mustache.render.bind(Mustache))
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

  Alerts.createAlertHandlers(
    network,
    logQueue,
    render,
    config.alertInterval,
    config.alerts
  ).forEach((handler) => handler());

  setInterval(logQueue.handle.bind(logQueue), config.logInterval);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
