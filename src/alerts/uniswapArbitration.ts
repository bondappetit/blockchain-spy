import container from "../container";
import BigNumber from "bignumber.js";
import { Condition, Pusher } from "./index";

export interface PathConfig {
  network: number;
  path: string[];
}

export interface HandlerConfig {
  type: "uniswapArbitration";
  path: PathConfig[];
  amountIn: string;
  condition: Condition.Predicate<string | number>;
}

export function handler(
  pusher: Pusher,
  { path, amountIn, condition }: HandlerConfig
) {
  return async () => {
    const amountsOut: number[][] = await path.reduce(async (res, config) => {
      const prev = await res;
      const currentAmountIn =
        prev.length === 0 ? amountIn : prev.slice().pop()?.slice().pop() ?? 0;
      const network = container.network(config.network);
      if (!network) {
        throw new Error(`Network "${config.network}" not found`);
      }
      const uniswapRouter = network.createContractById("UniswapV2Router02");
      const path = config.path.map((assetId) => {
        const asset = network.findAssetById(assetId);
        if (asset === undefined) {
          throw new Error(`Asset "${assetId}" not found`);
        }

        return asset.address;
      });
      const amountsOut = await uniswapRouter.methods
        .getAmountsOut(currentAmountIn, path)
        .call();

      return [...prev, amountsOut];
    }, Promise.resolve([]) as Promise<number[][]>);
    const amountOut = amountsOut.slice().pop()?.slice().pop() ?? 0;
    if (!(await condition(amountOut))) return;

    const assetIn = container.network(path[0].network)
      ?.findAssetBySymbol(path[0]?.path[0]);
    const assetOut = container.network(path.slice().pop()?.network ?? path[0].network)
      ?.findAssetBySymbol(path.slice().pop()?.path.slice().pop() ?? "");
    const amountInFloat = new BigNumber(amountIn).div(
      new BigNumber(10).pow(assetIn?.decimals ?? 0)
    );
    const amountOutFloat = new BigNumber(amountOut).div(
      new BigNumber(10).pow(assetOut?.decimals ?? 0)
    );

    pusher({
      path: path
        .map(({ network, path }) => `${network}:${path.join("-")}`)
        .join(" "),
      amountIn: `${amountInFloat.toFixed(2)} ${assetIn?.symbol}`,
      amountOut: `${amountOutFloat.toFixed(2)} ${assetOut?.symbol}`,
    });
  };
}
