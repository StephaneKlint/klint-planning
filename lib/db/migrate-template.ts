import { sql } from "drizzle-orm";
import { db } from ".";

async function main() {
  await db.execute(sql`
    ALTER TABLE plannings ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE
  `);
  console.log("Migration is_template: OK");
  process.exit(0);
}
main().catch((err) => { console.error(err); process.exit(1); });
