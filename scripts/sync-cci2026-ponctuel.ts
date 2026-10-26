/**
 * Script ponctuel : aligne CCI 2026_S2 et E-facturation sur CCI 2026 général.
 * Correspond phases par libellé identique (case-insensitive, trim).
 * Copie : startDate, endDate, status, progress.
 * Exécution : npx tsx scripts/sync-cci2026-ponctuel.ts
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

// Lecture manuelle de .env.local (sans dotenv)
const envPath = resolve(process.cwd(), ".env.local");
const envLines = readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const SOURCE_ID  = "10467e34-18ae-4fca-9c13-60156dc00a69"; // CCI 2026 général
const TARGET_IDS = [
  "de5b6a5e-d765-404b-9db4-756170431e06", // CCI 2026_S2
  "802d91e7-04fd-451a-966f-54d0d26ed7c1", // E-facturation - Macro-Planning prévisionnel
];

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED non défini");
const sql = neon(url);

type PhaseRow = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: string;
  progress: number;
};

async function fetchPhases(planningId: string): Promise<PhaseRow[]> {
  const rows = await sql`
    SELECT ph.id, ph.label, ph.start_date, ph.end_date, ph.status, ph.progress
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    WHERE d.planning_id = ${planningId}
  `;
  return rows as PhaseRow[];
}

async function run() {
  console.log("Chargement des phases source (CCI 2026 général)…");
  const sourcePhases = await fetchPhases(SOURCE_ID);
  console.log(`  → ${sourcePhases.length} phases trouvées`);

  const sourceByLabel = new Map<string, PhaseRow>();
  for (const p of sourcePhases) {
    if (!p.label) continue;
    sourceByLabel.set(p.label.trim().toLowerCase(), p);
  }

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const targetId of TARGET_IDS) {
    const targetPhases = await fetchPhases(targetId);
    const targetName   = await sql`SELECT name FROM plannings WHERE id = ${targetId}`;
    const name = (targetName[0] as { name: string }).name;

    console.log(`\nTraitement de « ${name } » (${targetPhases.length} phases)…`);

    let updated = 0;
    let skipped = 0;

    for (const t of targetPhases) {
      if (!t.label) { skipped++; continue; }
      const src = sourceByLabel.get(t.label.trim().toLowerCase());
      if (!src) {
        skipped++;
        continue;
      }

      await sql`
        UPDATE phases
        SET
          start_date = ${src.start_date},
          end_date   = ${src.end_date},
          status     = ${src.status},
          progress   = ${src.progress},
          version    = version + 1
        WHERE id = ${t.id}
      `;
      console.log(`  ✔ "${t.label}" → ${src.start_date}→${src.end_date} | ${src.status} | ${src.progress}%`);
      updated++;
    }

    console.log(`  ${updated} mis à jour, ${skipped} sans correspondance`);
    totalUpdated += updated;
    totalSkipped += skipped;
  }

  console.log(`\nTerminé. ${totalUpdated} phases mises à jour, ${totalSkipped} sans correspondance.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
