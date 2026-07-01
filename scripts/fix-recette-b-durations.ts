/**
 * fix-recette-b-durations.ts
 * Corrige les durées des phases de recette du Scénario B :
 * - Recette unitaire : 7j → 14j (= Scénario A)
 * - Cascade de toutes les phases recette B en conséquence
 * Ne touche pas les autres lots (Dev, Cadrage, Formation, MEP).
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const { domains, lots, phases } = schema;

const DATABASE_URL = "postgresql://neondb_owner:npg_uDVIUF1n0Zje@ep-muddy-silence-a2o47z8h-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const KICKOFF_ID = "6eecebca-2cba-4739-b635-b2370786e041";

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function main() {
  const allDomains = await db.select().from(domains).where(eq(domains.planningId, KICKOFF_ID));
  const allLots    = await db.select().from(lots).where(eq(lots.planningId, KICKOFF_ID));

  const domB       = allDomains.find(d => d.code === "SCENARIOB")!;
  const lotsB      = allLots.filter(l => l.domainId === domB.id);
  const lotB_rec   = lotsB.find(l => l.name.includes("Recette"))!;

  // Supprimer toutes les phases du lot Recette B
  await db.delete(phases).where(eq(phases.lotId, lotB_rec.id));

  // Durées calées sur Scénario A (ou plus longues — Scénario B = réaliste)
  // A : unitaire 14j | Run1 14j | Corrections 7j | Run2 7j | StabRun3 7j
  // B : unitaire 14j | Run1 14j | Corrections 7j | Run2 14j | StabRun3 7j  ← B a plus de temps sur Run2
  //
  // Calendrier B (dev finit Nov 16) :
  //   Unitaire      : Nov 16 → Nov 30  (14j)
  //   Run 1         : Nov 30 → Dec 14  (14j)
  //   Corrections 1 : Dec 14 → Dec 20  ( 6j — avant congés Noël 21/12)
  //   [Congés Noël] : Dec 21 → Jan 04  (bande de fermeture)
  //   Run 2         : Jan 05 → Jan 19  (14j — B a 14j, A n'avait que 7j)
  //   Stabilisation : Jan 19 → Jan 26  ( 7j)

  await db.insert(phases).values([
    {
      lotId:     lotB_rec.id,
      type:      "recette",
      label:     "Recette unitaire MASAO",
      startDate: "2026-11-16",
      endDate:   "2026-11-30",   // 14j — identique à Scénario A
      color:     "#16A34A",
      progress:  0,
      sortOrder: 0,
    },
    {
      lotId:     lotB_rec.id,
      type:      "recette",
      label:     "Recette métier Run 1",
      startDate: "2026-11-30",
      endDate:   "2026-12-14",   // 14j
      color:     "#16A34A",
      progress:  0,
      sortOrder: 1,
    },
    {
      lotId:     lotB_rec.id,
      type:      "custom",
      label:     "Corrections Run 1",
      startDate: "2026-12-14",
      endDate:   "2026-12-20",   // 6j — s'arrête avant les congés Noël
      color:     "#4ADE80",
      progress:  0,
      sortOrder: 2,
    },
    // Congés Noël 21/12 → 04/01 : bande closure déjà affichée, pas de phase
    {
      lotId:     lotB_rec.id,
      type:      "recette",
      label:     "Recette métier Run 2",
      startDate: "2027-01-05",
      endDate:   "2027-01-19",   // 14j — B a plus de temps que A (7j) ✓
      color:     "#16A34A",
      progress:  0,
      sortOrder: 3,
    },
    {
      lotId:     lotB_rec.id,
      type:      "custom",
      label:     "Corrections & stabilisation Run 3",
      startDate: "2027-01-19",
      endDate:   "2027-01-26",   // 7j — identique à Scénario A
      color:     "#4ADE80",
      progress:  0,
      sortOrder: 4,
    },
  ]);

  console.log("✅ Recette Scénario B corrigée :");
  console.log("   Recette unitaire  : Nov 16 → Nov 30 (14j = A)");
  console.log("   Run 1             : Nov 30 → Dec 14 (14j = A)");
  console.log("   Corrections Run 1 : Dec 14 → Dec 20 ( 6j)");
  console.log("   [Congés Noël]     : Dec 21 → Jan 04");
  console.log("   Run 2             : Jan 05 → Jan 19 (14j > A 7j) ✓");
  console.log("   Stabilisation     : Jan 19 → Jan 26 ( 7j = A)");
  console.log("\n   URL : https://klint-planning.vercel.app/p/" + KICKOFF_ID);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
