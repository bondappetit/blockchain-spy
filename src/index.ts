import { resolve } from "path";
import fs from "fs";
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
import NodeRSA from "node-rsa";

Mustache.escape = (text: string) => text;

interface Args {
  config: string;
  network: string;
}
const args = parse<Args>({
  config: {
    type: String,
    alias: "c",
    description: "Path to config file",
    defaultValue: resolve(__dirname, "../config.json"),
  },
  network: {
    type: String,
    alias: "n",
    description: "Network name",
    defaultValue: "development",
  },
});

const isConfig = tg.isOfShape({
  logInterval: tg.isNumber,
  alertInterval: tg.isNumber,
  blockchain: Web3Provider.isConfig,
  logger: tg.isArrayOf(Logger.Config.isConfig),
  events: EventListener.Config.isConfig,
  alerts: tg.isArrayOf(Alerts.Config.isConfig),
});

fs.readFile(args.config, { encoding: "utf8" }, async (err, config) => {
  if (err) throw new Error(`Config "${args.config}" not found`);

  config = JSON.parse(config);
  if (!isConfig(config)) throw new Error("Invalid config data");

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
  const web3 = Web3Provider.create(config.blockchain);
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
});
