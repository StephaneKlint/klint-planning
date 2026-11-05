/**
 * Diagnostic : compare CCI 2026 général vs CCI 2026_S2 lot par lot.
 * Montre les écarts de dates/statut/avancement pour chaque phase.
 * Exécution : npx tsx scripts/inspect-s2.ts
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
const S2_ID     = "de5b6a5e-d765-404b-9db4-756170431e06";

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
  const srcPhases = await fetchPhases(SOURCE_ID);
  const s2Phases  = await fetchPhases(S2_ID);

  // Build composite map from source
  const srcMap = new Map<string, any>();
  for (const p of srcPhases) {
    if (!p.phase_label) continue;
    const key = `${p.lot_name}::${p.phase_label}`;
    if (!srcMap.has(key)) srcMap.set(key, p);
  }

  console.log(`CCI 2026 : ${srcPhases.length} phases | CCI 2026_S2 : ${s2Phases.length} phases\n`);

  let ok = 0, diff = 0, missing = 0;
  for (const t of s2Phases) {
    if (!t.phase_label) { missing++; continue; }
    const key = `${t.lot_name}::${t.phase_label}`;
    const src = srcMap.get(key);
    if (!src) {
      console.log(`⚠ SANS CORRESPONDANCE : [${t.lot_name}] "${t.phase_label}"`);
      missing++;
      continue;
    }
    const sStart = src.start_date as string, sEnd = src.end_date as string;
    const tStart = t.start_date   as string, tEnd = t.end_date   as string;
    if (sStart !== tStart || sEnd !== tEnd || src.status !== t.status || src.progress !== t.progress) {
      console.log(`❌ ÉCART [${t.lot_name}] "${t.phase_label}"`);
      console.log(`   Source  : ${sStart} → ${sEnd} | ${src.progress}% | ${src.status}`);
      console.log(`   S2 actuel: ${tStart} → ${tEnd} | ${t.progress}% | ${t.status}`);
      diff++;
    } else {
      ok++;
    }
  }
  console.log(`\nRésumé : ${ok} OK · ${diff} écarts · ${missing} sans correspondance`);
}

run().catch((e) => { console.error(e); process.exit(1); });
