import networks from "@bondappetit/networks";
import BigNumber from "bignumber.js";
import Web3 from "web3";

function chainLinkPriceFeed(oracleAddress: string, decimals: number) {
  return async (web3: Web3) => {
    const contract = new web3.eth.Contract(
      [
        {
          inputs: [],
          name: "latestRoundData",
          outputs: [
            { internalType: "uint80", name: "roundId", type: "uint80" },
            { internalType: "int256", name: "answer", type: "int256" },
            { internalType: "uint256", name: "startedAt", type: "uint256" },
            { internalType: "uint256", name: "updatedAt", type: "uint256" },
            { internalType: "uint80", name: "answeredInRound", type: "uint80" },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      oracleAddress
    );
    const { answer } = await contract.methods.latestRoundData().call();

    return {
      decimals,
      price: answer,
      priceFloat: new BigNumber(answer)
        .div(new BigNumber(10).pow(decimals))
        .toString(10),
    };
  };
}

export const chainLinkPriceFeedMap = {
  [networks.main.networkId]: {
    EthUsd: chainLinkPriceFeed("0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419", 8),
  },
  [networks.mainBSC.networkId]: {
    EthUsd: chainLinkPriceFeed("0x0567f2323251f0aab15c8dfb1967e4e8a7d42aee", 8),
  },
};
