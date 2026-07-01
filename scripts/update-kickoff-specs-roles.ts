/**
 * update-kickoff-specs-roles.ts
 *
 * Scénario A :
 *   - Ajout jalon "Signature des Specs" (30/09)
 *   - Déplacement "Rôles & droits" du lot Recette → Dev (parallèle au dev)
 *
 * Scénario B :
 *   - Séparation EDB (MOA, Sep 18→30) / Specs MASAO (Sep 30→Oct 12)
 *   - Jalons Signature EDB (30/09) + Signature Specs (12/10)
 *   - Dev B2B : Oct 13→Nov 16 (34j = même durée que Scén. A)
 *   - YPAREO : Oct 30→Nov 16 (18j = même durée que Scén. A)
 *   - Rôles & droits parallèle au dev (Oct 13→Nov 16)
 *   - Cascade Recette / Formation / MEP depuis la fin dev (Nov 16)
 *   - MEP : 09/02/2027
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const { domains, lots, phases, milestones } = schema;

const DATABASE_URL = "postgresql://neondb_owner:npg_uDVIUF1n0Zje@ep-muddy-silence-a2o47z8h-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const KICKOFF_ID = "6eecebca-2cba-4739-b635-b2370786e041";

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function main() {
  const allDomains = await db.select().from(domains).where(eq(domains.planningId, KICKOFF_ID));
  const allLots    = await db.select().from(lots).where(eq(lots.planningId, KICKOFF_ID));

  const domA = allDomains.find(d => d.code === "SCENARIOA")!;
  const domB = allDomains.find(d => d.code === "SCENARIOB")!;

  const lotsA = allLots.filter(l => l.domainId === domA.id);
  const lotsB = allLots.filter(l => l.domainId === domB.id);

  const lotA_cadrage = lotsA.find(l => l.name.includes("Cadrage"))!;
  const lotA_dev     = lotsA.find(l => l.name.includes("Développement"))!;
  const lotA_recette = lotsA.find(l => l.name.includes("Recette"))!;

  const lotB_cadrage = lotsB.find(l => l.name.includes("Cadrage"))!;
  const lotB_dev     = lotsB.find(l => l.name.includes("Développement"))!;
  const lotB_recette = lotsB.find(l => l.name.includes("Recette"))!;
  const lotB_form    = lotsB.find(l => l.name.includes("Formation"))!;
  const lotB_mep     = lotsB.find(l => l.name.includes("Mise en production"))!;

  // ═══════════════════════════════════════════════════════════════
  // SCÉNARIO A
  // ═══════════════════════════════════════════════════════════════

  // 1. Jalon "Signature des Specs" dans Cadrage A (après les 15j de specs MASAO)
  await db.insert(milestones).values({
    lotId:    lotA_cadrage.id,
    type:     "signature",
    label:    "Signature des Specs",
    date:     "2026-09-30",
    color:    "#D97706",
    labelPos: "below",
  });
  console.log("✅ A — Jalon Signature Specs ajouté (30/09)");

  // 2. Supprimer "Rôles & droits" du lot Recette A
  const recetteAPhasesRaw = await db.select().from(phases).where(eq(phases.lotId, lotA_recette.id));
  const rolesPhaseA = recetteAPhasesRaw.find(p => p.label?.includes("rôles"));
  if (rolesPhaseA) {
    await db.delete(phases).where(eq(phases.id, rolesPhaseA.id));
    console.log("✅ A — Rôles & droits supprimé du lot Recette");
  } else {
    console.log("ℹ️  A — Phase Rôles & droits non trouvée en Recette (déjà supprimée ?)");
  }

  // 3. Ajouter "Rôles & droits" dans le lot Dev A (parallèle au dev)
  await db.insert(phases).values({
    lotId:     lotA_dev.id,
    type:      "custom",
    label:     "Mise en place des rôles et droits",
    startDate: "2026-09-15",
    endDate:   "2026-10-19",
    color:     "#F97316",
    progress:  0,
    sortOrder: 10,
    note:      "Réalisé par MASAO en parallèle du dev — nécessaire avant la livraison en recette.",
  });
  console.log("✅ A — Rôles & droits ajouté dans Dev (Sep 15 → Oct 19)");

  // ═══════════════════════════════════════════════════════════════
  // SCÉNARIO B — Cadrage
  // ═══════════════════════════════════════════════════════════════

  // 4. Supprimer "Rédaction EDB & Specs MASAO" (phase combinée)
  const cadrageBPhases = await db.select().from(phases).where(eq(phases.lotId, lotB_cadrage.id));
  const combinedPhase  = cadrageBPhases.find(p => p.label?.includes("EDB & Specs") || p.label?.includes("EDB et Specs") || (p.label?.includes("EDB") && p.label?.includes("Specs")));
  if (combinedPhase) {
    await db.delete(phases).where(eq(phases.id, combinedPhase.id));
    console.log("✅ B — Phase EDB & Specs combinée supprimée");
  } else {
    console.log("ℹ️  B — Phase EDB & Specs combinée non trouvée (peut-être déjà séparée ?)");
    // Log current cadrage phases for debug
    console.log("   Phases cadrage B :", cadrageBPhases.map(p => p.label));
  }

  // 5. Ajouter EDB (MOA) + Specs MASAO séparées
  await db.insert(phases).values([
    {
      lotId:     lotB_cadrage.id,
      type:      "cadrage",
      label:     "Rédaction EDB (MOA)",
      startDate: "2026-09-18",
      endDate:   "2026-09-30",
      color:     "#16A34A",
      progress:  0,
      sortOrder: 10,
      note:      "Rédaction formelle de l'EDB par la MOA après validation des ateliers.",
    },
    {
      lotId:     lotB_cadrage.id,
      type:      "cadrage",
      label:     "Specs MASAO",
      startDate: "2026-09-30",
      endDate:   "2026-10-12",
      color:     "#22C55E",
      progress:  0,
      sortOrder: 11,
      note:      "Rédaction des specs techniques par MASAO à partir de l'EDB signé — 12 jours.",
    },
  ]);

  // 6. Mettre à jour le jalon Signature EDB (était Sep 18, passe à Sep 30 après rédaction)
  const cadrageBMs = await db.select().from(milestones).where(eq(milestones.lotId, lotB_cadrage.id));
  const sigEDB_B   = cadrageBMs.find(m => m.label?.includes("Signature EDB"));
  if (sigEDB_B) {
    await db.delete(milestones).where(eq(milestones.id, sigEDB_B.id));
  }
  await db.insert(milestones).values([
    { lotId: lotB_cadrage.id, type: "signature", label: "Signature EDB",      date: "2026-09-30", color: "#F59E0B", labelPos: "above" },
    { lotId: lotB_cadrage.id, type: "signature", label: "Signature des Specs", date: "2026-10-12", color: "#D97706", labelPos: "below" },
  ]);
  console.log("✅ B — EDB/Specs séparés + jalons Signature EDB (30/09) & Specs (12/10)");

  // ═══════════════════════════════════════════════════════════════
  // SCÉNARIO B — Développement (34j, même durée que A)
  // ═══════════════════════════════════════════════════════════════

  await db.delete(phases).where(eq(phases.lotId, lotB_dev.id));
  await db.delete(milestones).where(eq(milestones.lotId, lotB_dev.id));

  await db.insert(phases).values([
    {
      lotId:     lotB_dev.id,
      type:      "dev",
      label:     "Développements B2B (275j parallélisés)",
      startDate: "2026-10-13",
      endDate:   "2026-11-16",
      color:     "#16A34A",
      progress:  0,
      sortOrder: 0,
    },
    {
      lotId:     lotB_dev.id,
      type:      "dev",
      label:     "Interfaces YPAREO + EAI",
      startDate: "2026-10-30",
      endDate:   "2026-11-16",
      color:     "#22C55E",
      progress:  0,
      sortOrder: 1,
    },
    {
      lotId:     lotB_dev.id,
      type:      "custom",
      label:     "Mise en place des rôles et droits",
      startDate: "2026-10-13",
      endDate:   "2026-11-16",
      color:     "#F97316",
      progress:  0,
      sortOrder: 2,
      note:      "Réalisé par MASAO en parallèle du dev — nécessaire avant la livraison en recette.",
    },
  ]);
  await db.insert(milestones).values({
    lotId:    lotB_dev.id,
    type:     "delivrable",
    label:    "Livraison Dev",
    date:     "2026-11-16",
    color:    "#16A34A",
    labelPos: "above",
  });
  console.log("✅ B — Dev 34j (Oct 13 → Nov 16) + Rôles & droits parallèle");

  // ═══════════════════════════════════════════════════════════════
  // SCÉNARIO B — Recette (cascade depuis Nov 16)
  // ═══════════════════════════════════════════════════════════════

  await db.delete(phases).where(eq(phases.lotId, lotB_recette.id));
  await db.delete(milestones).where(eq(milestones.lotId, lotB_recette.id));

  await db.insert(phases).values([
    {
      lotId:     lotB_recette.id, type: "recette",
      label:     "Recette unitaire MASAO",
      startDate: "2026-11-16", endDate: "2026-11-23",
      color: "#16A34A", progress: 0, sortOrder: 0,
    },
    {
      lotId:     lotB_recette.id, type: "recette",
      label:     "Recette métier Run 1",
      startDate: "2026-11-23", endDate: "2026-12-07",
      color: "#16A34A", progress: 0, sortOrder: 1,
    },
    {
      lotId:     lotB_recette.id, type: "custom",
      label:     "Corrections Run 1",
      startDate: "2026-12-07", endDate: "2026-12-14",
      color: "#4ADE80", progress: 0, sortOrder: 2,
    },
    {
      lotId:     lotB_recette.id, type: "recette",
      label:     "Recette métier Run 2",
      startDate: "2026-12-14", endDate: "2026-12-20",
      color: "#16A34A", progress: 0, sortOrder: 3,
    },
    // Congés Noël : 21/12 → 04/01 — bande de fermeture déjà affichée, pas de phase
    {
      lotId:     lotB_recette.id, type: "custom",
      label:     "Corrections & stabilisation Run 3",
      startDate: "2027-01-05", endDate: "2027-01-12",
      color: "#4ADE80", progress: 0, sortOrder: 4,
    },
  ]);
  console.log("✅ B — Recette mise à jour (Nov 16 → Jan 12, Noël respecté)");

  // ═══════════════════════════════════════════════════════════════
  // SCÉNARIO B — Formation (cascade depuis Jan 05)
  // ═══════════════════════════════════════════════════════════════

  await db.delete(phases).where(eq(phases.lotId, lotB_form.id));

  await db.insert(phases).values([
    {
      lotId:     lotB_form.id, type: "formation",
      label:     "Formation admins CÉOS (Almavia + MASAO)",
      startDate: "2027-01-05", endDate: "2027-01-26",
      color: "#16A34A", progress: 0, sortOrder: 0,
    },
    {
      lotId:     lotB_form.id, type: "formation",
      label:     "Formation chefs de projet écoles",
      startDate: "2027-01-05", endDate: "2027-01-26",
      color: "#22C55E", progress: 0, sortOrder: 1,
    },
    {
      lotId:     lotB_form.id, type: "formation",
      label:     "Formation utilisateurs finaux",
      startDate: "2027-01-19", endDate: "2027-02-02",
      color: "#4ADE80", progress: 0, sortOrder: 2,
    },
  ]);
  console.log("✅ B — Formation mise à jour (Jan 05 → Feb 02)");

  // ═══════════════════════════════════════════════════════════════
  // SCÉNARIO B — MEP (MEP = 09/02/2027, inchangé)
  // ═══════════════════════════════════════════════════════════════

  await db.delete(phases).where(eq(phases.lotId, lotB_mep.id));
  await db.delete(milestones).where(eq(milestones.lotId, lotB_mep.id));

  await db.insert(phases).values({
    lotId:     lotB_mep.id, type: "custom",
    label:     "Préparation MEP",
    startDate: "2027-02-02", endDate: "2027-02-09",
    color: "#16A34A", progress: 0, sortOrder: 0,
  });
  await db.insert(milestones).values({
    lotId:    lotB_mep.id,
    type:     "mep",
    label:    "MEP Go Live — B",
    date:     "2027-02-09",
    color:    "#16A34A",
    labelPos: "above",
  });
  console.log("✅ B — MEP 09/02/2027 confirmé");

  console.log("\n✅ Toutes les mises à jour appliquées !");
  console.log("   URL : https://klint-planning.vercel.app/p/" + KICKOFF_ID);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
