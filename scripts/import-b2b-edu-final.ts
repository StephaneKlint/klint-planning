/**
 * import-b2b-edu-final.ts
 * Planning définitif : "B2B EDU — Formation Inter & Intra"
 * Basé sur Scénario B (réaliste), MEP 09/02/2027.
 * Ateliers intégrés dans le domaine Cadrage (15 jalons avec thèmes).
 * Rôles & droits inclus dans le lot Développements B2B (pas de lot séparé).
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const {
  plannings, planningSettings, phaseTypes, milestoneTypes,
  statuses, domains, lots, phases, milestones, closurePeriods,
} = schema;

const DATABASE_URL = "postgresql://neondb_owner:npg_uDVIUF1n0Zje@ep-muddy-silence-a2o47z8h-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function main() {
  // ── Planning ────────────────────────────────────────────────────────────
  const [newP] = await db.insert(plannings).values({
    name:          "B2B EDU — Formation Inter & Intra",
    type:          "multi",
    year:          2026,
    viewStart:     "2026-07-01",
    viewEnd:       "2027-03-15",
    description:   "CRM CÉOS BtoB EDU — Formation Continue Inter & Intra. MEP cible : 09/02/2027.",
    referenceDate: "2026-07-08",
  }).returning({ id: plannings.id });
  const pid = newP.id;
  console.log("Planning créé :", pid);

  try {
    // ── Settings ────────────────────────────────────────────────────────────
    await db.insert(planningSettings).values({
      planningId: pid, autoLate: true, autoCloseAfterMepDays: 30, notifyOnLate: true,
    });

    // ── Phase types ─────────────────────────────────────────────────────────
    await db.insert(phaseTypes).values([
      { planningId: pid, code: "cadrage",   label: "Cadrage",       sortOrder: 0 },
      { planningId: pid, code: "dev",       label: "Développement", sortOrder: 1 },
      { planningId: pid, code: "recette",   label: "Recette",       sortOrder: 2 },
      { planningId: pid, code: "formation", label: "Formation",     sortOrder: 3 },
      { planningId: pid, code: "custom",    label: "Autre",         sortOrder: 4 },
    ]);

    // ── Milestone types ─────────────────────────────────────────────────────
    await db.insert(milestoneTypes).values([
      { planningId: pid, code: "kickoff",    label: "Kickoff",          color: "#001036", sortOrder: 0 },
      { planningId: pid, code: "atelier",    label: "Atelier",          color: "#6366F1", sortOrder: 1 },
      { planningId: pid, code: "signature",  label: "Signature",        color: "#F59E0B", sortOrder: 2 },
      { planningId: pid, code: "delivrable", label: "Livrable",         color: "#0EA5E9", sortOrder: 3 },
      { planningId: pid, code: "mep",        label: "MEP Go Live",      color: "#16A34A", sortOrder: 4 },
      { planningId: pid, code: "custom",     label: "Jalon",            color: "#6B7280", sortOrder: 5 },
    ]);

    // ── Statuses ────────────────────────────────────────────────────────────
    await db.insert(statuses).values([
      { planningId: pid, code: "planned",     label: "Planifié",   color: "#374151", bg: "#F3F4F6", sortOrder: 0 },
      { planningId: pid, code: "in_progress", label: "En cours",   color: "#1D4ED8", bg: "#DBEAFE", sortOrder: 1 },
      { planningId: pid, code: "done",        label: "Terminé",    color: "#15803D", bg: "#DCFCE7", sortOrder: 2 },
      { planningId: pid, code: "risk",        label: "À risque",   color: "#B45309", bg: "#FEF3C7", sortOrder: 3 },
      { planningId: pid, code: "late",        label: "En retard",  color: "#DC2626", bg: "#FEE2E2", sortOrder: 4 },
    ]);

    // ── Closure periods ─────────────────────────────────────────────────────
    await db.insert(closurePeriods).values([
      { planningId: pid, label: "Congés été",  startDate: "2026-08-08", endDate: "2026-08-30", color: "#FEF9C3", type: "custom", active: true, sortOrder: 0 },
      { planningId: pid, label: "Congés Noël", startDate: "2026-12-21", endDate: "2027-01-04", color: "#DBEAFE", type: "custom", active: true, sortOrder: 1 },
    ]);

    // ════════════════════════════════════════════════════════════════════════
    // DOMAINE 1 — CADRAGE (#1E3A5F / indigo)
    // ════════════════════════════════════════════════════════════════════════
    const [domCad] = await db.insert(domains).values({
      planningId: pid, code: "CADRAGE",
      name: "Cadrage & Spécifications",
      bg: "#EEF2FF", bgAlt: "#E8EDFF", strong: "#3730A3", phaseColor: "#4F46E5",
      sortOrder: 0, collapsed: false,
      cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    // ── Lot : Ateliers métier (jalons individuels par atelier) ──────────────
    const [lotAtl] = await db.insert(lots).values({
      planningId: pid, domainId: domCad.id,
      name: "Ateliers métier — 15 ateliers × 3h (9h–12h)", sortOrder: 0, hidden: false,
    }).returning({ id: lots.id });

    // Phase bloc pour visualiser les 2 fenêtres d'ateliers
    await db.insert(phases).values([
      {
        lotId: lotAtl.id, type: "cadrage",
        label: "Bloc juillet (ATL-01→02)",
        startDate: "2026-07-09", endDate: "2026-07-16",
        color: "#4F46E5", progress: 0, sortOrder: 0,
        note: "2 ateliers uniquement — fermeture écoles dès le 17/07.",
      },
      {
        lotId: lotAtl.id, type: "cadrage",
        label: "Bloc août–octobre (ATL-03→15)",
        startDate: "2026-08-31", endDate: "2026-10-12",
        color: "#6366F1", progress: 0, sortOrder: 1,
        note: "13 ateliers — rythme 2/semaine (lundi + jeudi). ATL-15 = Restitution EDB.",
      },
    ]);

    // Jalons individuels (1 par atelier)
    await db.insert(milestones).values([
      { lotId: lotAtl.id, type: "kickoff",   label: "Kickoff",                                  date: "2026-07-08", color: "#001036", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-01 — Audit existant CÉOS EDU B2C",     date: "2026-07-09", color: "#6366F1", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-02 — Processus FC INTER",               date: "2026-07-16", color: "#6366F1", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-03 — Processus FC INTRA",               date: "2026-08-31", color: "#6366F1", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-04 — Gestion Entreprises & Contacts",   date: "2026-09-03", color: "#6366F1", labelPos: "below" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-05 — Catalogue FC (synchro YPAREO→CRM)", date: "2026-09-07", color: "#6366F1", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-06 — Financement OPCO / CPF",           date: "2026-09-10", color: "#6366F1", labelPos: "below" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-07 — Annulations, reports, avenants",   date: "2026-09-14", color: "#6366F1", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-08 — Marketing & leads FC",             date: "2026-09-17", color: "#6366F1", labelPos: "below" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-09 — Suivi post-formation",             date: "2026-09-21", color: "#6366F1", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-10 — Intégration YPAREO EDU (DSI+MASAO)", date: "2026-09-24", color: "#818CF8", labelPos: "below" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-11 — EAI & interfaces EDU-Appui (DSI)", date: "2026-09-28", color: "#818CF8", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-12 — Reprise de données",               date: "2026-10-01", color: "#6366F1", labelPos: "below" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-13 — Indicateurs & Reporting",          date: "2026-10-05", color: "#6366F1", labelPos: "above" },
      { lotId: lotAtl.id, type: "atelier",   label: "ATL-14 — Gestion accès & profils",          date: "2026-10-08", color: "#6366F1", labelPos: "below" },
      { lotId: lotAtl.id, type: "signature", label: "ATL-15 — Restitution EDB (validation MOA)", date: "2026-10-12", color: "#F59E0B", labelPos: "above" },
    ]);
    console.log("  ✅ Lot Ateliers (15 jalons + 2 blocs)");

    // ── Lot : EDB (MOA) ─────────────────────────────────────────────────────
    const [lotEDB] = await db.insert(lots).values({
      planningId: pid, domainId: domCad.id,
      name: "EDB (MOA)", sortOrder: 1, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values({
      lotId: lotEDB.id, type: "cadrage",
      label: "Rédaction EDB",
      startDate: "2026-09-07", endDate: "2026-10-12",
      color: "#4F46E5", progress: 0, sortOrder: 0,
      note: "Rédigé par la MOA au fil des ateliers. Finalisé et signé lors de la Restitution ATL-15.",
    });
    await db.insert(milestones).values({
      lotId: lotEDB.id, type: "signature", label: "Signature EDB", date: "2026-10-12", color: "#F59E0B", labelPos: "below",
    });
    console.log("  ✅ Lot EDB");

    // ── Lot : Specs MASAO ───────────────────────────────────────────────────
    const [lotSpecs] = await db.insert(lots).values({
      planningId: pid, domainId: domCad.id,
      name: "Specs MASAO", sortOrder: 2, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values({
      lotId: lotSpecs.id, type: "cadrage",
      label: "Rédaction Specs MASAO",
      startDate: "2026-10-12", endDate: "2026-10-26",
      color: "#4F46E5", progress: 0, sortOrder: 0,
      note: "14 jours — MASAO rédige les specs techniques à partir de l'EDB signé.",
    });
    await db.insert(milestones).values({
      lotId: lotSpecs.id, type: "signature", label: "Signature des Specs", date: "2026-10-26", color: "#D97706", labelPos: "above",
    });
    console.log("  ✅ Lot Specs MASAO");

    // ════════════════════════════════════════════════════════════════════════
    // DOMAINE 2 — DÉVELOPPEMENT (#0369A1 / bleu)
    // ════════════════════════════════════════════════════════════════════════
    const [domDev] = await db.insert(domains).values({
      planningId: pid, code: "DEV",
      name: "Développement",
      bg: "#F0F9FF", bgAlt: "#E0F2FE", strong: "#0369A1", phaseColor: "#0284C7",
      sortOrder: 1, collapsed: false,
      cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    // ── Lot : Développements B2B (rôles & droits inclus dans le lot) ────────
    const [lotDevB2B] = await db.insert(lots).values({
      planningId: pid, domainId: domDev.id,
      name: "Développements B2B", sortOrder: 0, hidden: false,
      subtitle: "incl. mise en place des rôles et droits",
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      {
        lotId: lotDevB2B.id, type: "dev",
        label: "Développements B2B (275j parallélisés)",
        startDate: "2026-10-26", endDate: "2026-11-30",
        color: "#0284C7", progress: 0, sortOrder: 0,
        note: "Inclut la mise en place des rôles et droits (réalisée par MASAO en parallèle — nécessaire avant la livraison en recette).",
      },
    ]);
    await db.insert(milestones).values({
      lotId: lotDevB2B.id, type: "delivrable", label: "Livraison Dev", date: "2026-11-30", color: "#0284C7", labelPos: "above",
    });
    console.log("  ✅ Lot Développements B2B (rôles & droits inclus)");

    // ── Lot : Interfaces YPAREO + EAI ────────────────────────────────────────
    const [lotYPAREO] = await db.insert(lots).values({
      planningId: pid, domainId: domDev.id,
      name: "Interfaces YPAREO + EAI", sortOrder: 1, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values({
      lotId: lotYPAREO.id, type: "dev",
      label: "Interfaces YPAREO + EAI",
      startDate: "2026-11-12", endDate: "2026-11-30",
      color: "#0EA5E9", progress: 0, sortOrder: 0,
      note: "DSI requis. En parallèle de la fin des développements B2B.",
    });
    console.log("  ✅ Lot YPAREO + EAI");

    // ════════════════════════════════════════════════════════════════════════
    // DOMAINE 3 — RECETTE (#B45309 / amber)
    // ════════════════════════════════════════════════════════════════════════
    const [domRec] = await db.insert(domains).values({
      planningId: pid, code: "RECETTE",
      name: "Recette",
      bg: "#FFFBEB", bgAlt: "#FEF3C7", strong: "#B45309", phaseColor: "#D97706",
      sortOrder: 2, collapsed: false,
      cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    // ── Lot : Recette unitaire ───────────────────────────────────────────────
    const [lotRU] = await db.insert(lots).values({
      planningId: pid, domainId: domRec.id,
      name: "Recette unitaire MASAO", sortOrder: 0, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values({
      lotId: lotRU.id, type: "recette",
      label: "Recette unitaire MASAO",
      startDate: "2026-11-30", endDate: "2026-12-14",
      color: "#D97706", progress: 0, sortOrder: 0,
    });
    console.log("  ✅ Lot Recette unitaire");

    // ── Lot : Recette métier ─────────────────────────────────────────────────
    const [lotRM] = await db.insert(lots).values({
      planningId: pid, domainId: domRec.id,
      name: "Recette métier", sortOrder: 1, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      {
        lotId: lotRM.id, type: "recette",
        label: "Recette métier Run 1 (MOA + KLINT)",
        startDate: "2026-12-14", endDate: "2026-12-21",
        color: "#D97706", progress: 0, sortOrder: 0,
      },
      // Congés Noël 21/12 → 04/01 : bande closure
      {
        lotId: lotRM.id, type: "recette",
        label: "Recette métier Run 2 (MOA + KLINT)",
        startDate: "2027-01-05", endDate: "2027-01-19",
        color: "#D97706", progress: 0, sortOrder: 1,
      },
    ]);
    console.log("  ✅ Lot Recette métier");

    // ── Lot : Corrections & stabilisation ────────────────────────────────────
    const [lotCorr] = await db.insert(lots).values({
      planningId: pid, domainId: domRec.id,
      name: "Corrections & stabilisation", sortOrder: 2, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values([
      {
        lotId: lotCorr.id, type: "custom",
        label: "Corrections Run 1",
        startDate: "2026-12-21", endDate: "2026-12-21",
        color: "#F59E0B", progress: 0, sortOrder: 0,
        note: "Corrections à traiter pendant les congés Noël si bloquantes — sinon reportées en janvier.",
      },
      {
        lotId: lotCorr.id, type: "custom",
        label: "Corrections Run 2 & stabilisation",
        startDate: "2027-01-19", endDate: "2027-01-26",
        color: "#F59E0B", progress: 0, sortOrder: 1,
      },
    ]);
    console.log("  ✅ Lot Corrections & stabilisation");

    // ════════════════════════════════════════════════════════════════════════
    // DOMAINE 4 — FORMATION (#7C3AED / violet)
    // ════════════════════════════════════════════════════════════════════════
    const [domForm] = await db.insert(domains).values({
      planningId: pid, code: "FORMATION",
      name: "Formation",
      bg: "#F5F3FF", bgAlt: "#EDE9FE", strong: "#7C3AED", phaseColor: "#8B5CF6",
      sortOrder: 3, collapsed: false,
      cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    const [lotFAdmin] = await db.insert(lots).values({
      planningId: pid, domainId: domForm.id,
      name: "Formation admins CÉOS (Almavia + MASAO)", sortOrder: 0, hidden: false,
    }).returning({ id: lots.id });
    await db.insert(phases).values({
      lotId: lotFAdmin.id, type: "formation",
      label: "Formation admins CÉOS", startDate: "2027-01-05", endDate: "2027-01-26",
      color: "#8B5CF6", progress: 0, sortOrder: 0,
    });

    const [lotFChP] = await db.insert(lots).values({
      planningId: pid, domainId: domForm.id,
      name: "Formation chefs de projet écoles", sortOrder: 1, hidden: false,
    }).returning({ id: lots.id });
    await db.insert(phases).values({
      lotId: lotFChP.id, type: "formation",
      label: "Formation chefs de projet", startDate: "2027-01-05", endDate: "2027-01-26",
      color: "#A78BFA", progress: 0, sortOrder: 0,
    });

    const [lotFUser] = await db.insert(lots).values({
      planningId: pid, domainId: domForm.id,
      name: "Formation utilisateurs finaux", sortOrder: 2, hidden: false,
    }).returning({ id: lots.id });
    await db.insert(phases).values({
      lotId: lotFUser.id, type: "formation",
      label: "Formation utilisateurs finaux", startDate: "2027-01-19", endDate: "2027-02-02",
      color: "#C4B5FD", progress: 0, sortOrder: 0,
    });
    console.log("  ✅ Domaine Formation (3 lots)");

    // ════════════════════════════════════════════════════════════════════════
    // DOMAINE 5 — MEP (#15803D / vert)
    // ════════════════════════════════════════════════════════════════════════
    const [domMEP] = await db.insert(domains).values({
      planningId: pid, code: "MEP",
      name: "Mise en production",
      bg: "#F0FDF4", bgAlt: "#DCFCE7", strong: "#15803D", phaseColor: "#16A34A",
      sortOrder: 4, collapsed: false,
      cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    const [lotMEP] = await db.insert(lots).values({
      planningId: pid, domainId: domMEP.id,
      name: "Mise en production", sortOrder: 0, hidden: false,
    }).returning({ id: lots.id });

    await db.insert(phases).values({
      lotId: lotMEP.id, type: "custom",
      label: "Préparation MEP",
      startDate: "2027-02-02", endDate: "2027-02-09",
      color: "#16A34A", progress: 0, sortOrder: 0,
      note: "Si Run 2 propre : MEP possible le 30/01 (option à valider en fin de Run 2).",
    });
    await db.insert(milestones).values({
      lotId: lotMEP.id, type: "mep", label: "MEP Go Live", date: "2027-02-09", color: "#16A34A", labelPos: "above",
    });
    console.log("  ✅ Domaine MEP");

    console.log("\n✅ Planning \"B2B EDU — Formation Inter & Intra\" créé !");
    console.log("   ID  :", pid);
    console.log("   URL : https://klint-planning.vercel.app/p/" + pid);

  } catch (err) {
    await db.delete(plannings).where(eq(plannings.id, pid)).catch(() => {});
    console.error("❌ Erreur — rollback effectué :", err);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
