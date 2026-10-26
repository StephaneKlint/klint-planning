/**
 * Correctif sync E-facturation Macro-Planning prévisionnel.
 * Problème : sync précédent matchait par label seul → mauvaises dates pour phases répétées.
 * Fix : match composite lot_name + phase_label, avec mapping SAP→AMO.
 *
 * Exécution : npx tsx scripts/sync-efact-correctif.ts
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

const SOURCE_ID = "10467e34-18ae-4fca-9c13-60156dc00a69"; // CCI 2026 général
const TARGET_ID = "802d91e7-04fd-451a-966f-54d0d26ed7c1"; // E-facturation Macro-Planning

// Lots dont le nom diffère entre source et cible : cible → source
const LOT_NAME_MAP: Record<string, string> = {
  "E-Facturation - SAP": "E-Facturation - AMO",
};

type PhaseDB = {
  id: string;
  lot_name: string;
  phase_label: string | null;
  start_date: string;
  end_date: string;
  status: string | null;
  progress: number;
};

async function fetchPhases(planningId: string): Promise<PhaseDB[]> {
  const rows = await sql`
    SELECT ph.id, l.name as lot_name, ph.label as phase_label,
           ph.start_date, ph.end_date, ph.status, ph.progress
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    WHERE d.planning_id = ${planningId}
    ORDER BY d.sort_order, l.sort_order, ph.sort_order
  `;
  return rows as PhaseDB[];
}

async function run() {
  console.log("Chargement des phases source (CCI 2026 général)…");
  const sourcePhases = await fetchPhases(SOURCE_ID);
  console.log(`  → ${sourcePhases.length} phases`);

  // Map composite : "lot_name::phase_label" → phase source
  // Si plusieurs phases ont la même clé (ex: "Recette NSE" x2), on garde la première trouvée
  const sourceMap = new Map<string, PhaseDB>();
  for (const p of sourcePhases) {
    if (!p.phase_label) continue;
    const key = `${p.lot_name}::${p.phase_label}`;
    if (!sourceMap.has(key)) {
      sourceMap.set(key, p);
    }
  }
  console.log(`  → ${sourceMap.size} entrées dans la map composite`);

  console.log("\nChargement des phases cible (E-facturation Macro-Planning)…");
  const targetPhases = await fetchPhases(TARGET_ID);
  console.log(`  → ${targetPhases.length} phases`);

  let updated = 0;
  let skipped = 0;

  for (const t of targetPhases) {
    if (!t.phase_label) { skipped++; continue; }

    // Résoudre le lot source (mapping si noms différents)
    const sourceLotName = LOT_NAME_MAP[t.lot_name] ?? t.lot_name;
    const key = `${sourceLotName}::${t.phase_label}`;
    const src = sourceMap.get(key);

    if (!src) {
      console.log(`  ⚠ Sans correspondance : [${t.lot_name}] > "${t.phase_label}" (clé: ${key})`);
      skipped++;
      continue;
    }

    const toISO = (d: unknown) => {
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      return String(d).slice(0, 10);
    };
    const startDate = toISO(src.start_date);
    const endDate   = toISO(src.end_date);

    await sql`
      UPDATE phases
      SET
        start_date = ${startDate},
        end_date   = ${endDate},
        status     = ${src.status},
        progress   = ${src.progress},
        version    = version + 1
      WHERE id = ${t.id}
    `;
    console.log(`  ✔ [${t.lot_name}] "${t.phase_label}" → ${startDate} → ${endDate} | ${src.progress}% | ${src.status}`);
    updated++;
  }

  console.log(`\nTerminé. ${updated} phases corrigées, ${skipped} sans correspondance.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
