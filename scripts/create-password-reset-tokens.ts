/**
 * Migration idempotente : crée la table password_reset_tokens si absente.
 * Exécution : npx tsx scripts/create-password-reset-tokens.ts
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  ""
);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS prt_user ON password_reset_tokens(user_id)`;
  console.log("✅ Table password_reset_tokens prête.");
}

main().catch((e) => { console.error(e); process.exit(1); });
