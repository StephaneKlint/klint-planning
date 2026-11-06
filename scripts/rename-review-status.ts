/**
 * Migration one-shot : renomme le statut "En revue" → "En attente validation QA"
 * dans la table statuses pour tous les plannings existants.
 * Exécution : npx tsx scripts/rename-review-status.ts
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

const envLines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
for (const line of envLines) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const sql = neon(process.env.DATABASE_URL_UNPOOLED!);

async function run() {
  const result = await sql`
    UPDATE statuses
    SET label = 'En attente validation QA'
    WHERE code = 'review' AND label = 'En revue'
    RETURNING planning_id
  `;
  console.log(`${result.length} planning(s) mis à jour.`);
  for (const r of result) console.log(`  → planning_id: ${r.planning_id}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
