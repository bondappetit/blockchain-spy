require("dotenv").config();
import networks from "@bondappetit/networks";
import { EventListener } from "../utils/EventListener";
import alerts from "./alerts.config";

export function stakingEvent(contract: string) {
  return {
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
  };
}

export interface ChainConfig {
  networkId: number;
  node: string;
  events: EventListener.Config.Contract[];
}

export default {
  logInterval: 60000,
  alertInterval: 120000,
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
  chain: [
    {
      networkId: networks.main.networkId,
      node: process.env.ETH_NODE ?? "",
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
        ].map(stakingEvent),
      ],
    },
    {
      networkId: networks.mainBSC.networkId,
      node: process.env.BSC_NODE ?? "",
      events: [],
      // events: [...["BnbGovLPStaking"].map(stakingEvent)],
    },
  ] as ChainConfig[],
  alerts,
};
