import { LogQueue } from "../models";
import { Logger } from "./Logger";
import { v4 as uuid } from "uuid";

export class EventLogger {
  constructor(
    public readonly queue: () => LogQueue.LogQueueTable = queue,
    public readonly logger: Logger.Log = logger
  ) {}

  async push(msg: string) {
    const message = {
      id: uuid(),
      message: msg,
      createdAt: new Date(),
    };
    await this.queue().insert(message);
    return message;
  }

  pop(id: string) {
    return this.queue().delete().where({ id });
  }

  async handle() {
    const messages = await this.queue().select("*").limit(20);
    messages.forEach(async ({ id, message }) => {
      await this.logger(message);
      await this.pop(id);
    });
  }
}
