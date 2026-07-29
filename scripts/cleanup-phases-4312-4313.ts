/**
 * Nettoyage ciblé des doublons dans les lots 4.3.12 et 4.3.13
 * du planning "E-facturation - Macro-Planning prévisionnel".
 *
 * Dry-run par défaut.
 * Pour exécuter : DATABASE_URL=... npx tsx scripts/cleanup-phases-4312-4313.ts --execute
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");
const sql = neon(DATABASE_URL);
const EXECUTE = process.argv.includes("--execute");

// ── Ce qui doit être supprimé ─────────────────────────────────────────────────
const PHASES_TO_DELETE = [
  { id: "b5b737dd-9111-4ea9-8141-3f6396cf20f8", desc: "Lot 4.3.12 — phase (sans label) / doublon Cadrage" },
  { id: "7e2d3dbf-ab3f-4f67-a6b4-864713c9f752", desc: "Lot 4.3.12 — phase (sans label) / doublon Développement" },
  { id: "bef092be-89d1-46c0-89dd-8cd383399b8d", desc: "Lot 4.3.13 — phase (sans label) / doublon Cadrage" },
  { id: "6788d825-1670-436f-a3c4-97ad7607ad0b", desc: "Lot 4.3.13 — Recette 06/08→31/08 / doublon Recette juillet" },
];

const MILESTONES_TO_DELETE = [
  { id: "e93d5ac4-0d38-45e9-be6e-e47d37609b40", desc: "Lot 4.3.13 — jalon MEP 30/07 (date erronée 28/07) / doublon MEP" },
];

// ── Ce qui doit être corrigé ──────────────────────────────────────────────────
const MILESTONE_TO_UPDATE = {
  id: "324de9a4-2e09-4201-8f70-7c44ea5c2233",
  label: "MEP 29/07",
  date: "2026-07-29",
  desc: "Lot 4.3.13 — MEP 28/07 → corrigé en MEP 29/07",
};

async function run() {
  console.log(`\n${"─".repeat(58)}`);
  console.log(`🔍 Nettoyage doublons lots 4.3.12 / 4.3.13 — E-facturation`);
  console.log(`${"─".repeat(58)}\n`);

  // Vérification préalable : les IDs existent bien
  console.log("📋 Vérification des éléments ciblés :\n");

  for (const ph of PHASES_TO_DELETE) {
    const rows = await sql`SELECT id, label, status FROM phases WHERE id = ${ph.id}`;
    const found = rows[0];
    const tag = found ? "✅" : "❌ INTROUVABLE";
    console.log(`  ${tag}  Phase  ${ph.desc}`);
    if (found) console.log(`         label="${found.label ?? "(null)"}"  status=${found.status ?? "-"}`);
  }

  for (const ms of MILESTONES_TO_DELETE) {
    const rows = await sql`SELECT id, label, date FROM milestones WHERE id = ${ms.id}`;
    const found = rows[0];
    const tag = found ? "✅" : "❌ INTROUVABLE";
    console.log(`  ${tag}  Jalon  ${ms.desc}`);
    if (found) console.log(`         label="${found.label}"  date=${found.date}`);
  }

  const upd = await sql`SELECT id, label, date FROM milestones WHERE id = ${MILESTONE_TO_UPDATE.id}`;
  const updFound = upd[0];
  const updTag = updFound ? "✅" : "❌ INTROUVABLE";
  console.log(`  ${updTag}  Jalon  ${MILESTONE_TO_UPDATE.desc}`);
  if (updFound) console.log(`         actuel : label="${updFound.label}"  date=${updFound.date}`);

  console.log(`\n${"─".repeat(58)}`);
  console.log(`Résumé : ${PHASES_TO_DELETE.length} phase(s) à supprimer, ${MILESTONES_TO_DELETE.length} jalon(s) à supprimer, 1 jalon à corriger`);

  if (!EXECUTE) {
    console.log(`\nℹ️  Dry-run — aucune modification.`);
    console.log(`   Pour appliquer : DATABASE_URL=... npx tsx scripts/cleanup-phases-4312-4313.ts --execute\n`);
    return;
  }

  console.log(`\n⚙️  Application...\n`);

  for (const ph of PHASES_TO_DELETE) {
    try {
      await sql`DELETE FROM phases WHERE id = ${ph.id}`;
      console.log(`  ✓ Phase supprimée : ${ph.desc}`);
    } catch (e) {
      console.error(`  ✗ Erreur : ${ph.desc}`, e);
    }
  }

  for (const ms of MILESTONES_TO_DELETE) {
    try {
      await sql`DELETE FROM milestones WHERE id = ${ms.id}`;
      console.log(`  ✓ Jalon supprimé : ${ms.desc}`);
    } catch (e) {
      console.error(`  ✗ Erreur : ${ms.desc}`, e);
    }
  }

  try {
    await sql`UPDATE milestones SET label = ${MILESTONE_TO_UPDATE.label}, date = ${MILESTONE_TO_UPDATE.date} WHERE id = ${MILESTONE_TO_UPDATE.id}`;
    console.log(`  ✓ Jalon mis à jour : ${MILESTONE_TO_UPDATE.desc}`);
  } catch (e) {
    console.error(`  ✗ Erreur mise à jour jalon :`, e);
  }

  console.log(`\n✅ Terminé.\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
