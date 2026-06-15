/**
 * Migration J19 — Soft delete pour les plannings
 * Ajoute la colonne deleted_at (idempotente, sans downtime).
 * Exécuter via : npx tsx lib/db/migrate-j19-softdelete.ts
 */
import { neon } from "@neondatabase/serverless";

async function run() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant dans .env.local");

  const sql = neon(url);

  console.log("Migration J19 — ajout de plannings.deleted_at…");
  await sql`ALTER TABLE plannings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  console.log("✅ Migration terminée : plannings.deleted_at ajoutée (nullable).");
}

run().catch((e) => { console.error(e); process.exit(1); });
