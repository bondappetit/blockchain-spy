import { Web3Provider } from "../utils/Web3Provider";
import * as uniswapArbitration from "./uniswapArbitration";
import { EventLogger, TemplateEngine } from "../utils";
import BigNumber from "bignumber.js";

export namespace Condition {
  export interface Predicate<T> {
    (v: T): boolean;
  }

  export const and = <T>(...predicates: Predicate<T>[]) => (v: any) =>
    predicates.reduce((res, predicate) => res && predicate(v), true);

  export const or = <T>(...predicates: Predicate<T>[]) => (v: any) =>
    predicates.reduce((res, predicate) => res || predicate(v), false);

  export const gt = <T extends string | number>(max: T) => (v: T) =>
    new BigNumber(v).gt(max);

  export const gte = <T extends string | number>(max: T) => (v: T) =>
    new BigNumber(v).gte(max);

  export const lt = <T extends string | number>(max: T) => (v: T) =>
    new BigNumber(v).lt(max);

  export const lte = <T extends string | number>(max: T) => (v: T) =>
    new BigNumber(v).lte(max);
}

export interface Alert {
  [k: string]: string | number | boolean | Alert;
}

export interface Pusher {
  (alert: Alert): any;
}

export interface Config {
  handler: uniswapArbitration.HandlerConfig; 
  template: string;
  def: Alert;
}

export function createAlertHandlers(
  networks: Map<number, Web3Provider.Network>,
  logQueue: EventLogger,
  render: TemplateEngine.Render,
  handlers: Config[]
) {
  const pusher = (template: string, def: Alert) => (alert: Alert) =>
    logQueue.push(render(template, { ...def, ...alert }));

  return handlers.map(({ template, def, handler }) => {
    if (handler.type === "uniswapArbitration") {
      return uniswapArbitration.handler(
        networks,
        pusher(template, def),
        handler
      );
    }

    return () => {};
  });
}
