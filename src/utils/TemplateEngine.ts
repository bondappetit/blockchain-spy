import fs from "fs";
import { Web3Provider } from "./Web3Provider";
import { EventData } from "web3-eth-contract";
import BN from "bignumber.js";

export namespace TemplateEngine {
  export interface Render {
    (template: string, data: any): string;
  }

  export interface EventRender {
    (template: string, event: EventData): string;
  }

  export function networkRenderFactory(
    network: Web3Provider.Network,
    render: Render
  ) {
    return (template: string, data: any) =>
      render(template, {
        amount: () => (text: string, render: any) => {
          const [amount, assetId] = render(text).split(" ");
          const asset =
            network.findAsset(assetId) || network.findAssetBySymbol(assetId);
          if (asset === undefined) return render(text);
          return `${new BN(amount)
            .div(new BN(10).pow(asset.decimals))
            .toString()} ${asset.symbol}`;
        },
        assetSymbol: () => (text: string, render: any) => {
          const assetId = render(text);
          const asset =
            network.findAsset(assetId) || network.findAssetBySymbol(assetId);
          if (asset === undefined) return assetId;

          return asset.symbol;
        },
        network: {
          etherscan: network.network.networkUrl,
        },
        ...data,
      });
  }

  export function eventRenderFactory(
    network: Web3Provider.Network,
    render: Render
  ) {
    return (template: string, event: EventData) =>
      render(template, {
        tx: {
          hash: event.transactionHash,
          block: event.blockNumber,
          view: `${network.network.networkUrl}/tx/${event.transactionHash}`,
        },
        contract: {
          address: event.address,
        },
        e: {
          __name: event.event,
          ...event.returnValues,
        },
      });
  }

  export class FileTemplateLoader {
    protected cache: { [k: string]: string } = {};

    constructor(public readonly templateEngine: Render = templateEngine) {}

    async init(files: { [k: string]: string }) {
      this.cache = await Object.entries(files).reduce(
        async (cache, [k, path]) => ({
          ...(await cache),
          [k]: await fs.promises.readFile(path, "utf8"),
        }),
        Promise.resolve({})
      );
    }

    render(template: string, data: any) {
      const templateString = this.cache[template];
      if (templateString === undefined) {
        throw new Error(`Template "${template}" not found`);
      }

      return this.templateEngine(templateString, data);
    }
  }
}
