/**
 * Diagnostic : compare CCI 2026 général vs E-facturation Macro-Planning.
 * Détecte les écarts de dates/statut/avancement (avec LOT_NAME_MAP AMO→SAP).
 * Exécution : npx tsx scripts/inspect-efact.ts
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
const SOURCE_ID = "10467e34-18ae-4fca-9c13-60156dc00a69";
const EFACT_ID  = "802d91e7-04fd-451a-966f-54d0d26ed7c1";

// Mapping : lot côté E-facturation → lot équivalent dans CCI 2026
const LOT_NAME_MAP: Record<string, string> = {
  "E-Facturation - SAP": "E-Facturation - AMO",
};

// to_char côté SQL pour éviter tout problème timezone
async function fetchPhases(planningId: string) {
  return sql`
    SELECT ph.id, l.name as lot_name, ph.label as phase_label, ph.sort_order,
           to_char(ph.start_date,'YYYY-MM-DD') as start_date,
           to_char(ph.end_date,  'YYYY-MM-DD') as end_date,
           ph.status, ph.progress
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    WHERE d.planning_id = ${planningId}
    ORDER BY d.sort_order, l.sort_order, ph.sort_order
  ` as Promise<any[]>;
}

async function run() {
  const srcPhases  = await fetchPhases(SOURCE_ID);
  const efactPhases = await fetchPhases(EFACT_ID);

  // Map composite depuis la source
  const srcMap = new Map<string, any>();
  for (const p of srcPhases) {
    if (!p.phase_label) continue;
    const key = `${p.lot_name}::${p.phase_label}`;
    if (!srcMap.has(key)) srcMap.set(key, p);
  }

  console.log(`CCI 2026 : ${srcPhases.length} phases | E-facturation : ${efactPhases.length} phases\n`);

  let ok = 0, diff = 0, missing = 0;
  for (const t of efactPhases) {
    const mappedLot = LOT_NAME_MAP[t.lot_name] ?? t.lot_name;
    if (!t.phase_label) {
      console.log(`⚠ NULL LABEL : [${t.lot_name}] id=${t.id}`);
      missing++;
      continue;
    }
    const key = `${mappedLot}::${t.phase_label}`;
    const src = srcMap.get(key);
    if (!src) {
      console.log(`⚠ SANS CORRESPONDANCE : [${t.lot_name}→${mappedLot}] "${t.phase_label}"`);
      missing++;
      continue;
    }
    if (src.start_date !== t.start_date || src.end_date !== t.end_date ||
        src.status !== t.status || src.progress !== t.progress) {
      console.log(`❌ ÉCART [${t.lot_name}] "${t.phase_label}"`);
      console.log(`   Source  : ${src.start_date} → ${src.end_date} | ${src.progress}% | ${src.status}`);
      console.log(`   E-fact  : ${t.start_date}   → ${t.end_date}   | ${t.progress}% | ${t.status}`);
      diff++;
    } else {
      ok++;
    }
  }
  console.log(`\nRésumé : ${ok} OK · ${diff} écarts · ${missing} sans correspondance`);
}

run().catch((e) => { console.error(e); process.exit(1); });
