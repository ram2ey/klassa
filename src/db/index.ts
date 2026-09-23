import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as tables from "@/db/schema";

const poolSize = Number(process.env.DATABASE_POOL_SIZE ?? 10);
const pgUser = process.env.PGUSER || process.env.SERVICE_USER_POSTGRES;
const pgPassword = process.env.PGPASSWORD || process.env.SERVICE_PASSWORD_64_POSTGRES;

export const databaseClient = pgUser && pgPassword
  ? postgres({
      host: process.env.PGHOST || "postgres",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || "klassa",
      username: pgUser,
      password: pgPassword,
      max: poolSize,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    })
  : postgres(process.env.DATABASE_URL ?? "postgres://klasso:klasso@localhost:5432/klasso", {
      max: poolSize,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });

export const db = drizzle(databaseClient, { schema: tables });

