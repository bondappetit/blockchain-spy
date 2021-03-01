import Knex from "knex";

export const tableName = "logQueue";

export interface LogMessage {
  id: string;
  message: string;
  createdAt: Date;
}

export const logQueueTableFactory = (database: Knex) => () => {
  return database<LogMessage, LogMessage[]>(tableName);
};

export type LogQueueTable = ReturnType<ReturnType<typeof logQueueTableFactory>>;

export function migration(schema: Knex.SchemaBuilder) {
  return schema.createTable(tableName, (table) => {
    table.string("id", 36).notNullable().primary("pk");
    table.string("message", 512).notNullable();
    table.dateTime("createdAt").notNullable();
  });
}
