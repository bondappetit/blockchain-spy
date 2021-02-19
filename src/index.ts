import { resolve } from "path";
import fs from "fs";
import { parse } from "ts-command-line-args";
import * as tg from "type-guards";
import { Web3Provider, Logger } from "./utils";
import Mustache from "mustache";

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
  blockchain: Web3Provider.isConfig,
  logger: Logger.Config.isConfig,
});

fs.readFile(args.config, { encoding: "utf8" }, (err, config) => {
  if (err) throw new Error(`Config "${args.config}" not found`);

  config = JSON.parse(config);
  if (!isConfig(config)) throw new Error("Invalid config data");

  const web3 = Web3Provider.create(config.blockchain);
  const network = new Web3Provider.Network(web3, args.network);
  const logger = new Logger.Logger(network, config.logger);

  logger.listenAll();
});
