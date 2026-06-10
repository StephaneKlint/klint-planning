/**
 * Script one-shot : applique les changements de schema Jalon 6
 * Run: pnpm tsx lib/db/migrate-j6.ts
 */
import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(process.cwd()));

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Applying Jalon 6 schema changes...");

  // 1. Create app_settings if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS "app_settings" (
      "key"           varchar(20)                     PRIMARY KEY NOT NULL,
      "logo_data_url" text,
      "logo_alt"      varchar(100)                    DEFAULT 'Klint',
      "updated_at"    timestamp with time zone        DEFAULT now() NOT NULL
    )
  `;
  console.log("✓ app_settings ready");

  // 2. Add type column to plannings if not exists
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plannings' AND column_name = 'type'
      ) THEN
        ALTER TABLE "plannings" ADD COLUMN "type" varchar(20) DEFAULT 'multi' NOT NULL;
      END IF;
    END $$
  `;
  console.log("✓ plannings.type ready");

  console.log("Done ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
