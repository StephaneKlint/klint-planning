/**
 * add-project-name-column.ts
 * Ajoute la colonne project_name (varchar 100, nullable) à la table plannings.
 * Idempotent — ne fait rien si la colonne existe déjà.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://neondb_owner:npg_uDVIUF1n0Zje@ep-muddy-silence-a2o47z8h-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

async function main() {
  // Vérifie si la colonne existe déjà
  const check = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'plannings' AND column_name = 'project_name'
  `;

  if (check.length > 0) {
    console.log("ℹ️  La colonne project_name existe déjà — rien à faire.");
    return;
  }

  await sql`
    ALTER TABLE plannings
    ADD COLUMN project_name varchar(100)
  `;

  console.log("✅ Colonne project_name ajoutée à la table plannings.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
