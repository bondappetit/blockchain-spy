import Knex from "knex";

export namespace Migration {
  export interface Candidate {
    (schema: Knex.SchemaBuilder): any;
  }

  export const tableName = "migration";

  export async function initMigrationTable(database: Knex) {
    if (await database.schema.hasTable(tableName)) return;

    return database.schema.createTable(tableName, (table) => {
      table.string("name", 512).notNullable().primary("pk");
      table.dateTime("createdAt").notNullable();
    });
  }

  export async function migrate(
    database: Knex,
    name: string,
    migration: Candidate
  ) {
    console.info(`Migration up: ${name}`);
    await migration(database.schema);
    await database(tableName).insert({
      name,
      createdAt: new Date(),
    });
  }

  export async function migrateAll(
    database: Knex,
    candidates: { [name: string]: Candidate }
  ) {
    const completed = await database(tableName).select("name");
    return Object.entries(candidates).reduce(
      async (prev, [name, candidate]) => {
        await prev;
        if (completed.find((complete) => name === complete.name) !== undefined)
          return;

        await migrate(database, name, candidate);
      },
      Promise.resolve()
    );
  }
}
