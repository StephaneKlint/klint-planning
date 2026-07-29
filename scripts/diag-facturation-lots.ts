import { neon } from "@neondatabase/serverless";
const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");
const sql = neon(DATABASE_URL);

async function run() {
  // Lots 4.3.12 et 4.3.13 dans e-facturation
  const lots = await sql`
    SELECT l.id, l.name
    FROM lots l
    JOIN plannings p ON p.id = l.planning_id
    WHERE lower(p.name) LIKE '%facturation%'
      AND l.name IN ('Lot 4.3.12', 'Lot 4.3.13')
  ` as { id: string; name: string }[];

  for (const lot of lots) {
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`Lot : ${lot.name}  [${lot.id}]`);
    console.log(`═══════════════════════════════════════════`);

    // Phases
    const phases = await sql`
      SELECT ph.id, ph.label, ph.start_date, ph.end_date,
             ph.sync_group_id,
             ph.status, ph.progress
      FROM phases ph
      WHERE ph.lot_id = ${lot.id}
      ORDER BY ph.start_date, ph.label
    `;

    console.log(`\n  📌 PHASES (${phases.length}) :`);
    for (const ph of phases) {
      const linked = ph.sync_group_id ? `🔗 sync: ${ph.sync_group_id}` : "⚪ non lié";
      console.log(`  [${ph.status ?? "-"}] ${ph.label ?? "(sans label)"}`);
      console.log(`       ${ph.start_date} → ${ph.end_date}  |  ${linked}`);
      console.log(`       id: ${ph.id}`);
    }

    // Jalons
    const milestones = await sql`
      SELECT m.id, m.label, m.date,
             m.sync_group_id
      FROM milestones m
      WHERE m.lot_id = ${lot.id}
      ORDER BY m.date, m.label
    `;

    console.log(`\n  🏁 JALONS (${milestones.length}) :`);
    for (const m of milestones) {
      const linked = m.sync_group_id ? `🔗 sync: ${m.sync_group_id}` : "⚪ non lié";
      console.log(`  ${m.label}`);
      console.log(`       ${m.date}  |  ${linked}`);
      console.log(`       id: ${m.id}`);
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
