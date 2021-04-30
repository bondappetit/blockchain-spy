import * as tg from "type-guards";
import { Web3Provider } from "../utils/Web3Provider";
import BN from "bignumber.js";
import { abi as IUniswapV2PairABI } from "@bondappetit/networks/abi/IUniswapV2Pair.json";
import { AbiItem } from "web3-utils";
import NodeRSA from "node-rsa";
import { EventData } from "web3-eth-contract";
import { EventLogger, TemplateEngine } from "../utils";
import { Logger } from "knex";

export namespace Config {
  export const isProtocolBalanceConfig = tg.isOfShape({
    handler: tg.is("protocolBalance"),
    options: tg.isOfShape({
      stableToken: tg.isString,
      collateral: tg.isString,
      imbalancePercentage: tg.isNumber,
    }),
    template: tg.isString,
  });

  export type ProtocolBalanceConfig = tg.FromGuard<
    typeof isProtocolBalanceConfig
  >;

  export const isEthBalanceConfig = tg.isOfShape({
    handler: tg.is("ethBalance"),
    options: tg.isOfShape({
      account: tg.isString,
      min: tg.isNumber,
    }),
    template: tg.isString,
  });

  export type EthBalanceConfig = tg.FromGuard<typeof isEthBalanceConfig>;

  export const isDepositaryUpdatedConfig = tg.isOfShape({
    handler: tg.is("depositaryUpdated"),
    options: tg.isOfShape({
      depositary: tg.isString,
      after: tg.isNumber,
    }),
    template: tg.isString,
  });

  export type DepositaryUpdatedConfig = tg.FromGuard<
    typeof isDepositaryUpdatedConfig
  >;

  export const isUniswapLPBalanceConfig = tg.isOfShape({
    handler: tg.is("uniswapLPBalance"),
    options: tg.isOfShape({
      pair: tg.isArrayOf(tg.isString),
      imbalancePercentage: tg.isNumber,
    }),
    template: tg.isString,
  });

  export type UniswapLPBalanceConfig = tg.FromGuard<
    typeof isUniswapLPBalanceConfig
  >;

  export const isUniswapLpReservesConfig = tg.isOfShape({
    handler: tg.is("uniswapLPReserves"),
    options: tg.isOfShape({
      pair: tg.isArrayOf(tg.isString),
      min: tg.isNumber,
    }),
    template: tg.isString,
  });

  export type UniswapLPReservesConfig = tg.FromGuard<
    typeof isUniswapLpReservesConfig
  >;

  export const isOneInchPriceConfig = tg.isOfShape({
    handler: tg.is("oneInchPrice"),
    options: tg.isOfShape({
      pair: tg.isArrayOf(tg.isString),
      min: tg.isNumber,
      max: tg.isNumber,
    }),
    template: tg.isString,
  });

  export type OneInchPriceConfig = tg.FromGuard<typeof isOneInchPriceConfig>;

  export const isDepositaryUpdatedSignatureControlConfig = tg.isOfShape({
    handler: tg.is("depositaryUpdatedSignatureControl"),
    options: tg.isOfShape({
      depositary: tg.isString,
      event: tg.isString,
      key: tg.isString,
      format: tg.isString,
      encryptionScheme: tg.isString,
      signingScheme: tg.isString,
      signatureEncoding: tg.isString,
    }),
    template: tg.isString,
  });

  export type DepositaryUpdatedSignatureControlConfig = tg.FromGuard<
    typeof isDepositaryUpdatedSignatureControlConfig
  >;

  export const isConfig = tg.isOneOf(
    tg.isOneOf(
      isProtocolBalanceConfig,
      isEthBalanceConfig,
      isDepositaryUpdatedConfig,
      isUniswapLPBalanceConfig
    ),
    tg.isOneOf(
      isUniswapLpReservesConfig,
      isOneInchPriceConfig,
      isDepositaryUpdatedSignatureControlConfig
    )
  );

  export type Config = tg.FromGuard<typeof isConfig>;
}

export interface AlertData {
  [k: string]: string | number | boolean | AlertData;
}

export interface Alert extends AlertData {
  template: string;
}

export interface Pusher {
  (alert: Alert): any;
}

export interface AlertHandler {
  (network: Web3Provider.Network, pusher: Pusher, config: Config.Config): any;
}

