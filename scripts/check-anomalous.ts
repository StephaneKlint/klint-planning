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
  const rows = await sql`
    SELECT pl.name as planning, l.name as lot, ph.label, ph.status, ph.progress
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    JOIN plannings pl ON pl.id = d.planning_id
    WHERE l.name IN ('Contact Multicomptes', 'Lot 4.3.14', 'Lot 4.3.15', 'Formulaires conditionnels')
    ORDER BY pl.name, l.name, ph.sort_order
  `;
  for (const r of rows) {
    console.log(`[${r.planning}] ${r.lot} / "${r.label ?? "null"}" → ${r.progress}% | ${r.status ?? "null"}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
