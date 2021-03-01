import * as tg from "type-guards";
import { Web3Provider } from "./Web3Provider";
import { EventData } from "web3-eth-contract";

export namespace EventListener {
  export namespace Config {
    export const isEvent = tg.isOfShape({
      name: tg.isString,
      template: tg.isString,
    });

    export type Event = tg.FromGuard<typeof isEvent>;

    export const isContract = tg.isOfShape({
      contract: tg.isString,
      events: tg.isArrayOf(isEvent),
    });

    export type Contract = tg.FromGuard<typeof isContract>;

    export const isConfig = tg.isArrayOf(isContract);

    export type Config = tg.FromGuard<typeof isConfig>;
  }

  export interface Handler {
    (config: Config.Event, event: EventData): any;
  }

  export type BlockInterval = {
    from: number | string;
    to: number | string;
  };

  export class Listener {
    constructor(
      public readonly network: Web3Provider.Network = network,
      public readonly config: Config.Config
    ) {}

    listen(contractId: string, config: Config.Event, handler: Handler) {
      const contract = this.network.createContractById(contractId);
      if (typeof contract.events[config.name] !== "function") {
        throw new Error(
          `Event "${config.name}" not found in contract "${contractId}"`
        );
      }
      contract.events[config.name]((err: string | null, e: EventData) => {
        if (err !== null) return console.error(err);

        handler(config, e);
      });
    }

    listenAll(handler: Handler) {
      this.config.map(({ contract, events }) =>
        events.map((event) => this.listen(contract, event, handler))
      );
    }

    pastEvents(
      contractId: string,
      config: Config.Event,
      { from, to }: BlockInterval,
      handler: Handler
    ) {
      const contract = this.network.createContractById(contractId);

      contract
        .getPastEvents(config.name, {
          fromBlock: from,
          toBlock: to,
        })
        .then((events) => events.forEach((e) => handler(config, e)));
    }

    pastEventsAll(blockInterval: BlockInterval, handler: Handler) {
      this.config.map(({ contract, events }) =>
        events.map((event) =>
          this.pastEvents(contract, event, blockInterval, handler)
        )
      );
    }
  }
}
