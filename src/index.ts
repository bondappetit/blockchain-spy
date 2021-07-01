import container from "./container";
import { resolve } from "path";
import config from "./config";
import { Migration, TemplateEngine, EventListener } from "./utils";
import * as Models from "./models";
import Mustache from "mustache";
import { createAlertHandlers } from "./alerts/index";

async function main() {
  const database = container.database();
  await Migration.initMigrationTable(database);
  await Migration.migrateAll(database, {
    logQueue: Models.LogQueue.migration,
    cache: Models.Cache.migration,
  });
  const cache = container.cache();
  const logQueue = container.logQueue();

  await Promise.all(
    config.chain.map(async ({ networkId, events }) => {
      const network = container.network(networkId);
      if (!network) throw new Error(`Network "${networkId}" not connected`);

      const templateEngine = new TemplateEngine.FileTemplateLoader(
        TemplateEngine.networkRenderFactory(
          network,
          Mustache.render.bind(Mustache)
        )
      );
      await templateEngine.init({
        ...events.reduce(
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
      });
      const render = templateEngine.render.bind(templateEngine);
      const eventRender = TemplateEngine.eventRenderFactory(network, render);
      const eventsListener = new EventListener.Listener(network, events);
      const cacheKey = `${networkId}:eventLog.lastBlock`;
      const lastProcessedBlock = await cache.get(cacheKey);
      const currentBlock = await network.web3.eth.getBlockNumber();
      if (lastProcessedBlock !== null) {
        const nextBlock = parseInt(lastProcessedBlock, 10) + 1;
        if (nextBlock <= currentBlock) {
          eventsListener.pastEventsAll(
            { from: nextBlock, to: currentBlock },
            (config, e) => logQueue.push(eventRender(config.template, e))
          );
        }
      }
      await cache.set(cacheKey, currentBlock.toString());
      eventsListener.listenAll(async ({ template }, e) => {
        await cache.set(cacheKey, e.blockNumber.toString());
        await logQueue.push(eventRender(template, e));
      });

      return { network };
    })
  );

  const templateEngine = new TemplateEngine.FileTemplateLoader(
    Mustache.render.bind(Mustache)
  );
  await templateEngine.init({
    ...config.alerts.reduce(
      (result, { template }) => ({
        ...result,
        [template]: resolve(__dirname, "views", template),
      }),
      {}
    ),
  });
  const render = templateEngine.render.bind(templateEngine);
  const alertHandlers = createAlertHandlers(logQueue, render, config.alerts);
  setInterval(
    () => alertHandlers.map((handler) => handler()),
    config.alertInterval
  );

  setInterval(logQueue.handle.bind(logQueue), config.logInterval);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
