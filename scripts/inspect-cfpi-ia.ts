import { neon } from "@neondatabase/serverless";

const REF = "10467e34-18ae-4fca-9c13-60156dc00a69";
const S2  = "de5b6a5e-d765-404b-9db4-756170431e06";

async function run() {
  const sql = neon(process.env.DATABASE_URL!);

  // Phases complètes dans CCI 2026 (ref) pour CFPI et IA
  const ref = await sql`
    SELECT d.name AS domain, l.name AS lot, p.id, p.label, p.type,
      to_char(p.start_date,'YYYY-MM-DD') AS sd, to_char(p.end_date,'YYYY-MM-DD') AS ed
    FROM phases p JOIN lots l ON l.id=p.lot_id JOIN domains d ON d.id=l.domain_id
    WHERE l.planning_id=${REF} AND lower(trim(d.name)) IN ('cfpi','ia')
    ORDER BY d.name,l.name,p.start_date`;
  console.log("=== CCI 2026 REF (cfpi/ia) — phases complètes ===");
  for (const r of ref)
    console.log(`[${r.domain}] ${r.lot} | "${r.label}" ${r.type} | ${r.sd}→${r.ed} | id=${r.id}`);
}

run().catch(e => { console.error(e); process.exit(1); });
