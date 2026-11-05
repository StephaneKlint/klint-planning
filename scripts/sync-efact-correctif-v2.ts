/**
 * Correctif v2 — E-facturation Macro-Planning.
 * Les scripts précédents (sync-efact-correctif + sync-efact-lot4312) utilisaient
 * toISO/toISOString() → décalage -1 jour sur toutes les dates modifiées.
 * Fix : UPDATE FROM SQL pur (copie DB→DB sans conversion JS des dates).
 *
 * Exécution : npx tsx scripts/sync-efact-correctif-v2.ts
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
const TARGET_ID = "802d91e7-04fd-451a-966f-54d0d26ed7c1";

// Lots dont le nom diffère entre CCI 2026 et E-facturation : cible → source
const LOT_NAME_MAP: Record<string, string> = {
  "E-Facturation - SAP": "E-Facturation - AMO",
};

type PhaseRow = {
  id: string;
  lot_name: string;
  phase_label: string | null;
  sort_order: number;
};

async function fetchPhases(planningId: string): Promise<PhaseRow[]> {
  return sql`
    SELECT ph.id, l.name as lot_name, ph.label as phase_label, ph.sort_order
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    WHERE d.planning_id = ${planningId}
    ORDER BY d.sort_order, l.sort_order, ph.sort_order
  ` as Promise<PhaseRow[]>;
}

async function run() {
  console.log("Chargement des phases…");
  const [sourcePhases, targetPhases] = await Promise.all([
    fetchPhases(SOURCE_ID),
    fetchPhases(TARGET_ID),
  ]);
  console.log(`  Source CCI 2026    : ${sourcePhases.length} phases`);
  console.log(`  Cible E-facturation: ${targetPhases.length} phases`);

  // Map composite lot_name::phase_label → source phase (première occurrence)
  const srcMap = new Map<string, PhaseRow>();
  for (const p of sourcePhases) {
    if (!p.phase_label) continue;
    const key = `${p.lot_name}::${p.phase_label}`;
    if (!srcMap.has(key)) srcMap.set(key, p);
  }

  // Index source par lot (pour match par position)
  const srcByLot = new Map<string, PhaseRow[]>();
  for (const p of sourcePhases) {
    const list = srcByLot.get(p.lot_name) ?? [];
    list.push(p);
    srcByLot.set(p.lot_name, list);
  }

  let updated = 0, skipped = 0;
  const positionTargets: PhaseRow[] = [];

  // ── 1. Match par clé composite ────────────────────────────────────────────
  for (const t of targetPhases) {
    const srcLotName = LOT_NAME_MAP[t.lot_name] ?? t.lot_name;

    if (!t.phase_label) {
      positionTargets.push(t);
      continue;
    }

    const key = `${srcLotName}::${t.phase_label}`;
    const src = srcMap.get(key);

    if (!src) {
      // Peut aussi venir d'un lot dont la source a des null labels
      positionTargets.push(t);
      continue;
    }

    await sql`
      UPDATE phases AS tgt
      SET start_date = src.start_date,
          end_date   = src.end_date,
          status     = src.status,
          progress   = src.progress,
          version    = tgt.version + 1
      FROM phases AS src
      WHERE tgt.id = ${t.id}
        AND src.id = ${src.id}
    `;
    console.log(`  ✔ [${t.lot_name}] "${t.phase_label}"`);
    updated++;
  }

  // ── 2. Match par position pour phases sans correspondance par libellé ─────
  if (positionTargets.length > 0) {
    console.log(`\nPhases sans correspondance (${positionTargets.length}) — match par position (sort_order) :`);

    const tgtByLot = new Map<string, PhaseRow[]>();
    for (const p of positionTargets) {
      const srcLotName = LOT_NAME_MAP[p.lot_name] ?? p.lot_name;
      const list = tgtByLot.get(srcLotName) ?? [];
      list.push(p);
      tgtByLot.set(srcLotName, list);
    }

    for (const [srcLotName, tgtList] of tgtByLot) {
      const srcList = srcByLot.get(srcLotName);
      if (!srcList) {
        console.log(`  ⚠ Lot "${srcLotName}" absent de la source — ignoré`);
        skipped += tgtList.length;
        continue;
      }
      for (let i = 0; i < tgtList.length; i++) {
        const t = tgtList[i];
        const src = srcList[i];
        if (!src) {
          console.log(`  ⚠ [${srcLotName}] position ${i + 1} absente de la source`);
          skipped++;
          continue;
        }
        await sql`
          UPDATE phases AS tgt
          SET start_date = src.start_date,
              end_date   = src.end_date,
              status     = src.status,
              progress   = src.progress,
              version    = tgt.version + 1
          FROM phases AS src
          WHERE tgt.id = ${t.id}
            AND src.id = ${src.id}
        `;
        console.log(`  ✔ [${t.lot_name}] pos ${i + 1} "${t.phase_label ?? "null"}" → source "${src.phase_label ?? "null"}"`);
        updated++;
      }
    }
  }

  console.log(`\nTerminé. ${updated} phases corrigées, ${skipped} ignorées.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
