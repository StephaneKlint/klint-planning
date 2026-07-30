/**
 * Ajoute les champs manquants aux groupes de sync existants.
 *
 * phase_sync_groups    : ajoute "status"   si absent
 * milestone_sync_groups: ajoute "labelPos" si absent
 *
 * Dry-run par défaut.
 * Pour exécuter :
 *   DATABASE_URL=<pooled_url> npx tsx scripts/migrate-sync-fields.ts --execute
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");
const sql = neon(DATABASE_URL);
const EXECUTE = process.argv.includes("--execute");

async function run() {
  console.log(`\n${"─".repeat(62)}`);
  console.log(`🔧  Migration sync_fields — ${EXECUTE ? "⚠️  EXÉCUTION" : "🔍 DRY-RUN"}`);
  console.log(`${"─".repeat(62)}\n`);

  // ── phase_sync_groups : ajouter "status" ─────────────────────────────────
  const phaseGroups = await sql`
    SELECT id, sync_fields
    FROM phase_sync_groups
    WHERE NOT (sync_fields @> '["status"]'::jsonb)
  `;
  console.log(`phase_sync_groups à mettre à jour  : ${phaseGroups.length}`);

  if (EXECUTE && phaseGroups.length > 0) {
    await sql`
      UPDATE phase_sync_groups
      SET sync_fields = sync_fields || '["status"]'::jsonb
      WHERE NOT (sync_fields @> '["status"]'::jsonb)
    `;
    console.log(`  ✓ ${phaseGroups.length} groupe(s) mis à jour → "status" ajouté`);
  } else if (phaseGroups.length > 0) {
    for (const g of phaseGroups) {
      console.log(`  → id=${String(g.id).substring(0, 8)} | actuel: ${JSON.stringify(g.sync_fields)}`);
    }
  } else {
    console.log(`  ✓ Déjà à jour`);
  }

  // ── milestone_sync_groups : ajouter "labelPos" ────────────────────────────
  const msGroups = await sql`
    SELECT id, sync_fields
    FROM milestone_sync_groups
    WHERE NOT (sync_fields @> '["labelPos"]'::jsonb)
  `;
  console.log(`\nmilestone_sync_groups à mettre à jour : ${msGroups.length}`);

  if (EXECUTE && msGroups.length > 0) {
    await sql`
      UPDATE milestone_sync_groups
      SET sync_fields = sync_fields || '["labelPos"]'::jsonb
      WHERE NOT (sync_fields @> '["labelPos"]'::jsonb)
    `;
    console.log(`  ✓ ${msGroups.length} groupe(s) mis à jour → "labelPos" ajouté`);
  } else if (msGroups.length > 0) {
    for (const g of msGroups) {
      console.log(`  → id=${String(g.id).substring(0, 8)} | actuel: ${JSON.stringify(g.sync_fields)}`);
    }
  } else {
    console.log(`  ✓ Déjà à jour`);
  }

  if (!EXECUTE) {
    console.log(`\nℹ️  Dry-run — aucune modification.`);
    console.log(`   Pour appliquer :`);
    console.log(`   DATABASE_URL=<pooled_url> npx tsx scripts/migrate-sync-fields.ts --execute\n`);
  } else {
    console.log(`\n✅ Migration terminée.\n`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
