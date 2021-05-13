import { Web3Provider } from "../utils/Web3Provider";
import { Pusher, Condition } from "./index";

export interface PathConfig {
  network: number;
  path: string[];
}

export interface HandlerConfig {
  type: "uniswapArbitration";
  path: PathConfig[];
  amountIn: string;
  condition: (
    networks: Map<number, Web3Provider.Network>
  ) => Promise<Condition.Predicate<string | number>>;
}

export function handler(
  networks: Map<number, Web3Provider.Network>,
  pusher: Pusher,
  { path, amountIn, condition }: HandlerConfig
) {
  return async () => {
    const amountsOut: number[][] = await path.reduce(async (res, config) => {
      const prev = await res;
      const currentAmountIn =
        prev.length === 0 ? amountIn : prev.slice().pop()?.slice().pop() ?? 0;
      const network = networks.get(config.network);
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
    if (!(await (await condition(networks))(amountOut))) return;

    pusher({
      path: path
        .map(({ network, path }) => `${network}:${path.join("-")}`)
        .join(" "),
      assetInNetwork: path[0].network,
      assetIn: path[0]?.path[0],
      amountIn,
      assetOutNetwork: path.slice().pop()?.network ?? path[0].network,
      assetOut: path.slice().pop()?.path.slice().pop() ?? "",
      amountOut,
    });
  };
}
