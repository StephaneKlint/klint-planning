/**
 * Migration : synchronisation entre plannings liés (Jalon 1/5).
 * Crée 4 nouvelles tables + ajoute sync_group_id / version sur phases et milestones.
 * Run: pnpm tsx lib/db/migrate-planning-sync.ts
 * Idempotent — safe to re-run.
 */
import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";
import { resolve } from "path";

loadEnvConfig(resolve(process.cwd()));

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Applying planning-sync migration…");

  // ── 1. planning_groups ──────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS planning_groups (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(200) NOT NULL,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ planning_groups");

  // ── 2. planning_group_members ───────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS planning_group_members (
      group_id    UUID NOT NULL REFERENCES planning_groups(id) ON DELETE CASCADE,
      planning_id UUID NOT NULL REFERENCES plannings(id) ON DELETE CASCADE,
      added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      added_by    UUID REFERENCES users(id) ON DELETE SET NULL,
      PRIMARY KEY (group_id, planning_id)
    )
  `;
  console.log("✓ planning_group_members");

  // ── 3. phase_sync_groups ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS phase_sync_groups (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_group_id  UUID NOT NULL REFERENCES planning_groups(id) ON DELETE CASCADE,
      sync_fields        JSONB NOT NULL DEFAULT '["startDate","endDate","progress","color","note","label"]'
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS psg_by_group ON phase_sync_groups(planning_group_id)
  `;
  console.log("✓ phase_sync_groups");

  // ── 4. milestone_sync_groups ────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS milestone_sync_groups (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      planning_group_id  UUID NOT NULL REFERENCES planning_groups(id) ON DELETE CASCADE,
      sync_fields        JSONB NOT NULL DEFAULT '["date","color","note","label"]'
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS msg_by_group ON milestone_sync_groups(planning_group_id)
  `;
  console.log("✓ milestone_sync_groups");

  // ── 5. phases — sync_group_id ───────────────────────────────────────────
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='phases' AND column_name='sync_group_id'
      ) THEN
        ALTER TABLE phases
          ADD COLUMN sync_group_id UUID REFERENCES phase_sync_groups(id) ON DELETE SET NULL;
      END IF;
    END $$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS phase_by_sync_group ON phases(sync_group_id)
  `;
  console.log("✓ phases.sync_group_id");

  // ── 6. phases — version ─────────────────────────────────────────────────
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='phases' AND column_name='version'
      ) THEN
        ALTER TABLE phases ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
      END IF;
    END $$
  `;
  console.log("✓ phases.version");

  // ── 7. milestones — sync_group_id ───────────────────────────────────────
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='milestones' AND column_name='sync_group_id'
      ) THEN
        ALTER TABLE milestones
          ADD COLUMN sync_group_id UUID REFERENCES milestone_sync_groups(id) ON DELETE SET NULL;
      END IF;
    END $$
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ms_by_sync_group ON milestones(sync_group_id)
  `;
  console.log("✓ milestones.sync_group_id");

  // ── 8. milestones — version ─────────────────────────────────────────────
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='milestones' AND column_name='version'
      ) THEN
        ALTER TABLE milestones ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
      END IF;
    END $$
  `;
  console.log("✓ milestones.version");

  console.log("\nDone ✓  — 4 nouvelles tables créées, 4 colonnes ajoutées.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
