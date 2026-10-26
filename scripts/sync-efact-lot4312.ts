/**
 * Correctif ponctuel pour Lot 4.3.12 dans E-facturation Macro-Planning.
 * Les phases "Cadrage" et "Développement" n'avaient pas de libellé dans CCI 2026 →
 * match impossible par label → dates incorrectes. On les corrige par position.
 *
 * Source CCI 2026 Lot 4.3.12 (dans l'ordre sort_order) :
 *   Pos 1 : null  → Jan 26 → May 04, 100% (= "Cadrage" dans E-facturation)
 *   Pos 2 : null  → May 04 → Jun 09, 100% (= "Développement" dans E-facturation)
 *   Pos 3 : Recette → Jun 09 → Jul 01, 100% (déjà corrigé)
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
  const toISO = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

  // Récupérer les phases de Lot 4.3.12 dans CCI 2026, dans l'ordre
  const srcRows = await sql`
    SELECT ph.id, ph.label, ph.start_date, ph.end_date, ph.status, ph.progress
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    WHERE d.planning_id = '10467e34-18ae-4fca-9c13-60156dc00a69'
      AND l.name = 'Lot 4.3.12'
    ORDER BY ph.sort_order
  `;
  console.log("Source Lot 4.3.12 (CCI 2026) :");
  for (const r of srcRows as any[]) {
    console.log(`  label="${r.label}" | ${toISO(r.start_date)} → ${toISO(r.end_date)} | ${r.progress}%`);
  }

  // Récupérer les phases de Lot 4.3.12 dans E-facturation, dans l'ordre
  const tgtRows = await sql`
    SELECT ph.id, ph.label, ph.start_date, ph.end_date
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN domains d ON d.id = l.domain_id
    WHERE d.planning_id = '802d91e7-04fd-451a-966f-54d0d26ed7c1'
      AND l.name = 'Lot 4.3.12'
    ORDER BY ph.sort_order
  `;
  console.log("\nCible Lot 4.3.12 (E-facturation) :");
  for (const r of tgtRows as any[]) {
    console.log(`  label="${r.label}" | ${toISO(r.start_date)} → ${toISO(r.end_date)}`);
  }

  // Match par position : phase n° cible → phase n° source
  let updated = 0;
  for (let i = 0; i < (tgtRows as any[]).length; i++) {
    const t = (tgtRows as any[])[i];
    const s = (srcRows as any[])[i];
    if (!s) { console.log(`  ⚠ Pas de source pour position ${i + 1}`); continue; }
    const startDate = toISO(s.start_date);
    const endDate   = toISO(s.end_date);
    await sql`
      UPDATE phases
      SET start_date = ${startDate}, end_date = ${endDate},
          status = ${s.status}, progress = ${s.progress}, version = version + 1
      WHERE id = ${t.id}
    `;
    console.log(`  ✔ "${t.label}" (pos ${i + 1}) → ${startDate} → ${endDate} | ${s.progress}%`);
    updated++;
  }

  console.log(`\nTerminé. ${updated} phases corrigées.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
