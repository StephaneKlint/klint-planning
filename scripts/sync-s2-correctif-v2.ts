/**
 * Correctif v2 — CCI 2026_S2.
 * V1 souffrait d'un décalage -1 jour dû à la conversion toISOString() UTC sur dates locales.
 * Fix : UPDATE FROM SQL pur — les dates sont copiées directement en base, sans conversion JS.
 *
 * Exécution : npx tsx scripts/sync-s2-correctif-v2.ts
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
const TARGET_ID = "de5b6a5e-d765-404b-9db4-756170431e06";

type PhaseRow = {
  id: string;
  lot_name: string;
  phase_label: string | null;
  sort_order: number;
};

async function fetchPhases(planningId: string): Promise<PhaseRow[]> {
  const rows = await sql`
    SELECT ph.id, l.name as lot_name, ph.label as phase_label, ph.sort_order
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    WHERE d.planning_id = ${planningId}
    ORDER BY d.sort_order, l.sort_order, ph.sort_order
  `;
  return rows as PhaseRow[];
}

async function run() {
  console.log("Chargement des phases…");
  const [sourcePhases, targetPhases] = await Promise.all([
    fetchPhases(SOURCE_ID),
    fetchPhases(TARGET_ID),
  ]);
  console.log(`  Source CCI 2026 : ${sourcePhases.length} phases`);
  console.log(`  Cible CCI 2026_S2 : ${targetPhases.length} phases`);

  // Map composite lot_name::phase_label → source phase id
  const srcMap = new Map<string, PhaseRow>();
  for (const p of sourcePhases) {
    if (!p.phase_label) continue;
    const key = `${p.lot_name}::${p.phase_label}`;
    if (!srcMap.has(key)) srcMap.set(key, p);
  }

  // ── 1. Match par clé composite (phases avec libellé) ──────────────────────
  let updated = 0, skipped = 0;
  const nullLabelTargets: PhaseRow[] = [];

  for (const t of targetPhases) {
    if (!t.phase_label) {
      nullLabelTargets.push(t);
      continue;
    }
    const key = `${t.lot_name}::${t.phase_label}`;
    const src = srcMap.get(key);
    if (!src) {
      console.log(`  ⚠ Sans correspondance : [${t.lot_name}] "${t.phase_label}"`);
      skipped++;
      continue;
    }

    // UPDATE FROM : copie DB→DB sans conversion JS des dates
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

  // ── 2. Match par position (sort_order) pour phases sans libellé ───────────
  if (nullLabelTargets.length > 0) {
    console.log(`\nPhases sans libellé (${nullLabelTargets.length}) — match par position (sort_order) :`);

    // Grouper par lot côté source et cible
    const srcByLot = new Map<string, PhaseRow[]>();
    for (const p of sourcePhases) {
      const list = srcByLot.get(p.lot_name) ?? [];
      list.push(p);
      srcByLot.set(p.lot_name, list);
    }
    // Les phases côté cible sont déjà triées par sort_order grâce au ORDER BY

    const tgtByLot = new Map<string, PhaseRow[]>();
    for (const p of nullLabelTargets) {
      const list = tgtByLot.get(p.lot_name) ?? [];
      list.push(p);
      tgtByLot.set(p.lot_name, list);
    }

    for (const [lotName, tgtList] of tgtByLot) {
      const srcList = srcByLot.get(lotName);
      if (!srcList) {
        console.log(`  ⚠ Lot "${lotName}" absent de la source — ignoré`);
        skipped += tgtList.length;
        continue;
      }
      for (let i = 0; i < tgtList.length; i++) {
        const t = tgtList[i];
        const src = srcList[i]; // même position
        if (!src) {
          console.log(`  ⚠ [${lotName}] position ${i + 1} absente de la source`);
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
        console.log(`  ✔ [${lotName}] pos ${i + 1} (label null → "${src.phase_label ?? "null"}")`);
        updated++;
      }
    }
  }

  console.log(`\nTerminé. ${updated} phases corrigées, ${skipped} ignorées.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
