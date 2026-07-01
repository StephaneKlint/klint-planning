/**
 * update-kickoff-vacances.ts
 * - Ajoute les bandes de congés (août + Noël) au planning kickoff comparatif
 * - Révise le Scénario A : décale le Dev après août, ajuste recette/formation pour tenir MEP 17/12
 * - Ajoute "Mise en place des rôles et droits" dans la recette de chaque scénario
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, inArray } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const { plannings, domains, lots, phases, milestones, closurePeriods } = schema;

const DATABASE_URL = "postgresql://neondb_owner:npg_uDVIUF1n0Zje@ep-muddy-silence-a2o47z8h-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const KICKOFF_ID = "6eecebca-2cba-4739-b635-b2370786e041";

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function main() {
  // ── Récupérer domaines et lots ─────────────────────────────────────────
  const allDomains = await db.select().from(domains).where(eq(domains.planningId, KICKOFF_ID));
  const allLots    = await db.select().from(lots).where(eq(lots.planningId, KICKOFF_ID));

  const domA  = allDomains.find(d => d.code === "SCENARIOA")!;
  const domB  = allDomains.find(d => d.code === "SCENARIOB")!;

  const lotsA = allLots.filter(l => l.domainId === domA.id);
  const lotsB = allLots.filter(l => l.domainId === domB.id);

  const lotA_cadrage = lotsA.find(l => l.name.includes("Cadrage"))!;
  const lotA_dev     = lotsA.find(l => l.name.includes("Développement"))!;
  const lotA_recette = lotsA.find(l => l.name.includes("Recette"))!;
  const lotA_form    = lotsA.find(l => l.name.includes("Formation"))!;
  const lotA_mep     = lotsA.find(l => l.name.includes("Mise en production"))!;

  const lotB_recette = lotsB.find(l => l.name.includes("Recette"))!;

  console.log("Lots trouvés — A:", lotsA.map(l => l.name));
  console.log("Lots trouvés — B:", lotsB.map(l => l.name));

  // ── 1. Bandes de congés ────────────────────────────────────────────────
  await db.insert(closurePeriods).values([
    {
      planningId: KICKOFF_ID,
      label:      "Congés été (août)",
      startDate:  "2026-08-08",
      endDate:    "2026-08-31",
      color:      "#FEF9C3",  // jaune doux
      type:       "custom",
      active:     true,
      sortOrder:  0,
    },
    {
      planningId: KICKOFF_ID,
      label:      "Congés Noël",
      startDate:  "2026-12-21",
      endDate:    "2027-01-04",
      color:      "#DBEAFE",  // bleu doux
      type:       "custom",
      active:     true,
      sortOrder:  1,
    },
  ]);
  console.log("✅ Bandes de congés ajoutées");

  // ── 2. Recette Scénario A — supprimer et recréer ───────────────────────
  // Supprimer toutes les phases/jalons des lots A touchés
  for (const lotId of [lotA_cadrage.id, lotA_dev.id, lotA_recette.id, lotA_form.id, lotA_mep.id]) {
    await db.delete(phases).where(eq(phases.lotId, lotId));
    await db.delete(milestones).where(eq(milestones.lotId, lotId));
  }
  console.log("✅ Anciennes phases Scénario A supprimées");

  // ── Lot A : Cadrage & EDB (corrigé) ────────────────────────────────────
  await db.insert(phases).values([
    {
      lotId: lotA_cadrage.id, type: "cadrage",
      label: "Ateliers cadrage — bloc juillet (ATL-01→07)",
      startDate: "2026-07-08", endDate: "2026-07-31",
      color: "#DC2626", progress: 0, sortOrder: 0,
      note: "⚠ Fermeture certaines écoles dès le 17/07 — ATL-05→07 avec présences réduites.",
    },
    {
      lotId: lotA_cadrage.id, type: "cadrage",
      label: "Rédaction EDB — avant congés",
      startDate: "2026-08-01", endDate: "2026-08-07",
      color: "#DC2626", progress: 0, sortOrder: 1,
      note: "Rédaction EDB possible jusqu'au 07/08 avant fermeture complète.",
    },
    {
      lotId: lotA_cadrage.id, type: "cadrage",
      label: "Ateliers cadrage — bloc sept. (ATL-08→15)",
      startDate: "2026-09-07", endDate: "2026-09-14",
      color: "#DC2626", progress: 0, sortOrder: 2,
      note: "ATL-10/11 (YPAREO, EAI) — DSI + MASAO requis. ATL-15 Restitution EDB → Signature.",
    },
  ]);
  await db.insert(milestones).values([
    { lotId: lotA_cadrage.id, type: "kickoff",   label: "Kickoff",       date: "2026-07-08", color: "#001036", labelPos: "above" },
    { lotId: lotA_cadrage.id, type: "signature", label: "Signature EDB", date: "2026-09-14", color: "#F59E0B", labelPos: "above" },
  ]);

  // ── Lot A : Développement (corrigé — démarre mi-sept, réduit B2C) ──────
  await db.insert(phases).values([
    {
      lotId: lotA_dev.id, type: "dev",
      label: "Développements B2B (tables B2C réutilisées — démarrage partiel 15/09)",
      startDate: "2026-09-15", endDate: "2026-10-19",
      color: "#DC2626", progress: 0, sortOrder: 0,
      note: "À négocier MOE/MASAO — démarrage sur périmètre B2C stable avant signature EDB complète.",
    },
    {
      lotId: lotA_dev.id, type: "dev",
      label: "Interfaces YPAREO + EAI",
      startDate: "2026-10-01", endDate: "2026-10-19",
      color: "#EF4444", progress: 0, sortOrder: 1,
    },
  ]);
  await db.insert(milestones).values([
    { lotId: lotA_dev.id, type: "delivrable", label: "Livraison Dev", date: "2026-10-19", color: "#DC2626", labelPos: "above" },
  ]);

  // ── Lot A : Recette (corrigé + rôles & droits) ─────────────────────────
  await db.insert(phases).values([
    {
      lotId: lotA_recette.id, type: "recette",
      label: "Recette unitaire MASAO",
      startDate: "2026-10-19", endDate: "2026-11-02",
      color: "#DC2626", progress: 0, sortOrder: 0,
    },
    {
      lotId: lotA_recette.id, type: "recette",
      label: "Recette métier Run 1",
      startDate: "2026-11-02", endDate: "2026-11-16",
      color: "#DC2626", progress: 0, sortOrder: 1,
    },
    {
      lotId: lotA_recette.id, type: "custom",
      label: "Mise en place des rôles et droits",
      startDate: "2026-11-02", endDate: "2026-11-16",
      color: "#F97316", progress: 0, sortOrder: 2,
      note: "À réaliser en parallèle de Run 1 — périmètre à confirmer avec MOA.",
    },
    {
      lotId: lotA_recette.id, type: "custom",
      label: "Corrections Run 1",
      startDate: "2026-11-16", endDate: "2026-11-23",
      color: "#F87171", progress: 0, sortOrder: 3,
    },
    {
      lotId: lotA_recette.id, type: "recette",
      label: "Recette métier Run 2",
      startDate: "2026-11-23", endDate: "2026-11-30",
      color: "#DC2626", progress: 0, sortOrder: 4,
    },
    {
      lotId: lotA_recette.id, type: "custom",
      label: "Corrections & stabilisation Run 3",
      startDate: "2026-11-30", endDate: "2026-12-07",
      color: "#F87171", progress: 0, sortOrder: 5,
    },
  ]);

  // ── Lot A : Formation (compressée, en parallèle fin recette) ───────────
  await db.insert(phases).values([
    {
      lotId: lotA_form.id, type: "formation",
      label: "Formation admins CÉOS (Almavia + MASAO)",
      startDate: "2026-11-23", endDate: "2026-12-07",
      color: "#DC2626", progress: 0, sortOrder: 0,
    },
    {
      lotId: lotA_form.id, type: "formation",
      label: "Formation chefs de projet écoles",
      startDate: "2026-11-23", endDate: "2026-12-07",
      color: "#EF4444", progress: 0, sortOrder: 1,
    },
    {
      lotId: lotA_form.id, type: "formation",
      label: "Formation utilisateurs finaux",
      startDate: "2026-12-07", endDate: "2026-12-12",
      color: "#F87171", progress: 0, sortOrder: 2,
    },
  ]);

  // ── Lot A : MEP ────────────────────────────────────────────────────────
  await db.insert(phases).values([
    {
      lotId: lotA_mep.id, type: "custom",
      label: "Préparation MEP",
      startDate: "2026-12-13", endDate: "2026-12-17",
      color: "#DC2626", progress: 0, sortOrder: 0,
    },
  ]);
  await db.insert(milestones).values([
    { lotId: lotA_mep.id, type: "mep", label: "MEP Go Live — A", date: "2026-12-17", color: "#DC2626", labelPos: "above" },
  ]);

  console.log("✅ Scénario A revu et corrigé");

  // ── 3. Scénario B — ajouter "rôles et droits" dans la recette ─────────
  await db.insert(phases).values([
    {
      lotId: lotB_recette.id, type: "custom",
      label: "Mise en place des rôles et droits",
      startDate: "2026-11-16", endDate: "2026-11-30",
      color: "#F97316", progress: 0, sortOrder: 10,
      note: "En parallèle de Run 1 — périmètre à confirmer avec MOA.",
    },
  ]);

  console.log("✅ Rôles & droits ajoutés au Scénario B");
  console.log("\n✅ Mise à jour complète !");
  console.log("   URL : https://klint-planning.vercel.app/p/" + KICKOFF_ID);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
