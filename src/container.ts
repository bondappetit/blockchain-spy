import { Container, singleton } from "./utils/Container";
import config from "./config";
import knex from "knex";
import path from "path";
import * as Models from "./models";
import { Web3Provider, Logger, EventLogger } from "./utils";
import Web3 from "web3";

class AppContainer extends Container<typeof config> {
  readonly database = singleton(() => {
    return knex({
      client: "sqlite3",
      useNullAsDefault: true,
      connection: {
        filename: path.resolve(__dirname, "../data/database.db"),
      },
    });
  });

  readonly cache = singleton(() => {
    return new Models.Cache.CacheService(this.database());
  });

  readonly logger = singleton(() => {
    return new Logger.AgregateLog(this.parent.logger);
  });

  readonly logQueue = singleton(() => {
    const logger = this.logger();

    return new EventLogger(
      Models.LogQueue.logQueueTableFactory(this.database()),
      logger.log.bind(logger)
    );
  });

  readonly networks = singleton(() => {
    return new Map<number, Web3Provider.Network>(
      this.parent.chain.map(({ networkId, node }) => {
        const network = Web3Provider.create({ networkId, host: node });
        const provider = network.web3.currentProvider;
        if (provider && provider instanceof Web3.providers.WebsocketProvider) {
          provider.on("end", () => {
            console.error(`ERROR: web3 network "${networkId}" disconnect`);
            process.exit(1);
          });
        }

        return [networkId, network];
      })
    );
  });

  readonly network = (chainId: number) => this.networks().get(chainId);
}

export default new AppContainer(config);
