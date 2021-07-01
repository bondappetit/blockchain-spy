import Web3 from "web3";
import networks from "@bondappetit/networks";
import { AbiItem } from "web3-utils";

export namespace Web3Provider {
  export interface Config {
    networkId: string | number;
    host: string;
  }

  export function create({ networkId, host }: Config) {
    const network = Object.values(networks).find(
      (network) => network.networkId === parseInt(networkId.toString(), 10)
    );
    if (!network) {
      throw new Error(`Invalid network "${networkId}"`);
    }

    return new Network(new Web3(host), network);
  }

  export function createMap(networks: Config[]) {
    return new Map(
      networks
        .filter((network) => network.host !== "")
        .map((network) => [
          parseInt(network.networkId.toString(), 10),
          create(network),
        ])
    );
  }

  export class Network {
    constructor(
      public readonly web3: Web3 = web3,
      public readonly network: typeof networks.main = network
    ) {}

    findAsset(address: string) {
      return Object.values(this.network.assets).find(
        (contract) => address.toLowerCase() === contract.address.toLowerCase()
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
        (contract) => address.toLowerCase() === contract.address.toLowerCase()
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
