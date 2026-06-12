/**
 * migrate-auth.ts — migration idempotente
 * Ajoute la colonne `password_hash` à la table `users`
 * et initialise le mot de passe par défaut : Klint2026!
 *
 * Usage : npx tsx lib/db/migrate-auth.ts
 */
import { sql } from "drizzle-orm";
import { db } from ".";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "Klint2026!";

async function main() {
  console.log("🔐 Migration auth — ajout password_hash...");

  // 1. Ajouter la colonne si elle n'existe pas encore
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);
  console.log("✅ Colonne password_hash présente.");

  // 2. Initialiser le mot de passe par défaut pour les utilisateurs sans hash
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const result = await db.execute(sql`
    UPDATE users SET password_hash = ${hash} WHERE password_hash IS NULL;
  `);
  console.log(`✅ Mot de passe par défaut initialisé pour ${(result as { rowCount?: number }).rowCount ?? "?"} utilisateur(s).`);
  console.log(`   Mot de passe temporaire : ${DEFAULT_PASSWORD}`);
  console.log("   ⚠️  Changez ce mot de passe via Paramètres → Sécurité après connexion.");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur migration:", err);
  process.exit(1);
});
