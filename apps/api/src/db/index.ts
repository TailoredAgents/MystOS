import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

declare global {
  var __mystDbClient: ReturnType<typeof postgres> | undefined;
  var __mystDrizzle: ReturnType<typeof drizzle> | undefined;
}

let cachedDb: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client =
    globalThis.__mystDbClient ??
    postgres(connectionString, {
      prepare: false,
      max: 5,
      idle_timeout: 20
    });

  if (process.env["NODE_ENV"] !== "production") {
    globalThis.__mystDbClient = client;
  }

  if (!cachedDb) {
    cachedDb = globalThis.__mystDrizzle ?? drizzle(client);

    if (process.env["NODE_ENV"] !== "production") {
      globalThis.__mystDrizzle = cachedDb;
    }
  }

  return cachedDb;
}

export type DatabaseClient = ReturnType<typeof getDb>;

export * from "./schema";
