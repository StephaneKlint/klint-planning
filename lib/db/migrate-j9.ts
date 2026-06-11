/**
 * Migration Jalon 9 — ajoute la colonne disabled à plannings
 * Idempotente : ne plante pas si la colonne existe déjà.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("Migration Jalon 9 — plannings.disabled...");
  await sql`ALTER TABLE plannings ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE`;
  console.log("✅ Migration Jalon 9 terminée.");
}

migrate().catch((e) => { console.error(e); process.exit(1); });
