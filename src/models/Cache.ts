import Knex from "knex";

export const tableName = "cache";

export interface Cache {
  key: string;
  value: string;
}

export const cacheTableFactory = (database: Knex) => () => {
  return database<Cache, Cache[]>(tableName);
};

export type CacheTable = ReturnType<ReturnType<typeof cacheTableFactory>>;

export function migration(schema: Knex.SchemaBuilder) {
  return schema.createTable(tableName, (table) => {
    table.string("key", 36).notNullable().primary("pk");
    table.string("value", 512).notNullable();
  });
}

export class CacheService {
  protected cacheTable: () => CacheTable;

  constructor(database: Knex) {
    this.cacheTable = cacheTableFactory(database);
  }

  async get(k: string) {
    const [cache] = await this.cacheTable()
      .select("value")
      .where("key", k)
      .limit(1);

    return cache ? cache.value : null;
  }

  async set(key: string, value: string) {
    await this.cacheTable().delete().where({ key });
    await this.cacheTable().insert({ key, value });
  }
}
