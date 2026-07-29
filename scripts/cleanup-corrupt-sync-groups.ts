/**
 * Nettoie les groupes de synchronisation corrompus.
 * Un groupe corrompu = un même planning a 2+ membres liés à ce groupe
 * (phases ou jalons dans des lots différents).
 *
 * Jalons : 9 groupes connus, règles explicites (analyse préalable).
 * Phases : algorithme général — garde le membre dont le nom de lot
 *          apparaît dans le plus grand nombre de plannings du groupe.
 *
 * Dry-run par défaut.
 * Pour exécuter : DATABASE_URL=<pooled_url> npx tsx scripts/cleanup-corrupt-sync-groups.ts --execute
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");
const sql = neon(DATABASE_URL);
const EXECUTE = process.argv.includes("--execute");

// ── Règles explicites pour les 9 groupes de jalons corrompus ─────────────────
// Pour chaque groupe, on identifie les jalons à délier par le nom du lot
// (lower(trim(lot.name)) = pattern ou LIKE pattern).

type MsRule = {
  prefix: string;   // 8 premiers hex du UUID du milestone_sync_group
  label: string;    // description lisible
  unlinkLotPattern: string;  // pattern SQL (sur lower(trim(lot.name)))
  exact: boolean;            // true = égalité stricte, false = LIKE
};

const MS_RULES: MsRule[] = [
  {
    prefix: "0259b973",
    label: "MEP 29/09 — Lot4.3.14 (correct) vs L'exportateur/Lexportateur",
    unlinkLotPattern: "%exportateur%",
    exact: false,
  },
  {
    prefix: "576f0110",
    label: "Livraison REC3 15/09 — NSE/91 (correct) vs Lot4.3.14",
    unlinkLotPattern: "lot 4.3.14",
    exact: true,
  },
  {
    prefix: "62042040",
    label: "PMEP 18/09 — Lot4.3.14 (correct) vs Lot4.3.13.1",
    unlinkLotPattern: "lot 4.3.13.1",
    exact: true,
  },
  {
    prefix: "67644af2",
    label: "MEP 21/12 — CCIT (correct) vs Flux CFENet",
    unlinkLotPattern: "%flux cfe%",
    exact: false,
  },
  {
    prefix: "82b81350",
    label: "MEP 06/10 — NSE/91 (correct) vs Lot4.3.14",
    unlinkLotPattern: "lot 4.3.14",
    exact: true,
  },
  {
    prefix: "86116828",
    label: "MEP 31/08 — E-Invoicing CÉOS (correct) vs E-Invoicing",
    unlinkLotPattern: "e-invoicing",
    exact: true,
  },
  {
    prefix: "8730fddd",
    label: "Livraison REC3 07/09 — Lot4.3.14 (correct) vs L'exportateur/Lexportateur",
    unlinkLotPattern: "%exportateur%",
    exact: false,
  },
  {
    prefix: "96d80461",
    label: "Livraison REC3 31/07 — E-Invoicing CÉOS (correct) vs E-Invoicing",
    unlinkLotPattern: "e-invoicing",
    exact: true,
  },
  {
    prefix: "a529f1b7",
    label: "MEP 28/07 — Automatisation VAC (correct) vs API Webikeo",
    unlinkLotPattern: "%webikeo%",
    exact: false,
  },
];

// ── Nettoyage des jalons ──────────────────────────────────────────────────────

async function cleanupMilestones() {
  console.log(`\n${"═".repeat(62)}`);
  console.log("🏁  JALONS — corrections explicites");
  console.log(`${"═".repeat(62)}`);

  const toUnlink: { id: string; desc: string }[] = [];

  for (const rule of MS_RULES) {
    const groups = await sql`
      SELECT id FROM milestone_sync_groups
      WHERE id::text LIKE ${rule.prefix + "%"}
    `;

    if (groups.length === 0) {
      console.log(`\n⚠️  Groupe ${rule.prefix} introuvable — ignoré`);
      continue;
    }
    const syncGroupId = groups[0].id as string;

    const members = await sql`
      SELECT m.id, m.label, m.date,
             l.name AS lot_name,
             p.name AS planning_name
      FROM milestones m
      JOIN lots l ON l.id = m.lot_id
      JOIN plannings p ON p.id = l.planning_id
      WHERE m.sync_group_id = ${syncGroupId}
      ORDER BY p.name, l.name
    `;

    console.log(`\n📌 ${rule.label}`);
    console.log(`   sync_group : ${syncGroupId}`);

    for (const m of members) {
      const norm = (m.lot_name as string).trim().toLowerCase();
      const willUnlink = rule.exact
        ? norm === rule.unlinkLotPattern
        : norm.includes(rule.unlinkLotPattern.replace(/%/g, ""));

      const tag = willUnlink ? "🗑  UNLINK" : "✅ GARDER";
      console.log(
        `   ${tag} | ${m.planning_name} | ${m.lot_name} | ${m.label ?? "(sans label)"} ${m.date ?? ""}`
      );

      if (willUnlink) {
        toUnlink.push({
          id: m.id as string,
          desc: `${m.planning_name} | ${m.lot_name} | ${m.label ?? "(sans label)"}`,
        });
      }
    }
  }

  console.log(`\n${"─".repeat(62)}`);
  console.log(`Jalons à délier : ${toUnlink.length}`);

  if (!EXECUTE || toUnlink.length === 0) return;

  console.log(`\n⚙️  Application...`);
  for (const item of toUnlink) {
    await sql`UPDATE milestones SET sync_group_id = NULL WHERE id = ${item.id}`;
    console.log(`   ✓ Délié : ${item.desc}`);
  }
}

// ── Nettoyage des phases — algorithme général ─────────────────────────────────

async function cleanupPhases() {
  console.log(`\n${"═".repeat(62)}`);
  console.log("📌  PHASES — algorithme général");
  console.log(`${"═".repeat(62)}`);

  // Groupes de phases où un planning a 2+ membres
  const corruptRows = await sql`
    SELECT
      ph.sync_group_id,
      l.planning_id,
      p.name AS planning_name,
      COUNT(*) AS cnt
    FROM phases ph
    JOIN lots l ON l.id = ph.lot_id
    JOIN plannings p ON p.id = l.planning_id
    WHERE ph.sync_group_id IS NOT NULL
    GROUP BY ph.sync_group_id, l.planning_id, p.name
    HAVING COUNT(*) > 1
    ORDER BY ph.sync_group_id, p.name
  `;

  if (corruptRows.length === 0) {
    console.log("\n✅ Aucun groupe de phases corrompu.");
    return;
  }

  console.log(`\nPaires (groupe × planning) corrompues : ${corruptRows.length}`);

  const uniqueGroupIds = [...new Set(corruptRows.map((r) => r.sync_group_id as string))];
  const toUnlink: { id: string; desc: string }[] = [];

  for (const groupId of uniqueGroupIds) {
    const members = await sql`
      SELECT
        ph.id,
        ph.label,
        ph.start_date,
        ph.end_date,
        l.id AS lot_id,
        l.name AS lot_name,
        p.id AS planning_id,
        p.name AS planning_name
      FROM phases ph
      JOIN lots l ON l.id = ph.lot_id
      JOIN plannings p ON p.id = l.planning_id
      WHERE ph.sync_group_id = ${groupId}
      ORDER BY p.name, l.name
    `;

    // Nombre de plannings distincts par nom de lot normalisé
    const planningCountByLot = new Map<string, number>();
    {
      const tmp = new Map<string, Set<string>>();
      for (const m of members) {
        const k = (m.lot_name as string).trim().toLowerCase();
        if (!tmp.has(k)) tmp.set(k, new Set());
        tmp.get(k)!.add(m.planning_id as string);
      }
      for (const [k, s] of tmp) planningCountByLot.set(k, s.size);
    }

    // Membres par planning
    const byPlanning = new Map<string, typeof members>();
    for (const m of members) {
      const pid = m.planning_id as string;
      if (!byPlanning.has(pid)) byPlanning.set(pid, []);
      byPlanning.get(pid)!.push(m);
    }

    let hasConflict = false;
    const groupToUnlink: { id: string; desc: string }[] = [];

    for (const [, planMembers] of byPlanning) {
      if (planMembers.length < 2) continue;
      hasConflict = true;

      const sorted = [...planMembers].sort((a, b) => {
        const ak = (a.lot_name as string).trim().toLowerCase();
        const bk = (b.lot_name as string).trim().toLowerCase();
        const ac = planningCountByLot.get(ak) ?? 0;
        const bc = planningCountByLot.get(bk) ?? 0;
        if (bc !== ac) return bc - ac;
        // Tie-break : préférer les noms spécifiques aux "Lot X.X.XX" génériques
        const aGen = /^lot \d+\.\d+/.test(ak);
        const bGen = /^lot \d+\.\d+/.test(bk);
        if (aGen !== bGen) return aGen ? 1 : -1;
        return 0;
      });

      for (let i = 1; i < sorted.length; i++) {
        groupToUnlink.push({
          id: sorted[i].id as string,
          desc: `${sorted[i].planning_name} | ${sorted[i].lot_name} | ${sorted[i].label ?? "(null)"} (garde ${sorted[0].lot_name})`,
        });
      }
    }

    if (hasConflict) {
      console.log(`\n  Groupe ${groupId.substring(0, 8)}...`);
      for (const m of members) {
        const willUnlink = groupToUnlink.some((u) => u.id === m.id);
        const tag = willUnlink ? "🗑  UNLINK" : "✅ GARDER";
        const pCount = planningCountByLot.get((m.lot_name as string).trim().toLowerCase()) ?? 0;
        console.log(
          `    ${tag} [${pCount}p] | ${m.planning_name} | ${m.lot_name} | ${m.label ?? "(null)"}`
        );
      }
      toUnlink.push(...groupToUnlink);
    }
  }

  console.log(`\n${"─".repeat(62)}`);
  console.log(`Phases à délier : ${toUnlink.length}`);

  if (!EXECUTE || toUnlink.length === 0) return;

  console.log(`\n⚙️  Application...`);
  for (const item of toUnlink) {
    await sql`UPDATE phases SET sync_group_id = NULL WHERE id = ${item.id}`;
    console.log(`   ✓ Délié : ${item.desc}`);
  }
}

// ── Correction du sous-titre du lot 4.3.14 dans CCI 2026_S2 ──────────────────

async function fixLot4314Subtitle() {
  console.log(`\n${"═".repeat(62)}`);
  console.log("🏷  SOUS-TITRE — Lot 4.3.14 CCI 2026_S2");
  console.log(`${"═".repeat(62)}`);

  const ref = await sql`
    SELECT l.id, l.subtitle, p.name AS planning_name
    FROM lots l
    JOIN plannings p ON p.id = l.planning_id
    WHERE lower(p.name) LIKE '%cci 2026%'
      AND lower(p.name) NOT LIKE '%s2%'
      AND lower(trim(l.name)) = 'lot 4.3.14'
    LIMIT 1
  `;

  const tgt = await sql`
    SELECT l.id, l.subtitle, p.name AS planning_name
    FROM lots l
    JOIN plannings p ON p.id = l.planning_id
    WHERE lower(p.name) LIKE '%cci 2026%'
      AND lower(p.name) LIKE '%s2%'
      AND lower(trim(l.name)) = 'lot 4.3.14'
    LIMIT 1
  `;

  if (!ref[0] || !tgt[0]) {
    console.log(
      `\n⚠️  Lots introuvables (ref=${ref.length}, cible=${tgt.length})`
    );
    return;
  }

  console.log(`\n  Référence "${ref[0].planning_name}" :`);
  console.log(`    "${ref[0].subtitle ?? "(vide)"}"`);
  console.log(`\n  Cible     "${tgt[0].planning_name}" :`);
  console.log(`    "${tgt[0].subtitle ?? "(vide)"}"`);

  if (ref[0].subtitle === tgt[0].subtitle) {
    console.log(`\n  ✅ Sous-titres déjà identiques — rien à faire.`);
    return;
  }

  console.log(`\n  → Copier le sous-titre de "${ref[0].planning_name}" vers "${tgt[0].planning_name}"`);

  if (!EXECUTE) return;

  await sql`UPDATE lots SET subtitle = ${ref[0].subtitle} WHERE id = ${tgt[0].id}`;
  console.log(`  ✓ Sous-titre mis à jour.`);
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${"═".repeat(62)}`);
  console.log(`🔧 Nettoyage des groupes de synchronisation corrompus`);
  console.log(
    `   Mode : ${EXECUTE ? "⚠️  EXÉCUTION — modifications en base" : "🔍 DRY-RUN — aucune modification"}`
  );
  console.log(`${"═".repeat(62)}`);

  await cleanupMilestones();
  await cleanupPhases();
  await fixLot4314Subtitle();

  console.log(`\n${"═".repeat(62)}`);
  console.log(
    EXECUTE
      ? "✅ Terminé — modifications appliquées."
      : "ℹ️  Dry-run terminé — pour appliquer :\n   DATABASE_URL=<pooled_url> npx tsx scripts/cleanup-corrupt-sync-groups.ts --execute"
  );
  console.log(`${"═".repeat(62)}\n`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
