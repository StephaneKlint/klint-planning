/**
 * Migration one-shot : corrige les incohérences status/progress
 * - progress=100 et status≠done → set status='done'
 * - Exclut les phases avec status 'risk' ou 'late' (intentionnel)
 * Exécution : npx tsx scripts/fix-done-status.ts
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
  // Diagnostic avant correction
  const before = await sql`
    SELECT pl.name as planning, COUNT(*) as nb
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    JOIN plannings pl ON pl.id = d.planning_id
    WHERE ph.progress = 100 AND (ph.status IS NULL OR ph.status != 'done')
      AND ph.status NOT IN ('risk', 'late') OR (ph.progress = 100 AND ph.status IS NULL)
    GROUP BY pl.name
    ORDER BY pl.name
  `;
  console.log(`\n=== Avant correction (phases à corriger) ===`);
  for (const r of before) console.log(`  [${r.planning}] ${r.nb} phases`);

  // Correction : progress=100 → status='done' (sauf risk/late)
  const result = await sql`
    UPDATE phases
    SET status = 'done', version = version + 1
    WHERE progress = 100
      AND (status IS NULL OR status NOT IN ('done', 'risk', 'late'))
    RETURNING id
  `;
  console.log(`\n✅ ${result.length} phases corrigées (progress=100 → status='done')`);

  // Vérification après
  const after = await sql`
    SELECT COUNT(*) as nb
    FROM phases
    WHERE progress = 100 AND (status IS NULL OR status != 'done')
      AND status NOT IN ('risk', 'late')
  `;
  console.log(`\n=== Après correction : ${after[0].nb} phases restantes avec écart ===`);

  // Afficher les 3 phases S2 problématiques (status=done mais progress=0)
  const anomalous = await sql`
    SELECT pl.name as planning, l.name as lot, ph.label, ph.status, ph.progress
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    JOIN plannings pl ON pl.id = d.planning_id
    WHERE ph.status = 'done' AND ph.progress = 0
      AND pl.name NOT ILIKE '%congé%'
    ORDER BY pl.name, l.name, ph.sort_order
  `;
  if (anomalous.length > 0) {
    console.log(`\n⚠️  Phases avec status=done mais progress=0 (hors Congés) :`);
    for (const p of anomalous) {
      console.log(`  [${p.planning}] ${p.lot} / "${p.label ?? "null"}"`);
    }
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
