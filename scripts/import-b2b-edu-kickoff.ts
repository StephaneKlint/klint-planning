import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const {
  plannings, planningSettings, phaseTypes, milestoneTypes,
  statuses, domains, lots, phases, milestones,
} = schema;

const DATABASE_URL = "postgresql://neondb_owner:npg_uDVIUF1n0Zje@ep-muddy-silence-a2o47z8h-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function main() {
  // 1. Planning
  const [newP] = await db.insert(plannings).values({
    name:          "B2B EDU — Kickoff Comparatif",
    type:          "multi",
    year:          2026,
    viewStart:     "2026-07-01",
    viewEnd:       "2027-03-15",
    description:   "Planning comparatif Kickoff — Scénario A (Resserré / MEP déc.) vs Scénario B (Réaliste / MEP fév.)",
    referenceDate: "2026-07-08",
  }).returning({ id: plannings.id });
  const pid = newP.id;
  console.log("Planning créé :", pid);

  try {
    // 2. Settings
    await db.insert(planningSettings).values({
      planningId:            pid,
      autoLate:              true,
      autoCloseAfterMepDays: 30,
      notifyOnLate:          true,
    });

    // 3. Phase types
    await db.insert(phaseTypes).values([
      { planningId: pid, code: "cadrage",   label: "Cadrage",        sortOrder: 0 },
      { planningId: pid, code: "dev",       label: "Développement",  sortOrder: 1 },
      { planningId: pid, code: "recette",   label: "Recette",        sortOrder: 2 },
      { planningId: pid, code: "formation", label: "Formation",       sortOrder: 3 },
      { planningId: pid, code: "atelier",   label: "Atelier",        sortOrder: 4 },
      { planningId: pid, code: "custom",    label: "Personnalisé",   sortOrder: 5 },
    ]);

    // 4. Milestone types
    await db.insert(milestoneTypes).values([
      { planningId: pid, code: "kickoff",    label: "Kickoff",         color: "#001036", sortOrder: 0 },
      { planningId: pid, code: "mep",        label: "MEP Go Live",     color: "#7C3AED", sortOrder: 1 },
      { planningId: pid, code: "signature",  label: "Signature",       color: "#F59E0B", sortOrder: 2 },
      { planningId: pid, code: "delivrable", label: "Livrable",        color: "#0EA5E9", sortOrder: 3 },
      { planningId: pid, code: "custom",     label: "Jalon",           color: "#6B7280", sortOrder: 4 },
    ]);

    // 5. Statuses
    await db.insert(statuses).values([
      { planningId: pid, code: "planned",     label: "Planifié",       color: "#374151", bg: "#F3F4F6", sortOrder: 0 },
      { planningId: pid, code: "in_progress", label: "En cours",       color: "#1D4ED8", bg: "#DBEAFE", sortOrder: 1 },
      { planningId: pid, code: "done",        label: "Terminé",        color: "#15803D", bg: "#DCFCE7", sortOrder: 2 },
      { planningId: pid, code: "risk",        label: "À risque",       color: "#B45309", bg: "#FEF3C7", sortOrder: 3 },
      { planningId: pid, code: "late",        label: "En retard",      color: "#DC2626", bg: "#FEE2E2", sortOrder: 4 },
    ]);

    // ──────────────────────────────────────────────────────────────────────
    // DOMAINE A — Scénario A : Resserré / Ambitieux (rouge)
    // ──────────────────────────────────────────────────────────────────────
    const [domA] = await db.insert(domains).values({
      planningId: pid,
      code:       "SCENARIOA",
      name:       "Scénario A — Resserré / Ambitieux",
      bg:         "#FEF2F2",
      bgAlt:      "#FFF5F5",
      strong:     "#DC2626",
      phaseColor: "#DC2626",
      sortOrder:  0,
      collapsed:  false,
      cadence:    { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    // --- Lot A : Cadrage & EDB
    const [lotA1] = await db.insert(lots).values({
      planningId: pid, domainId: domA.id,
      name: "Cadrage & EDB", sortOrder: 0, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotA1.id, type: "cadrage", label: "Ateliers cadrage — bloc juillet (ATL-01→07)", startDate: "2026-07-08", endDate: "2026-07-31", color: "#DC2626", progress: 0, sortOrder: 0 },
      { lotId: lotA1.id, type: "cadrage", label: "Rédaction EDB & Specs MASAO ⚠ sans MOA",     startDate: "2026-08-01", endDate: "2026-09-14", color: "#DC2626", progress: 0, sortOrder: 1 },
      { lotId: lotA1.id, type: "cadrage", label: "Ateliers cadrage — bloc sept. (ATL-08→15)",  startDate: "2026-09-07", endDate: "2026-09-14", color: "#DC2626", progress: 0, sortOrder: 2 },
    ]);
    await db.insert(milestones).values([
      { lotId: lotA1.id, type: "kickoff",   label: "Kickoff",        date: "2026-07-08", color: "#001036", labelPos: "above" },
      { lotId: lotA1.id, type: "signature", label: "Signature EDB",  date: "2026-09-14", color: "#F59E0B", labelPos: "above" },
    ]);

    // --- Lot A : Développement
    const [lotA2] = await db.insert(lots).values({
      planningId: pid, domainId: domA.id,
      name: "Développement", sortOrder: 1, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotA2.id, type: "dev", label: "Développements B2B (275j — démarrage partiel)", startDate: "2026-08-17", endDate: "2026-10-19", color: "#DC2626", progress: 0, sortOrder: 0 },
      { lotId: lotA2.id, type: "dev", label: "Interfaces YPAREO + EAI",                       startDate: "2026-09-07", endDate: "2026-10-19", color: "#EF4444", progress: 0, sortOrder: 1 },
    ]);
    await db.insert(milestones).values([
      { lotId: lotA2.id, type: "delivrable", label: "Livraison Dev", date: "2026-10-19", color: "#DC2626", labelPos: "above" },
    ]);

    // --- Lot A : Recette
    const [lotA3] = await db.insert(lots).values({
      planningId: pid, domainId: domA.id,
      name: "Recette", sortOrder: 2, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotA3.id, type: "recette", label: "Recette unitaire MASAO",          startDate: "2026-10-19", endDate: "2026-11-02", color: "#DC2626", progress: 0, sortOrder: 0 },
      { lotId: lotA3.id, type: "recette", label: "Recette métier Run 1",             startDate: "2026-11-02", endDate: "2026-11-16", color: "#DC2626", progress: 0, sortOrder: 1 },
      { lotId: lotA3.id, type: "custom",  label: "Corrections Run 1",                startDate: "2026-11-16", endDate: "2026-11-23", color: "#F87171", progress: 0, sortOrder: 2 },
      { lotId: lotA3.id, type: "recette", label: "Recette métier Run 2",             startDate: "2026-11-23", endDate: "2026-12-07", color: "#DC2626", progress: 0, sortOrder: 3 },
      { lotId: lotA3.id, type: "custom",  label: "Corrections & stabilisation Run 3", startDate: "2026-12-07", endDate: "2026-12-14", color: "#F87171", progress: 0, sortOrder: 4 },
    ]);

    // --- Lot A : Formation
    const [lotA4] = await db.insert(lots).values({
      planningId: pid, domainId: domA.id,
      name: "Formation", sortOrder: 3, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotA4.id, type: "formation", label: "Formation admins CÉOS (Almavia + MASAO)", startDate: "2026-11-23", endDate: "2026-12-07", color: "#DC2626", progress: 0, sortOrder: 0 },
      { lotId: lotA4.id, type: "formation", label: "Formation chefs de projet écoles",         startDate: "2026-11-23", endDate: "2026-12-07", color: "#EF4444", progress: 0, sortOrder: 1 },
      { lotId: lotA4.id, type: "formation", label: "Formation utilisateurs finaux",            startDate: "2026-12-01", endDate: "2026-12-14", color: "#F87171", progress: 0, sortOrder: 2 },
    ]);

    // --- Lot A : MEP
    const [lotA5] = await db.insert(lots).values({
      planningId: pid, domainId: domA.id,
      name: "Mise en production", sortOrder: 4, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotA5.id, type: "custom", label: "Préparation MEP", startDate: "2026-12-14", endDate: "2026-12-17", color: "#DC2626", progress: 0, sortOrder: 0 },
    ]);
    await db.insert(milestones).values([
      { lotId: lotA5.id, type: "mep", label: "MEP Go Live — A", date: "2026-12-17", color: "#DC2626", labelPos: "above" },
    ]);

    console.log("  ✅ Scénario A importé");

    // ──────────────────────────────────────────────────────────────────────
    // DOMAINE B — Scénario B : Réaliste / Sécurisé (vert)
    // ──────────────────────────────────────────────────────────────────────
    const [domB] = await db.insert(domains).values({
      planningId: pid,
      code:       "SCENARIOB",
      name:       "Scénario B — Réaliste / Sécurisé",
      bg:         "#F0FDF4",
      bgAlt:      "#ECFDF5",
      strong:     "#16A34A",
      phaseColor: "#16A34A",
      sortOrder:  1,
      collapsed:  false,
      cadence:    { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    // --- Lot B : Cadrage & EDB
    const [lotB1] = await db.insert(lots).values({
      planningId: pid, domainId: domB.id,
      name: "Cadrage & EDB", sortOrder: 0, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotB1.id, type: "cadrage", label: "Ateliers cadrage — bloc juillet (ATL-01→02)", startDate: "2026-07-16", endDate: "2026-07-21", color: "#16A34A", progress: 0, sortOrder: 0 },
      { lotId: lotB1.id, type: "cadrage", label: "Ateliers cadrage — bloc sept. (ATL-03→15)",  startDate: "2026-09-08", endDate: "2026-09-18", color: "#16A34A", progress: 0, sortOrder: 1 },
      { lotId: lotB1.id, type: "cadrage", label: "Rédaction EDB & Specs MASAO",                startDate: "2026-09-18", endDate: "2026-10-12", color: "#16A34A", progress: 0, sortOrder: 2 },
    ]);
    await db.insert(milestones).values([
      { lotId: lotB1.id, type: "kickoff",   label: "Kickoff",        date: "2026-07-08", color: "#001036", labelPos: "above" },
      { lotId: lotB1.id, type: "signature", label: "Signature EDB",  date: "2026-09-18", color: "#F59E0B", labelPos: "above" },
    ]);

    // --- Lot B : Développement
    const [lotB2] = await db.insert(lots).values({
      planningId: pid, domainId: domB.id,
      name: "Développement", sortOrder: 1, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotB2.id, type: "dev", label: "Développements B2B (275j parallélisés)", startDate: "2026-10-13", endDate: "2026-11-02", color: "#16A34A", progress: 0, sortOrder: 0 },
      { lotId: lotB2.id, type: "dev", label: "Interfaces YPAREO + EAI",                startDate: "2026-10-20", endDate: "2026-11-02", color: "#22C55E", progress: 0, sortOrder: 1 },
    ]);
    await db.insert(milestones).values([
      { lotId: lotB2.id, type: "delivrable", label: "Livraison Dev", date: "2026-11-02", color: "#16A34A", labelPos: "above" },
    ]);

    // --- Lot B : Recette
    const [lotB3] = await db.insert(lots).values({
      planningId: pid, domainId: domB.id,
      name: "Recette", sortOrder: 2, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotB3.id, type: "recette", label: "Recette unitaire MASAO",            startDate: "2026-11-02", endDate: "2026-11-16", color: "#16A34A", progress: 0, sortOrder: 0 },
      { lotId: lotB3.id, type: "recette", label: "Recette métier Run 1",               startDate: "2026-11-16", endDate: "2026-11-30", color: "#16A34A", progress: 0, sortOrder: 1 },
      { lotId: lotB3.id, type: "custom",  label: "Corrections Run 1",                  startDate: "2026-11-30", endDate: "2026-12-07", color: "#4ADE80", progress: 0, sortOrder: 2 },
      { lotId: lotB3.id, type: "recette", label: "Recette métier Run 2",               startDate: "2026-12-07", endDate: "2026-12-21", color: "#16A34A", progress: 0, sortOrder: 3 },
      { lotId: lotB3.id, type: "custom",  label: "— Congés Noël —",                   startDate: "2026-12-21", endDate: "2027-01-04", color: "#D1D5DB", progress: 0, sortOrder: 4, note: "Aucune activité prévue pendant cette période." },
      { lotId: lotB3.id, type: "custom",  label: "Corrections & stabilisation Run 3",  startDate: "2027-01-05", endDate: "2027-01-19", color: "#4ADE80", progress: 0, sortOrder: 5 },
    ]);

    // --- Lot B : Formation
    const [lotB4] = await db.insert(lots).values({
      planningId: pid, domainId: domB.id,
      name: "Formation", sortOrder: 3, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotB4.id, type: "formation", label: "Formation admins CÉOS (Almavia + MASAO)", startDate: "2027-01-12", endDate: "2027-02-02", color: "#16A34A", progress: 0, sortOrder: 0 },
      { lotId: lotB4.id, type: "formation", label: "Formation chefs de projet écoles",         startDate: "2027-01-12", endDate: "2027-02-02", color: "#22C55E", progress: 0, sortOrder: 1 },
      { lotId: lotB4.id, type: "formation", label: "Formation utilisateurs finaux",            startDate: "2027-01-19", endDate: "2027-02-02", color: "#4ADE80", progress: 0, sortOrder: 2 },
    ]);

    // --- Lot B : MEP
    const [lotB5] = await db.insert(lots).values({
      planningId: pid, domainId: domB.id,
      name: "Mise en production", sortOrder: 4, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      { lotId: lotB5.id, type: "custom", label: "Préparation MEP", startDate: "2027-02-02", endDate: "2027-02-09", color: "#16A34A", progress: 0, sortOrder: 0 },
    ]);
    await db.insert(milestones).values([
      { lotId: lotB5.id, type: "mep", label: "MEP Go Live — B", date: "2027-02-09", color: "#16A34A", labelPos: "above" },
    ]);

    console.log("  ✅ Scénario B importé");

    // ──────────────────────────────────────────────────────────────────────
    // DOMAINE ATELIERS — commun, daté par scénario (bleu)
    // ──────────────────────────────────────────────────────────────────────
    const [domAt] = await db.insert(domains).values({
      planningId: pid,
      code:       "ATELIERS",
      name:       "Ateliers métier — 15 ateliers × 3h",
      bg:         "#EFF6FF",
      bgAlt:      "#EBF4FF",
      strong:     "#2563EB",
      phaseColor: "#2563EB",
      sortOrder:  2,
      collapsed:  false,
      cadence:    { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    // --- Lot : Ateliers Scénario A
    const [lotAt1] = await db.insert(lots).values({
      planningId: pid, domainId: domAt.id,
      name: "Ateliers — Scén. A (3/sem. en juillet ⚠)", sortOrder: 0, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      {
        lotId: lotAt1.id, type: "atelier",
        label: "Bloc juillet — ATL-01→07 (3 ateliers/semaine ⚠ fermeture écoles dès 17/07)",
        startDate: "2026-07-09", endDate: "2026-07-31",
        color: "#2563EB", progress: 0, sortOrder: 0,
        note: "ATL-01 Audit CÉOS EDU B2C | ATL-02 FC INTER | ATL-03 FC INTRA | ATL-04 Entreprises & Contacts | ATL-05 Catalogue FC | ATL-06 Financement OPCO/CPF | ATL-07 Annulations. ⚠ Fermeture certaines écoles dès le 17/07 — présences incertaines.",
      },
      {
        lotId: lotAt1.id, type: "atelier",
        label: "Bloc septembre — ATL-08→15 (clôture EDB)",
        startDate: "2026-09-07", endDate: "2026-09-30",
        color: "#3B82F6", progress: 0, sortOrder: 1,
        note: "ATL-08 Marketing & leads FC | ATL-09 Suivi post-formation | ATL-10 Intégration YPAREO (DSI requis) | ATL-11 EAI & interfaces | ATL-12 Reprise données | ATL-13 Indicateurs & Reporting | ATL-14 Accès & profils | ATL-15 Restitution EDB.",
      },
    ]);
    await db.insert(milestones).values([
      { lotId: lotAt1.id, type: "signature", label: "ATL-15 Restitution EDB", date: "2026-09-30", color: "#2563EB", labelPos: "above" },
    ]);

    // --- Lot : Ateliers Scénario B
    const [lotAt2] = await db.insert(lots).values({
      planningId: pid, domainId: domAt.id,
      name: "Ateliers — Scén. B (rythme soutenable ✓)", sortOrder: 1, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      {
        lotId: lotAt2.id, type: "atelier",
        label: "Bloc juillet — ATL-01→02 (1 atelier/semaine)",
        startDate: "2026-07-16", endDate: "2026-07-21",
        color: "#2563EB", progress: 0, sortOrder: 0,
        note: "ATL-01 Audit CÉOS EDU B2C | ATL-02 FC INTER. Rythme soutenable — aucune contrainte de fermeture.",
      },
      {
        lotId: lotAt2.id, type: "atelier",
        label: "Bloc septembre — ATL-03→15 (2 ateliers/semaine)",
        startDate: "2026-09-08", endDate: "2026-10-20",
        color: "#3B82F6", progress: 0, sortOrder: 1,
        note: "ATL-03→15 — rythme 2/semaine, validation MOA disponible, DSI plus de marge sur ATL-10/11.",
      },
    ]);
    await db.insert(milestones).values([
      { lotId: lotAt2.id, type: "signature", label: "ATL-15 Restitution EDB", date: "2026-10-20", color: "#2563EB", labelPos: "above" },
    ]);

    console.log("  ✅ Ateliers importés");
    console.log("\n✅ Planning Kickoff Comparatif importé avec succès !");
    console.log("   ID      :", pid);
    console.log("   URL     : https://klint-planning.vercel.app/p/" + pid);

  } catch (err) {
    await db.delete(plannings).where(eq(plannings.id, pid)).catch(() => {});
    console.error("❌ Erreur — rollback effectué :", err);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
