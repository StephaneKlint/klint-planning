/**
 * Correction : phases avec status=done mais progress=0 (hors Congés)
 * → reset status=null pour cohérence avec la source
 * Exécution : npx tsx scripts/fix-done-zero-progress.ts
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
  // Afficher les phases concernées avant correction
  const before = await sql`
    SELECT pl.name as planning, l.name as lot, ph.label, ph.status, ph.progress, ph.id
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    JOIN plannings pl ON pl.id = d.planning_id
    WHERE ph.status = 'done' AND ph.progress = 0
      AND pl.name NOT ILIKE '%congé%'
    ORDER BY pl.name, l.name, ph.sort_order
  `;
  console.log(`\n=== Phases à corriger (status=done/progress=0) ===`);
  for (const r of before) console.log(`  [${r.planning}] ${r.lot} / "${r.label ?? "null"}"`);

  // Correction : reset status = null
  const result = await sql`
    UPDATE phases
    SET status = NULL, version = version + 1
    WHERE status = 'done' AND progress = 0
      AND lot_id IN (
        SELECT ph2.lot_id FROM phases ph2
        JOIN lots l2 ON l2.id = ph2.lot_id
        JOIN domains d2 ON d2.id = l2.domain_id
        JOIN plannings pl2 ON pl2.id = d2.planning_id
        WHERE pl2.name NOT ILIKE '%congé%'
        AND ph2.status = 'done' AND ph2.progress = 0
      )
    RETURNING id
  `;
  console.log(`\n✅ ${result.length} phases corrigées (status=done/progress=0 → status=null)`);

  // Vérification finale
  const after = await sql`
    SELECT COUNT(*) as nb
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    JOIN plannings pl ON pl.id = d.planning_id
    WHERE ph.status = 'done' AND ph.progress = 0
      AND pl.name NOT ILIKE '%congé%'
  `;
  console.log(`=== Après correction : ${after[0].nb} phases restantes avec écart ===`);
}

run().catch((e) => { console.error(e); process.exit(1); });
