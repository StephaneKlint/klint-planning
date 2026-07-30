/**
 * Supprime le domaine NSE (et son unique lot "Lexportateur")
 * du planning E-facturation.
 *
 * Dry-run par défaut.
 * Pour exécuter : DATABASE_URL=... npx tsx scripts/remove-nse-from-efact.ts --execute
 */
import { neon } from "@neondatabase/serverless";

const EFACT   = "802d91e7-04fd-451a-966f-54d0d26ed7c1";
const NSE_DOM = "7b2e1e47-19f9-40ff-8952-200b6bad3bb0";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");
const sql = neon(DATABASE_URL);
const EXECUTE = process.argv.includes("--execute");

async function run() {
  console.log(`\n${"─".repeat(62)}`);
  console.log(`🗑️  Suppression domaine NSE — E-facturation`);
  console.log(`   Mode : ${EXECUTE ? "⚠️  EXÉCUTION" : "🔍 DRY-RUN"}`);
  console.log(`${"─".repeat(62)}\n`);

  // Vérification
  const dom = await sql`SELECT id, name FROM domains WHERE id = ${NSE_DOM}`;
  if (dom.length === 0) {
    console.log("✅ Domaine NSE introuvable dans E-facturation — déjà supprimé.");
    return;
  }
  console.log(`Domaine   : ${dom[0].name} (${dom[0].id})`);

  const lots = await sql`SELECT id, name FROM lots WHERE domain_id = ${NSE_DOM}`;
  for (const l of lots) {
    const ph = await sql`SELECT COUNT(*) AS n FROM phases WHERE lot_id = ${l.id}`;
    const ms = await sql`SELECT COUNT(*) AS n FROM milestones WHERE lot_id = ${l.id}`;
    console.log(`Lot       : "${l.name}" (${l.id})`);
    console.log(`           ${ph[0].n} phases, ${ms[0].n} jalons → à supprimer`);
  }

  if (!EXECUTE) {
    console.log(`\nℹ️  Dry-run — aucune modification.`);
    console.log(`   Pour appliquer :`);
    console.log(`   DATABASE_URL=... npx tsx scripts/remove-nse-from-efact.ts --execute\n`);
    return;
  }

  console.log(`\n⚙️  Suppression en cascade...\n`);
  for (const l of lots) {
    await sql`DELETE FROM milestones WHERE lot_id = ${l.id}`;
    await sql`DELETE FROM phases       WHERE lot_id = ${l.id}`;
    await sql`DELETE FROM lots         WHERE id     = ${l.id}`;
    console.log(`  ✓ Lot "${l.name}" supprimé (phases + jalons inclus)`);
  }
  await sql`DELETE FROM domains WHERE id = ${NSE_DOM}`;
  console.log(`  ✓ Domaine NSE supprimé\n`);
  console.log(`✅ Terminé.\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
