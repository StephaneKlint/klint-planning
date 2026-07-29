/**
 * Nettoie les lots en doublon créés avant le correctif de normalisation des noms.
 * Un doublon = deux lots portant le même nom dans le même planning.
 * La règle de conservation : garder le lot qui a le plus de phases ;
 * en cas d'égalité, garder le plus ancien (id créé en premier via uuid v4 → tri par insertion).
 *
 * Mode par défaut : dry-run (affiche ce qui serait supprimé, ne touche à rien)
 * Mode exécution  : DATABASE_URL=... npx tsx scripts/cleanup-duplicate-lots.ts --execute
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");

const sql = neon(DATABASE_URL);
const EXECUTE = process.argv.includes("--execute");

// ── Résultat de l'analyse ─────────────────────────────────────────────────────
type DupRow = {
  planning_name: string;
  planning_id: string;
  lot_name: string;
  lot_id: string;
  phase_count: number;
  action: "KEEP" | "DELETE";
};

async function run() {
  console.log(`\n🔍 Recherche des lots en doublon…\n`);

  // 1. Trouver tous les groupes (planning_id, lot_name) ayant plus d'un lot
  const dupes = await sql`
    SELECT
      p.name                  AS planning_name,
      l.planning_id,
      l.name                  AS lot_name,
      l.id                    AS lot_id,
      COUNT(ph.id)::int       AS phase_count,
      ROW_NUMBER() OVER (
        PARTITION BY l.planning_id, lower(trim(l.name))
        ORDER BY COUNT(ph.id) DESC, l.id ASC
      )                       AS rn
    FROM lots l
    JOIN plannings p ON p.id = l.planning_id
    LEFT JOIN phases ph ON ph.lot_id = l.id
    WHERE (l.planning_id, lower(trim(l.name))) IN (
      SELECT planning_id, lower(trim(name))
      FROM lots
      GROUP BY planning_id, lower(trim(name))
      HAVING COUNT(*) > 1
    )
    GROUP BY p.name, l.planning_id, l.name, l.id
    ORDER BY p.name, l.name, rn
  `;

  if (dupes.length === 0) {
    console.log("✅ Aucun doublon trouvé. La base est propre.");
    return;
  }

  // 2. Annoter chaque ligne
  const rows: DupRow[] = dupes.map((r) => ({
    planning_name: r.planning_name as string,
    planning_id:   r.planning_id as string,
    lot_name:      r.lot_name as string,
    lot_id:        r.lot_id as string,
    phase_count:   r.phase_count as number,
    action:        (r.rn as number) === 1 ? "KEEP" : "DELETE",
  }));

  // 3. Rapport
  let currentPlanning = "";
  for (const row of rows) {
    if (row.planning_name !== currentPlanning) {
      currentPlanning = row.planning_name;
      console.log(`\n📋 ${currentPlanning}`);
      console.log("─".repeat(60));
    }
    const tag = row.action === "KEEP"
      ? `✅ CONSERVER  (${row.phase_count} phase${row.phase_count !== 1 ? "s" : ""})`
      : `🗑  SUPPRIMER  (${row.phase_count} phase${row.phase_count !== 1 ? "s" : ""})`;
    console.log(`  ${tag}  ${row.lot_name}  [${row.lot_id}]`);
  }

  const toDelete = rows.filter((r) => r.action === "DELETE");
  console.log(`\n──────────────────────────────────────────────────────────`);
  console.log(`Total : ${toDelete.length} lot(s) à supprimer sur ${rows.length} lignes analysées.\n`);

  if (!EXECUTE) {
    console.log("ℹ️  Dry-run — aucune modification effectuée.");
    console.log("   Pour appliquer : DATABASE_URL=... npx tsx scripts/cleanup-duplicate-lots.ts --execute\n");
    return;
  }

  // 4. Suppression
  console.log("⚙️  Suppression en cours…\n");
  let deleted = 0;
  let errors = 0;

  for (const row of toDelete) {
    try {
      await sql`DELETE FROM lots WHERE id = ${row.lot_id}`;
      console.log(`  ✓ Supprimé : ${row.lot_name} [${row.lot_id}] dans ${row.planning_name}`);
      deleted++;
    } catch (err) {
      console.error(`  ✗ Erreur sur ${row.lot_id}:`, err);
      errors++;
    }
  }

  console.log(`\n✅ Terminé — ${deleted} lot(s) supprimé(s)${errors > 0 ? `, ${errors} erreur(s)` : ""}.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
