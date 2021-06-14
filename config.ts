require("dotenv").config();
import * as Alert from "./src/alerts/index";
import networks from "@bondappetit/networks";
import { chainLinkPriceFeedMap } from "./src/utils/PriceFeed";
import BigNumber from "bignumber.js";
import { Web3Provider } from "./src/utils";

namespace AlertCondition {
  export function gteWithGas(
    amountOut: number | string,
    decimals: number | string,
    gas: Array<{ networkId: number; gasLimit: number }>
  ) {
    return async (web3map: Map<number, Web3Provider.Network>) => {
      const fee = await gas.reduce(async (sum, { networkId, gasLimit }) => {
        const network = web3map.get(networkId);
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
      );
    };
  }
}

export default {
  logInterval: 60000,
  alertInterval: 120000,
  blockchain: [
    {
      networkId: networks.main.networkId,
      host: process.env.ETH_NODE ?? "",
    },
    {
      networkId: networks.mainBSC.networkId,
      host: process.env.BSC_NODE ?? "",
    },
  ],
  logger: [
    {
      type: "console",
      options: {},
    },
    {
      type: "telegram",
      options: {
        accessToken: process.env.TELEGRAM_KEY,
        chatId: process.env.TELEGRAM_CHAT,
      },
    },
  ],
  events: [
    {
      contract: "GovernorAlpha",
      events: [
        {
          name: "ProposalCreated",
          template: "events/GovernorAlphaProposalCreated.mustache",
        },
      ],
    },
    {
      contract: "CollateralMarket",
      events: [
        {
          name: "Buy",
          template: "events/CollateralMarketBuy.mustache",
        },
      ],
    },
    {
      contract: "Investment",
      events: [
        {
          name: "Invested",
          template: "events/InvestmentInvested.mustache",
        },
      ],
    },
    {
      contract: "BuybackDepositaryBalanceView",
      events: [
        {
          name: "Buyback",
          template: "events/BuybackDepositaryBalanceViewBuyback.mustache",
        },
      ],
    },
    ...[
      "UsdcStableLPLockStaking",
      "UsdcGovLPStaking",
      "UsdnGovLPStaking",
      "UsdtGovLPStaking",
    ].map((contract) => ({
      contract,
      events: [
        {
          name: "Staked",
          template: "events/StakingStaked.mustache",
        },
        {
          name: "RewardPaid",
          template: "events/StakingRewardPaid.mustache",
        },
        {
          name: "Withdrawn",
          template: "events/StakingWithdrawn.mustache",
        },
      ],
    })),
  ],
  alerts: [
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDC", "BAG", "USDT"],
          },
        ],
        amountIn: `1000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`1050${"0".repeat(6)}`, 6, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDT", "BAG", "USDC"],
          },
        ],
        amountIn: `1000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`1050${"0".repeat(6)}`, 6, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDC", "BAG", "USDT"],
          },
        ],
        amountIn: `10000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`10050${"0".repeat(6)}`, 6, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDT", "BAG", "USDC"],
          },
        ],
        amountIn: `10000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`10050${"0".repeat(6)}`, 6, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDC", "BAG", "USDN"],
          },
        ],
        amountIn: `1000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`1050${"0".repeat(18)}`, 18, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDN", "BAG", "USDC"],
          },
        ],
        amountIn: `1000${"0".repeat(18)}`,
        condition: AlertCondition.gteWithGas(`1050${"0".repeat(6)}`, 6, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDC", "BAG", "USDN"],
          },
        ],
        amountIn: `10000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`10050${"0".repeat(18)}`, 18, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDN", "BAG", "USDC"],
          },
        ],
        amountIn: `10000${"0".repeat(18)}`,
        condition: AlertCondition.gteWithGas(`10050${"0".repeat(6)}`, 6, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDC", "USDap"],
          },
        ],
        amountIn: `1000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`1050${"0".repeat(18)}`, 18, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDap", "USDC"],
          },
        ],
        amountIn: `1000${"0".repeat(18)}`,
        condition: AlertCondition.gteWithGas(`1050${"0".repeat(6)}`, 6, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDC", "USDap"],
          },
        ],
        amountIn: `10000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`10050${"0".repeat(18)}`, 18, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDap", "USDC"],
          },
        ],
        amountIn: `10000${"0".repeat(18)}`,
        condition: AlertCondition.gteWithGas(`10050${"0".repeat(6)}`, 6, [
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.main.networkId,
            path: ["USDC", "BAG"],
          },
          {
            network: networks.mainBSC.networkId,
            path: ["bBAG", "WBNB", "USDT"],
          },
        ],
        amountIn: `1000${"0".repeat(6)}`,
        condition: AlertCondition.gteWithGas(`1050${"0".repeat(18)}`, 18, [
          {
            networkId: networks.main.networkId,
            gasLimit: 258067,
          },
          {
            networkId: networks.mainBSC.networkId,
            gasLimit: 258067,
          },
        ]),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: [
          {
            network: networks.mainBSC.networkId,
            path: ["USDT", "WBNB", "bBAG"],
          },
          {
            network: networks.main.networkId,
            path: ["BAG", "USDC"],
          },
        ],
        amountIn: `1000${"0".repeat(18)}`,
        condition: AlertCondition.gteWithGas(`1050${"0".repeat(6)}`, 6, [
          {
            networkId: networks.mainBSC.networkId,
            gasLimit: 258067,
          },
          { networkId: networks.main.networkId, gasLimit: 258067 },
        ]),
      },
    },
  ] as Alert.Config[],
};
