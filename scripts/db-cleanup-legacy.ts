/**
 * Supprime les tables héritées de l'ancienne application cci-planning-sync
 * avant d'appliquer les nouvelles migrations Drizzle.
 * À ne lancer qu'une seule fois.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant dans .env.local");

const sql = neon(DATABASE_URL);

async function cleanupLegacy() {
  console.log("🧹 Nettoyage des tables legacy cci-planning-sync...");

  // Tables de l'ancienne app (pas dans notre nouveau schéma)
  const legacyTables = ["collaborators", "backups"];
  // Tables en conflit avec notre nouveau schéma
  const conflictingTables = ["plannings"];

  const allToDrop = [...legacyTables, ...conflictingTables];

  for (const table of allToDrop) {
    try {
      await sql(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      console.log(`  ✓ TABLE ${table} supprimée (ou inexistante)`);
    } catch (err) {
      console.error(`  ✗ Erreur sur ${table}:`, err);
    }
  }

  // Types ENUM potentiellement en conflit
  const legacyTypes: string[] = [];
  for (const type of legacyTypes) {
    try {
      await sql(`DROP TYPE IF EXISTS "${type}" CASCADE`);
      console.log(`  ✓ TYPE ${type} supprimé`);
    } catch (err) {
      console.error(`  ✗ Erreur sur type ${type}:`, err);
    }
  }

  console.log("✅ Nettoyage terminé — prêt pour pnpm db:migrate");
}

cleanupLegacy().catch(console.error);
