import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

// Charge .env.local (comme Next.js) pour que drizzle-kit ait DATABASE_URL
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
