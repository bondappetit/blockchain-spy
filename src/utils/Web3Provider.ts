import * as tg from "type-guards";
import Web3 from "web3";
import networks from "@bondappetit/networks";
import { AbiItem } from "web3-utils";

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

    findAssetById(id: string) {
      return id.slice(0, 2) === "0x"
        ? this.findAsset(id)
        : this.findAssetBySymbol(id);
    }

    findContract(address: string) {
      return Object.values(this.network.contracts).find(
        (contract) => address === contract.address
      );
    }

    findContractByName(name: string) {
      return this.network.contracts[name];
    }

    createContract(address: string) {
      const contract = this.findContract(address);
      if (contract === undefined) {
        throw new Error(`Contract "${address}" not found`);
      }

      return new this.web3.eth.Contract(contract.abi, address);
    }

    createContractWithAbi(address: string, abi: AbiItem[]) {
      return new this.web3.eth.Contract(abi, address);
    }

    createContractByName(name: string) {
      const contractInfo = this.findContractByName(name);
      if (contractInfo === undefined) {
        throw new Error(`Contract "${name}" not found`);
      }

      return this.createContract(contractInfo.address);
    }

    createContractById(contractId: string) {
      return contractId.slice(0, 2) === "0x"
        ? this.createContract(contractId)
        : this.createContractByName(contractId);
    }
  }
}
