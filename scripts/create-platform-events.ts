/**
 * Crée la table platform_events (idempotent).
 * Dry-run par défaut.
 * Exécution : DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d'=' -f2- | tr -d '"') npx tsx scripts/create-platform-events.ts --execute
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");
const sql = neon(DATABASE_URL);
const EXECUTE = process.argv.includes("--execute");

async function run() {
  console.log(`\n${"─".repeat(62)}`);
  console.log(`🔧  Migration platform_events — ${EXECUTE ? "⚠️  EXÉCUTION" : "🔍 DRY-RUN"}`);
  console.log(`${"─".repeat(62)}\n`);

  const exists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_events'
  `;

  if (exists.length > 0) {
    console.log("✓ Table platform_events déjà présente — rien à faire.\n");
    return;
  }

  console.log("Table platform_events absente → création nécessaire.");

  if (!EXECUTE) {
    console.log("\nℹ️  Dry-run — aucune modification.");
    console.log("   Pour appliquer :");
    console.log("   DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d'=' -f2- | tr -d '\"') npx tsx scripts/create-platform-events.ts --execute\n");
    return;
  }

  await sql`
    CREATE TABLE platform_events (
      id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      actor_email  TEXT,
      target_id    UUID REFERENCES users(id) ON DELETE SET NULL,
      target_email TEXT,
      event_type   VARCHAR(80) NOT NULL,
      summary      TEXT NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `;

  await sql`CREATE INDEX pe_created ON platform_events(created_at DESC)`;

  console.log("✅ Table platform_events créée.\n");
}

run().catch(e => { console.error(e); process.exit(1); });
