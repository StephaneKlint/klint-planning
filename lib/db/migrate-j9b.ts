/**
 * Migration j9b — table closure_periods (fermetures et jours fériés)
 * Idempotent: CREATE TABLE IF NOT EXISTS
 * Run: PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH" npx tsx --env-file=.env.local lib/db/migrate-j9b.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Migration j9b — closure_periods...");

  await sql`
    CREATE TABLE IF NOT EXISTS closure_periods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
      label VARCHAR(100) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      color VARCHAR(9) NOT NULL DEFAULT '#FEF3C7',
      type VARCHAR(20) NOT NULL DEFAULT 'custom',
      active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS cp_by_planning ON closure_periods(planning_id)
  `;

  console.log("✅ Migration j9b terminée.");
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
