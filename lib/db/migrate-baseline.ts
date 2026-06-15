import { sql } from "drizzle-orm";
import { db } from ".";

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS baselines (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
      name        VARCHAR(100) NOT NULL,
      snapshot    JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS baselines_by_planning ON baselines(planning_id)
  `);
  console.log("Migration baselines: OK");
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
