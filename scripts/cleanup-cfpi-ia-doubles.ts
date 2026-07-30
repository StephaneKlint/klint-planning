/**
 * Supprime les phases en doublon dans les domaines CFPI et IA.
 *
 * Les mêmes doublons existent dans CCI 2026 (ref) et CCI 2026_S2.
 * Ce script nettoie les deux plannings pour éviter qu'un futur sync
 * réintroduise les phases supprimées dans S2.
 *
 * Dry-run par défaut.
 * Pour exécuter : DATABASE_URL=... npx tsx scripts/cleanup-cfpi-ia-doubles.ts --execute
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");
const sql = neon(DATABASE_URL);
const EXECUTE = process.argv.includes("--execute");

// ── Phases à supprimer ────────────────────────────────────────────────────────

const PHASES_TO_DELETE = [
  // ── CCI 2026 (ref) ──────────────────────────────────────────────────────────
  // CFPI > CCIT — phases null-label chevauchant les phases labelisées
  { id: "dfe03d06-40bb-49d3-9898-20052a927b63", desc: "REF / CCIT — null cadrage 10-05→11-23  (doublon de 'Cadrage' 09-12→10-31)" },
  { id: "ee21ccfc-c965-40ff-bf48-d0f63c9c534f", desc: "REF / CCIT — null dev    11-23→12-14  (doublon de 'Développement' 11-18→12-09)" },
  { id: "0556045c-706b-4f23-a103-e5fa8ffb3029", desc: "REF / CCIT — null recette 12-14→12-21 (doublon de 'Recette' 12-09→12-21)" },
  // CFPI > Flux CFENet — ancienne période janv-juin 2026 + doublon exact cadrage
  { id: "a808c205-4549-4527-ab22-b38413a22c34", desc: "REF / Flux CFENet — null cadrage 01-12→02-23 (doublon exact, même dates)" },
  { id: "98f1bdcc-e9f1-4c1b-9ec2-a1715904e81c", desc: "REF / Flux CFENet — 'Cadrage' 01-12→02-23  (ancienne période, garder 03-23→09-12)" },
  { id: "90e0a3af-5e51-418c-93f1-2238cffba19e", desc: "REF / Flux CFENet — null dev    04-27→06-01 (ancienne période)" },
  { id: "8a5b1cc0-825e-41b4-903c-4a29907f405a", desc: "REF / Flux CFENet — null recette 06-01→06-15 (ancienne période)" },
  // IA > Chatbot DRCC — null cadrage chevauchant la phase 'Cadrage' labelisée
  { id: "68de9f75-e0f0-4c3b-9b43-c4e959ef8246", desc: "REF / Chatbot DRCC — null cadrage 01-05→04-13 (doublon de 'Cadrage' 02-09→05-29)" },

  // ── CCI 2026_S2 ─────────────────────────────────────────────────────────────
  // CFPI > CCIT
  { id: "247f1333-d7fa-4c65-88c5-5f6a38428fe0", desc: "S2  / CCIT — null cadrage 10-05→11-23  (doublon de 'Cadrage' 09-12→10-31)" },
  { id: "7a1db7fb-f9e6-4f27-897c-4d6a05df98e7", desc: "S2  / CCIT — null dev    11-23→12-14  (doublon de 'Développement' 11-18→12-09)" },
  { id: "d14e5916-154a-4812-8361-558aa7f8e704", desc: "S2  / CCIT — null recette 12-14→12-21 (doublon de 'Recette' 12-09→12-21)" },
  // CFPI > Flux CFENet
  { id: "1934bfc8-c77b-4e7f-a19e-4d47389937a3", desc: "S2  / Flux CFENet — 'Cadrage' 01-12→02-23  (ancienne période)" },
  { id: "484fba0a-3399-44a9-a4ed-611ad3c2d238", desc: "S2  / Flux CFENet — null cadrage 01-12→02-23 (doublon exact)" },
  { id: "3b9aa50e-1501-4b3c-9267-1b40ce82f9c3", desc: "S2  / Flux CFENet — null dev    04-27→06-01 (ancienne période)" },
  { id: "990682c3-6dec-4079-9db7-5f1d2749c838", desc: "S2  / Flux CFENet — null recette 06-01→06-15 (ancienne période)" },
  // IA > Chatbot DRCC
  { id: "82e21734-a784-4f80-99fd-b0e3bdd5ce84", desc: "S2  / Chatbot DRCC — null cadrage 01-05→04-13 (doublon de 'Cadrage' 02-09→05-29)" },
];

// ── Vérification + exécution ──────────────────────────────────────────────────

async function run() {
  console.log(`\n${"─".repeat(72)}`);
  console.log(`🔍 Nettoyage doublons CFPI/IA — ${EXECUTE ? "⚠️  EXÉCUTION" : "DRY-RUN"}`);
  console.log(`${"─".repeat(72)}\n`);

  let found = 0, missing = 0;

  for (const ph of PHASES_TO_DELETE) {
    const rows = await sql`
      SELECT p.id, p.label, p.type,
        to_char(p.start_date,'YYYY-MM-DD') AS sd,
        to_char(p.end_date,'YYYY-MM-DD') AS ed,
        l.name AS lot, d.name AS domain, pl.name AS planning
      FROM phases p
      JOIN lots l ON l.id = p.lot_id
      JOIN domains d ON d.id = l.domain_id
      JOIN plannings pl ON pl.id = l.planning_id
      WHERE p.id = ${ph.id}
    `;
    if (rows.length === 0) {
      console.log(`  ❌ INTROUVABLE : ${ph.desc}`);
      missing++;
    } else {
      const r = rows[0];
      console.log(`  ✅ ${ph.desc}`);
      console.log(`     → [${r.planning}] ${r.domain} > ${r.lot} | "${r.label}" ${r.type} | ${r.sd}→${r.ed}`);
      found++;
    }
  }

  console.log(`\n${"─".repeat(72)}`);
  console.log(`Trouvées : ${found}  |  Introuvables : ${missing}  |  Total cible : ${PHASES_TO_DELETE.length}`);

  if (!EXECUTE) {
    console.log(`\nℹ️  Dry-run — aucune modification.`);
    console.log(`   Pour appliquer :`);
    console.log(`   DATABASE_URL=... npx tsx scripts/cleanup-cfpi-ia-doubles.ts --execute\n`);
    return;
  }

  if (missing > 0) {
    console.log(`\n⚠️  ${missing} phase(s) introuvable(s) — vérifier avant d'appliquer.`);
  }

  console.log(`\n⚙️  Suppression...\n`);
  let ok = 0, err = 0;
  for (const ph of PHASES_TO_DELETE) {
    try {
      await sql`DELETE FROM phases WHERE id = ${ph.id}`;
      console.log(`  ✓ Supprimé : ${ph.desc}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ Erreur : ${ph.desc}`, e);
      err++;
    }
  }
  console.log(`\n✅ Terminé — ${ok} supprimée(s), ${err} erreur(s).\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
