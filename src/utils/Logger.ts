import * as tg from "type-guards";
import { TelegramClient } from "messaging-api-telegram";
import { ParseMode } from "messaging-api-telegram/dist/TelegramTypes";

export namespace Logger {
  export namespace Config {
    export const isConsoleLog = tg.isOfShape({
      type: tg.is("console"),
      options: tg.isOfShape({}),
    });

    export const isTelegramLogOptions = tg.isOfShape({
      accessToken: tg.isString,
      chatId: tg.isString,
    });

    export type TelegramLogOptions = tg.FromGuard<typeof isTelegramLogOptions>;

    export const isTelegramLog = tg.isOfShape({
      type: tg.is("telegram"),
      options: isTelegramLogOptions,
    });

    export const isConfig = tg.isOneOf(isConsoleLog, isTelegramLog);

    export type Config = tg.FromGuard<typeof isConfig>;
  }

  export interface Log {
    (msg: string): any;
  }

  export const consoleLog = console.log;

  export class TelegramLog {
    protected client: TelegramClient;

    constructor(public readonly config: Config.TelegramLogOptions = config) {
      this.client = new TelegramClient({
        accessToken: this.config.accessToken,
      });
    }

    log(msg: string) {
      this.client.sendMessage(this.config.chatId, msg, {
        parseMode: ParseMode.Markdown,
      });
    }
  }

  export class AgregateLog {
    protected outputs: Log[];

    constructor(public readonly config: Config.Config[] = config) {
      this.outputs = config.reduce((result: Log[], config) => {
        if (Config.isTelegramLog(config)) {
          const logger = new TelegramLog(config.options);
          return [...result, logger.log.bind(logger)];
        } else if (Config.isConsoleLog(config)) {
          return [...result, consoleLog];
        }
        return result;
      }, []);
    }

    log(msg: string) {
      this.outputs.forEach((log) => log(msg));
    }
  }
}
