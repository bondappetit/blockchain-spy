require("dotenv").config();

export default {
  logInterval: 5000,
  alertInterval: 50000,
  blockchain: {
    url: process.env.NODE_URL || '',
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
    {
      contract: "UsdcStableLPLockStaking",
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
    },
    {
      contract: "UsdcGovLPStaking",
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
    },
  ],
  alerts: [],
};