export async function protocolBalance(
  network: Web3Provider.Network,
  pusher: Pusher,
  {
    options: { stableToken, collateral, imbalancePercentage },
    template,
  }: Config.ProtocolBalanceConfig
) {
  const stableTokenContract = await network.createContractById(stableToken);
  const collateralContract = await network.createContractById(collateral);

  const totalSupply = await stableTokenContract.methods.totalSupply().call();
  const balance = await collateralContract.methods.balance().call();
  const imbalance = new BN(1).minus(new BN(balance).div(totalSupply));
  if (totalSupply === "0") return null;

  if (imbalance.isLessThanOrEqualTo(imbalancePercentage)) return;

  pusher({
    template,
    imbalance: imbalance.toString(),
    balance,
    totalSupply,
  });
}

export async function ethBalance(
  network: Web3Provider.Network,
  pusher: Pusher,
  { options: { account, min }, template }: Config.EthBalanceConfig
) {
  const balance = await network.web3.eth.getBalance(account);

  if (new BN(balance).div(new BN(10).pow(18)).isGreaterThan(min)) return;

  pusher({
    template,
    account,
    balance,
  });
}

export async function depositaryUpdated(
  network: Web3Provider.Network,
  pusher: Pusher,
  { options: { depositary, after }, template }: Config.DepositaryUpdatedConfig
) {
  const currentBlock = await network.web3.eth.getBlockNumber();
  const fromBlock = currentBlock - after;
  const depositaryContract = network.createContractById(depositary);
  const lastUpdateBlockNumber = await depositaryContract.methods
    .lastUpdateBlockNumber()
    .call();

  if (lastUpdateBlockNumber >= fromBlock) return;

  pusher({
    template,
    depositary: {
      id: depositary,
      address: depositaryContract.options.address,
    },
    fromBlock,
  });
}

export async function uniswapLPBalance(
  network: Web3Provider.Network,
  pusher: Pusher,
  {
    options: { pair, imbalancePercentage },
    template,
  }: Config.UniswapLPBalanceConfig
) {
  const uniswapContract = network.createContractById("UniswapV2Router02");
  const pairAssets = pair.map((assetId) => {
    const asset = network.findAssetById(assetId);
    if (asset === undefined) throw new Error(`Asset "${assetId}" not found`);

    return asset;
  });
  const amountIn = new BN(10).pow(pairAssets[0].decimals).toString();
  const [, amountOut] = await uniswapContract.methods
    .getAmountsOut(
      amountIn,
      pairAssets.map(({ address }) => address)
    )
    .call();
  const imbalance = new BN(1)
    .minus(new BN(amountOut).div(new BN(10).pow(pairAssets[1].decimals)))
    .div(1);

  if (imbalance.isLessThanOrEqualTo(imbalancePercentage)) return;

  pusher({
    template,
    inAsset: {
      symbol: pairAssets[0].symbol,
      address: pairAssets[0].address,
      amount: amountIn,
    },
    outAsset: {
      symbol: pairAssets[1].symbol,
      address: pairAssets[1].address,
      amount: amountOut,
    },
    imbalance: imbalance.toString(),
  });
}

export async function uniswapLPReserves(
  network: Web3Provider.Network,
  pusher: Pusher,
  { options: { pair, min }, template }: Config.UniswapLPReservesConfig
) {
  const uniswapContract = network.createContractById("UniswapV2Factory");
  const pairAssets = pair.map((assetId) => {
    const asset = network.findAssetById(assetId);
    if (asset === undefined) throw new Error(`Asset "${assetId}" not found`);

    return asset;
  });
  const pairAddress = await uniswapContract.methods
    .getPair(pairAssets[0].address, pairAssets[1].address)
    .call();
  if (pairAddress === "0x0000000000000000000000000000000000000000") return null;
  const pairContract = network.createContractWithAbi(
    pairAddress,
    IUniswapV2PairABI as AbiItem[]
  );
  const [token0, token1, { reserve0, reserve1 }] = await Promise.all([
    pairContract.methods.token0().call(),
    pairContract.methods.token1().call(),
    pairContract.methods.getReserves().call(),
  ]);
  const token0Asset = network.findAsset(token0);
  if (token0Asset === undefined) return null;
  const token1Asset = network.findAsset(token1);
  if (token1Asset === undefined) return null;
  const reserve0BN = new BN(reserve0).div(new BN(10).pow(token0Asset.decimals));
  const reserve1BN = new BN(reserve1).div(new BN(10).pow(token1Asset.decimals));

  if (!(reserve0BN.isLessThan(min) || reserve1BN.isLessThan(min))) return;

  pusher({
    pair: {
      token0: {
        address: token0,
        symbol: token0Asset.symbol,
      },
      token1: {
        address: token1,
        symbol: token1Asset.symbol,
      },
      address: pairAddress,
    },
    token0Amount: reserve0,
    token1Amount: reserve1,
    min,
    template,
  });
}

