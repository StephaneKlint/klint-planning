import { neon } from "@neondatabase/serverless";

const EFACT = "802d91e7-04fd-451a-966f-54d0d26ed7c1";

async function run() {
  const sql = neon(process.env.DATABASE_URL!);

  const domains = await sql`
    SELECT d.id, d.name,
      (SELECT COUNT(*) FROM lots l WHERE l.domain_id = d.id) AS lot_count
    FROM domains d
    WHERE d.planning_id = ${EFACT}
    ORDER BY d.name
  `;
  console.log("=== Domaines E-facturation ===");
  for (const d of domains)
    console.log(`  [${d.name}] id=${(d.id as string).substring(0,8)} | ${d.lot_count} lots`);

  const nse = await sql`
    SELECT l.id, l.name AS lot,
      (SELECT COUNT(*) FROM phases p WHERE p.lot_id = l.id) AS ph_count,
      (SELECT COUNT(*) FROM milestones m WHERE m.lot_id = l.id) AS ms_count
    FROM lots l
    JOIN domains d ON d.id = l.domain_id
    WHERE l.planning_id = ${EFACT}
      AND lower(trim(d.name)) = 'nse'
  `;
  console.log("\n=== Lots NSE dans E-facturation ===");
  for (const l of nse)
    console.log(`  "${l.lot}" id=${(l.id as string).substring(0,8)} | ${l.ph_count} phases, ${l.ms_count} jalons`);

  const nseDom = await sql`
    SELECT id FROM domains
    WHERE planning_id = ${EFACT} AND lower(trim(name)) = 'nse'
    LIMIT 1
  `;
  if (nseDom.length > 0)
    console.log(`\nDomaine NSE id complet : ${nseDom[0].id}`);
}

run().catch(e => { console.error(e); process.exit(1); });
