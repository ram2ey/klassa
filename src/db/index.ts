import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as tables from "@/db/schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://klasso:klasso@localhost:5432/klasso";

export const databaseClient = postgres(connectionString, {
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(databaseClient, { schema: tables });
