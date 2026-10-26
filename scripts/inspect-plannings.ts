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

async function showStructure(planningId: string, name: string) {
  const rows = await sql`
    SELECT d.name as domain, l.name as lot, ph.label as phase,
           ph.start_date, ph.end_date, ph.progress, ph.status
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    WHERE d.planning_id = ${planningId}
    ORDER BY d.sort_order, l.sort_order, ph.sort_order
  `;
  console.log(`\n=== ${name} (${rows.length} phases) ===`);
  for (const r of rows as any[]) {
    console.log(`  [${r.domain}] > [${r.lot}] > "${r.phase}" | ${String(r.start_date).slice(0,10)} → ${String(r.end_date).slice(0,10)} | ${r.progress}% | ${r.status}`);
  }
}

async function run() {
  await showStructure(SOURCE_ID, "CCI 2026 général");
  await showStructure(EFACT_ID, "E-facturation Macro-Planning");
}

run().catch((e) => { console.error(e); process.exit(1); });
