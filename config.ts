require("dotenv").config();
import * as Alert from "./src/alerts/index";

export default {
  logInterval: 60000,
  alertInterval: 120000,
  blockchain: {
    url: process.env.NODE_URL || "",
  },
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
        path: ["USDC", "BAG", "USDT"],
        amountIn: `1${"0".repeat(6)}`,
        condition: Alert.Condition.or(
          Alert.Condition.gte(`12${"0".repeat(5)}`),
          Alert.Condition.lte(`8${"0".repeat(5)}`)
        ),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: ["USDC", "BAG", "USDN"],
        amountIn: `1${"0".repeat(6)}`,
        condition: Alert.Condition.or(
          Alert.Condition.gte(`12${"0".repeat(5)}`),
          Alert.Condition.lte(`8${"0".repeat(5)}`)
        ),
      },
    },
    {
      template: "alerts/uniswapArbitration.mustache",
      handler: {
        type: "uniswapArbitration",
        path: ["USDC", "USDap"],
        amountIn: `1${"0".repeat(6)}`,
        condition: Alert.Condition.gte(`11${"0".repeat(17)}`),
      },
    },
  ] as Alert.Config[],
};
