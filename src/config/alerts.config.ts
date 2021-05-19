import networks from "@bondappetit/networks";
import container from "../container";
import * as Alert from "../alerts/index";
import { chainLinkPriceFeedMap } from "../utils/PriceFeed";
import BigNumber from "bignumber.js";
import dayjs from "dayjs";

function gteWithGas(
  amountOut: number | string,
  decimals: number | string,
  gas: Array<{ networkId: number; gasLimit: number }>
) {
  return async (value: string): Promise<boolean> => {
    const fee = await gas.reduce(async (sum, { networkId, gasLimit }) => {
      const network = container.network(networkId);
      if (!network) return sum;

      const gasPrice = await network.web3.eth.getGasPrice();
      const { priceFloat } = await chainLinkPriceFeedMap[networkId].EthUsd(
        network.web3
      );

      const fee = new BigNumber(gasLimit)
        .multipliedBy(gasPrice)
        .div(new BigNumber(10).pow(18)) // ETH decimals
        .multipliedBy(priceFloat);

      return (await sum).plus(fee);
    }, Promise.resolve(new BigNumber(0)));
    const normalizeFee = new BigNumber(fee).multipliedBy(
      new BigNumber(10).pow(decimals)
    );

    return Alert.Condition.gte(
      new BigNumber(amountOut).plus(normalizeFee).toString()
    )(value);
  };
}

function lag(key: string, minutes: number) {
  return async (): Promise<boolean> => {
    const cache = container.cache();
    const current =
      (await cache.get(key)) ?? dayjs("1970-01-01 00:00:00").toString();
    await cache.set(key, dayjs().toString());

    return dayjs(current).add(minutes, "minutes").isBefore(dayjs());
  };
}

const uniswapArbitration = (
  path: Array<{
    network: number;
    path: Array<{ symbol: string; decimals: number }>;
  }>,
  amountIn: string,
  amountOut: string
): Alert.Config => {
  const firstPath = path[0];
  const lastPath = path[path.length - 1];
  const tokenIn = firstPath.path[0];
  const tokenOut = lastPath.path[lastPath.path.length - 1];
  const pathString = path
    .map(({ path }) => path.map(({ symbol }) => symbol).join("-"))
    .join("-");

  return {
    template: "alerts/uniswapArbitration.mustache",
    handler: {
      type: "uniswapArbitration",
      path: path.map(({ network, path }) => ({
        network,
        path: path.map(({ symbol }) => symbol),
      })),
      amountIn: `${amountIn}${"0".repeat(tokenIn.decimals)}`,
      condition: Alert.Condition.and(
        gteWithGas(
          `${amountOut}${"0".repeat(tokenOut.decimals)}`,
          tokenOut.decimals,
          path.map(({ network }) => ({
            networkId: network,
            gasLimit: 258067,
          }))
        ),
        lag(`alerts:${pathString}:${amountIn}`, 60)
      ),
    },
  };
};

const ethAssets = networks.main.assets;
const bscAssets = networks.mainBSC.assets;

export default [
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDC, ethAssets.Governance, ethAssets.USDT],
      },
    ],
    "1000",
    "1050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDT, ethAssets.Governance, ethAssets.USDC],
      },
    ],
    "1000",
    "1050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDC, ethAssets.Governance, ethAssets.USDT],
      },
    ],
    "10000",
    "10050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDT, ethAssets.Governance, ethAssets.USDC],
      },
    ],
    "10000",
    "10050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDC, ethAssets.Governance, ethAssets.USDN],
      },
    ],
    "1000",
    "1050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDN, ethAssets.Governance, ethAssets.USDC],
      },
    ],
    "1000",
    "1050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDC, ethAssets.Governance, ethAssets.USDN],
      },
    ],
    "10000",
    "10050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDN, ethAssets.Governance, ethAssets.USDC],
      },
    ],
    "10000",
    "10050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDC, ethAssets.Stable],
      },
    ],
    "1000",
    "1050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.Stable, ethAssets.USDC],
      },
    ],
    "1000",
    "1050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDC, ethAssets.Stable],
      },
    ],
    "10000",
    "10050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.Stable, ethAssets.USDC],
      },
    ],
    "10000",
    "10050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.main.networkId,
        path: [ethAssets.USDC, ethAssets.Governance],
      },
      {
        network: networks.mainBSC.networkId,
        path: [bscAssets.bBAG, bscAssets.BNB, bscAssets.USDT],
      },
    ],
    "1000",
    "1050"
  ),
  uniswapArbitration(
    [
      {
        network: networks.mainBSC.networkId,
        path: [bscAssets.USDT, bscAssets.BNB, bscAssets.bBAG],
      },
      {
        network: networks.main.networkId,
        path: [ethAssets.Governance, ethAssets.USDC],
      },
    ],
    "1000",
    "1050"
  ),
] as Alert.Config[];
