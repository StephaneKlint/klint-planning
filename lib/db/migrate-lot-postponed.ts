/**
 * Migration one-shot : ajoute les colonnes "lot reporté" sur la table lots.
 * Run: pnpm tsx lib/db/migrate-lot-postponed.ts
 */
import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(process.cwd()));

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Applying lot-postponed migration…");

  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lots' AND column_name='is_postponed') THEN
        ALTER TABLE "lots" ADD COLUMN "is_postponed" boolean DEFAULT false NOT NULL;
      END IF;
    END $$
  `;
  console.log("✓ lots.is_postponed ready");

  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lots' AND column_name='postponed_note') THEN
        ALTER TABLE "lots" ADD COLUMN "postponed_note" text;
      END IF;
    END $$
  `;
  console.log("✓ lots.postponed_note ready");

  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lots' AND column_name='postponed_label_color') THEN
        ALTER TABLE "lots" ADD COLUMN "postponed_label_color" varchar(20);
      END IF;
    END $$
  `;
  console.log("✓ lots.postponed_label_color ready");

  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lots' AND column_name='postponed_label_font') THEN
        ALTER TABLE "lots" ADD COLUMN "postponed_label_font" varchar(80);
      END IF;
    END $$
  `;
  console.log("✓ lots.postponed_label_font ready");

  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lots' AND column_name='postponed_label_size') THEN
        ALTER TABLE "lots" ADD COLUMN "postponed_label_size" smallint;
      END IF;
    END $$
  `;
  console.log("✓ lots.postponed_label_size ready");

  console.log("Done ✓");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
