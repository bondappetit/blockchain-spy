import { Web3Provider } from "../utils/Web3Provider";
import { Pusher, Condition } from "./index";

export interface HandlerConfig {
  type: "uniswapArbitration";
  path: string[];
  amountIn: string;
  condition: Condition.Predicate<string | number>;
}

export function handler(
  network: Web3Provider.Network,
  pusher: Pusher,
  { path, amountIn, condition }: HandlerConfig
) {
  return async () => {
    const uniswapRouter = network.createContractById("UniswapV2Router02");
    const amountsOut = await uniswapRouter.methods
      .getAmountsOut(
        amountIn,
        path.map((assetId) => {
          const asset = network.findAssetById(assetId);
          if (asset === undefined) {
            throw new Error(`Asset "${assetId}" not found`);
          }

          return asset.address;
        })
      )
      .call();
    const amountOut = amountsOut[amountsOut.length - 1];
    if (!condition(amountOut)) return;

    pusher({
      path: path.join("-"),
      assetIn: path[0],
      amountIn,
      assetOut: path[path.length - 1],
      amountOut,
    });
  };
}
