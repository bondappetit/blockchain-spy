import * as tg from "type-guards";
import Web3 from "web3";
import { EventData } from "web3-eth-contract";
import Mustache from "mustache";
import BN from "bignumber.js";
import { TelegramClient } from "messaging-api-telegram";
import networks from "@bondappetit/networks";

Mustache.escape = (text: string) => text;

export namespace Web3Provider {
  export const isConfig = tg.isOfShape({
    url: tg.isString,
  });

  export type Config = tg.FromGuard<typeof isConfig>;

  export function create({ url }: Config) {
    return new Web3(url);
  }

  export function isNetwork(network: any): network is keyof typeof networks {
    return typeof network === "string" && networks.hasOwnProperty(network);
  }

  export class Network {
    constructor(
      public readonly web3: Web3 = web3,
      public readonly networkName: string = networkName
    ) {}

    get network() {
      if (!isNetwork(this.networkName)) {
        throw new Error(`Invalid network "${this.networkName}"`);
      }

      return networks[this.networkName];
    }

    findAsset(address: string) {
      return Object.values(this.network.assets).find(
        (contract) => address === contract.address
      );
    }

    findAssetBySymbol(symbol: string) {
      return Object.values(this.network.assets).find(
        (contract) => symbol === contract.symbol
      );
    }

    findContract(address: string) {
      return Object.values(this.network.contracts).find(
        (contract) => address === contract.address
      );
    }

    createContract(address: string) {
      const contract = this.findContract(address);
      if (contract === undefined) {
        throw new Error(`Contract "${address}" not found`);
      }

      return new this.web3.eth.Contract(contract.abi, address);
    }
  }
}

export namespace Logger {
  export namespace Config {
    export const isEvent = tg.isOfShape({
      name: tg.isString,
      format: tg.isString,
    });

    export type Event = tg.FromGuard<typeof isEvent>;

    export const isContract = tg.isOfShape({
      contract: tg.isString,
      events: tg.isArrayOf(isEvent),
    });

    export type Contract = tg.FromGuard<typeof isContract>;

    export const isConsoleLog = tg.isOfShape({
      type: tg.is("console"),
      options: tg.isOfShape({}),
    });

    export const isTelegramLogOptions = tg.isOfShape({
      accessToken: tg.isString,
      chatId: tg.isString,
    });

    export type TelegramLogOptions = tg.FromGuard<typeof isTelegramLogOptions>;

    export const isTelegramLog = tg.isOfShape({
      type: tg.is("telegram"),
      options: isTelegramLogOptions,
    });

    export const isOut = tg.isOneOf(isConsoleLog, isTelegramLog);

    export const isConfig = tg.isOfShape({
      out: tg.isArrayOf(isOut),
      listen: tg.isArrayOf(isContract),
    });

    export type Config = tg.FromGuard<typeof isConfig>;
  }

  export const outFactory = {
    _cache: {} as any,
    console: (options: any) => console.log,
    telegram: ({ accessToken, chatId }: Config.TelegramLogOptions) => async (
      msg: string
    ) => {
      try {
        const telegram = new TelegramClient({ accessToken });
        await telegram.sendMessage(chatId, msg);
      } catch (err) {
        console.error(`Telegram out error: ${err}`);
      }
    },
  };

  export function isOut(type: string): type is keyof typeof outFactory {
    return outFactory.hasOwnProperty(type);
  }

  export class Logger {
    constructor(
      public readonly network: Web3Provider.Network = network,
      public readonly config: Config.Config
    ) {}

    render(template: string, event: EventData) {
      return Mustache.render(template, {
        amount: () => (text: string, render: any) => {
          const [amount, assetId] = render(text).split(" ");
          const asset =
            this.network.findAsset(assetId) ||
            this.network.findAssetBySymbol(assetId);
          if (asset === undefined) return render(text);
          return `${new BN(amount)
            .div(new BN(10).pow(asset.decimals))
            .toString()} ${asset.symbol}`;
        },
        assetSymbol: () => (text: string, render: any) => {
          const assetId = render(text);
          const asset =
            this.network.findAsset(assetId) ||
            this.network.findAssetBySymbol(assetId);
          if (asset === undefined) return assetId;

          return asset.symbol;
        },
        tx: {
          hash: event.transactionHash,
          view: `${this.network.network.networkUrl}/tx/${event.transactionHash}`,
        },
        block: event.blockNumber,
        contract: {
          address: event.address,
        },
        e: {
          __name: event.event,
          ...event.returnValues,
        },
      });
    }

    log(msg: string) {
      this.config.out.forEach(({ type, options }) => {
        if (!isOut(type)) return;

        outFactory[type](options)(msg);
      });
    }

    listen(contractAddress: string, { name, format }: Config.Event) {
      const contract = this.network.createContract(contractAddress);
      if (typeof contract.events[name] !== "function") {
        throw new Error(
          `Event "${name}" not found in contract "${contractAddress}"`
        );
      }
      contract.events[name]((err: string | null, e: EventData) => {
        if (err !== null) return console.error(err);

        this.log(this.render(format, e));
      });
    }

    listenAll() {
      this.config.listen.map(({ contract, events }) =>
        events.map((event) => this.listen(contract, event))
      );
    }
  }
}
