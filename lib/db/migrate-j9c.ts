/**
 * Migration j9c — table connection_logs (surveillance des connexions)
 * Idempotent: CREATE TABLE IF NOT EXISTS
 * Run: PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" npx tsx --env-file=.env.local lib/db/migrate-j9c.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Migration j9c — connection_logs...");

  await sql`
    CREATE TABLE IF NOT EXISTS connection_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      ip TEXT,
      country TEXT,
      country_code TEXT,
      city TEXT,
      user_agent TEXT,
      is_alert BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS cl_by_user ON connection_logs(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS cl_created ON connection_logs(created_at DESC)`;

  console.log("✅ Migration j9c terminée.");
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
