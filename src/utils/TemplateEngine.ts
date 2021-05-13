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
    networks: Map<number, Web3Provider.Network>,
    network: Web3Provider.Network,
    render: Render
  ) {
    return (template: string, data: any) =>
      render(template, {
        amount: () => (text: string, render: any) => {
          const [amount, assetId, networkId] = render(text).split(" ");
          if (networkId) {
            network =
              networks.get(parseInt(networkId.toString(), 10)) ?? network;
          }
          const asset =
            network.findAsset(assetId) || network.findAssetBySymbol(assetId);
          if (asset === undefined) return render(text);
          return `${new BN(amount)
            .div(new BN(10).pow(asset.decimals))
            .toString()} ${asset.symbol}`;
        },
        assetSymbol: () => (text: string, render: any) => {
          const [assetId, networkId] = render(text).split(" ");
          if (networkId) {
            network =
              networks.get(parseInt(networkId.toString(), 10)) ?? network;
          }
          const asset =
            network.findAsset(assetId) || network.findAssetBySymbol(assetId);
          if (asset === undefined) return assetId;

          return asset.symbol;
        },
        float: () => (text: string, render: any) => {
          const [amount, decimals] = render(text).split(" ");
          return new BN(amount).div(new BN(10).pow(decimals)).toString();
        },
        contractName: () => (text: string, render: any) => {
          const [contractAddress, networkId] = render(text).split(" ");
          if (networkId) {
            network =
              networks.get(parseInt(networkId.toString(), 10)) ?? network;
          }
          const contract = network.findContract(contractAddress);
          if (contract === undefined) return contractAddress;

          return contract.name;
        },
        network: {
          etherscan: network.network.networkEtherscan,
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
          view: `${network.network.networkEtherscan}/tx/${event.transactionHash}`,
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
    protected cache: Map<string, string> = new Map();

    constructor(public readonly templateEngine: Render = templateEngine) {}

    async init(files: { [k: string]: string }) {
      this.cache = new Map(
        await Promise.all(
          Object.entries(files).map(async ([k, path]) => {
            try {
              await fs.promises.access(path, fs.constants.R_OK);
              const content = await fs.promises.readFile(path, "utf8");

              return [k, content] as [string, string];
            } catch {
              console.log("test");
              throw new Error(`Template "${path}" not found`);
            }
          })
        )
      );
    }

    render(template: string, data: any) {
      const templateString = this.cache.get(template);
      if (!templateString) {
        throw new Error(`Template "${template}" not found`);
      }

      return this.templateEngine(templateString, data);
    }
  }
}