export async function oneInchPrice(
  network: Web3Provider.Network,
  pusher: Pusher,
  { options: { pair, min, max }, template }: Config.OneInchPriceConfig
) {
  const oneInchContract = network.createContractById("IOneSplit");
  const pairAssets = pair.map((assetId) => {
    const asset = network.findAssetById(assetId);
    if (asset === undefined) throw new Error(`Asset "${assetId}" not found`);

    return asset;
  });
  const amountIn = new BN(10).pow(pairAssets[0].decimals).toString();
  try {
    const {
      returnAmount: amountOut,
    } = await oneInchContract.methods
      .getExpectedReturn(
        pairAssets[0].address,
        pairAssets[1].address,
        amountIn,
        1,
        0
      )
      .call();
    const amountOutNormalize = new BN(amountOut).div(
      new BN(10).pow(pairAssets[1].decimals)
    );

    if (
      !(
        amountOutNormalize.isLessThan(min) ||
        amountOutNormalize.isGreaterThan(max)
      )
    )
      return;

    pusher({
      pair: {
        token0: {
          address: pairAssets[0].address,
          symbol: pairAssets[0].symbol,
        },
        token1: {
          address: pairAssets[1].address,
          symbol: pairAssets[1].symbol,
        },
      },
      token0Amount: amountIn,
      token1Amount: amountOutNormalize.toString(),
      min,
      max,
      template,
    });
  } catch (e) {
    console.warn(`OneInch price error: ${e}`);
  }
}

export async function depositaryUpdatedSignatureControlConfig(
  network: Web3Provider.Network,
  pusher: Pusher,
  {
    options: {
      depositary,
      event,
      key,
      format,
      encryptionScheme,
      signingScheme,
      signatureEncoding,
    },
    template,
  }: Config.DepositaryUpdatedSignatureControlConfig
) {
  const rsa = new NodeRSA(
    key,
    format as NodeRSA.Format,
    {
      environment: "node",
      encryptionScheme,
      signingScheme,
    } as NodeRSA.Options
  );
  const contract = network.createContractById(depositary);
  contract.events[event]((err: null | string, event: EventData) => {
    if (err !== null) return;

    const {
      returnValues: {
        proof: { data, signature },
      },
    } = event;
    const isValid = rsa.verify(
      data,
      Buffer.from(signature, signatureEncoding as BufferEncoding)
    );
    console.log(data, signature, isValid);
    if (isValid) return;

    pusher({
      depositary,
      data,
      signature,
      template
    });
  });
}

export interface PresetAlertHandler {
  (): any;
}

function getter(handler: PresetAlertHandler, interval: number) {
  return () => setInterval(handler, interval);
}

export function createAlertHandlers(
  network: Web3Provider.Network,
  logQueue: EventLogger,
  render: TemplateEngine.Render,
  interval: number,
  config: Config.Config[]
) {
  const pusher = (alert: Alert) => logQueue.push(render(alert.template, alert));

  return config.reduce((result: PresetAlertHandler[], config) => {
    if (Config.isProtocolBalanceConfig(config)) {
      return [
        ...result,
        getter(protocolBalance.bind(null, network, pusher, config), interval),
      ];
    }
    if (Config.isEthBalanceConfig(config)) {
      return [
        ...result,
        getter(ethBalance.bind(null, network, pusher, config), interval),
      ];
    }
    if (Config.isDepositaryUpdatedConfig(config)) {
      return [
        ...result,
        getter(depositaryUpdated.bind(null, network, pusher, config), interval),
      ];
    }
    if (Config.isUniswapLPBalanceConfig(config)) {
      return [
        ...result,
        getter(uniswapLPBalance.bind(null, network, pusher, config), interval),
      ];
    }
    if (Config.isUniswapLpReservesConfig(config)) {
      return [
        ...result,
        getter(uniswapLPReserves.bind(null, network, pusher, config), interval),
      ];
    }
    if (Config.isOneInchPriceConfig(config)) {
      return [
        ...result,
        getter(oneInchPrice.bind(null, network, pusher, config), interval),
      ];
    }
    if (Config.isDepositaryUpdatedSignatureControlConfig(config)) {
      return [
        ...result,
        depositaryUpdatedSignatureControlConfig.bind(
          null,
          network,
          pusher,
          config
        ),
      ];
    }
    return result;
  }, []);
}
