import { neon } from "@neondatabase/serverless";
const sql = neon("postgresql://neondb_owner:npg_4BiNAO0EHYld@ep-muddy-silence-a2o47z8h.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
const CCI = "10467e34-18ae-4fca-9c13-60156dc00a69";
const S2  = "de5b6a5e-d765-404b-9db4-756170431e06";

async function run() {
  const groups = await sql`
    SELECT pg.id, pg.name, array_agg(pgm.planning_id) as members
    FROM planning_groups pg
    JOIN planning_group_members pgm ON pgm.group_id = pg.id
    WHERE pgm.planning_id = ${CCI} OR pgm.planning_id = ${S2}
    GROUP BY pg.id, pg.name
  `;
  console.log("Groupes de sync communs :", groups.length === 0 ? "AUCUN" : JSON.stringify(groups, null, 2));

  const linked = await sql`
    SELECT COUNT(*) as nb
    FROM phase_sync_groups psg
    JOIN phases p1 ON p1.sync_group_id = psg.id
    JOIN phases p2 ON p2.sync_group_id = psg.id AND p2.id != p1.id
    JOIN lots l1 ON l1.id = p1.lot_id JOIN domains d1 ON d1.id = l1.domain_id
    JOIN lots l2 ON l2.id = p2.lot_id JOIN domains d2 ON d2.id = l2.domain_id
    WHERE d1.planning_id = ${CCI} AND d2.planning_id = ${S2}
  `;
  console.log("Phases linkées CCI2026↔S2 :", linked[0].nb);
}
run().catch(console.error);
