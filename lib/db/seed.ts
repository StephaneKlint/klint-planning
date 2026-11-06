/**
 * lib/db/seed.ts
 * Seeds the Neon database with the CCI 2026 planning demo data.
 * Run with: pnpm db:seed
 *
 * Idempotent: skips if a planning named "Planning CCI 2026" already exists.
 */
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  plannings,
  planningMembers,
  planningSettings,
  projectRoles,
  domains,
  lots,
  phases,
  milestones,
  phaseTypes,
  milestoneTypes,
  statuses,
  users,
} from "./schema";
import { eq } from "drizzle-orm";

loadEnvConfig(process.cwd());

const sql = neon(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!
);
const db = drizzle(sql);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function d(m: number, day: number): string {
  // m = 1-based month, day = day of month → "2026-MM-DD"
  return `2026-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log("🌱 Seed CCI 2026 — début...");

  // Idempotency check
  const existing = await db
    .select({ id: plannings.id })
    .from(plannings)
    .where(eq(plannings.name, "Planning CCI 2026"));

  if (existing.length > 0) {
    console.log(
      `⏭  Planning CCI 2026 existe déjà (id: ${existing[0].id}) — seed ignoré.`
    );
    return;
  }

  // ---- Planning ----
  const [planning] = await db
    .insert(plannings)
    .values({
      name: "Planning CCI 2026",
      description: "Planning annuel CRM Dynamics — CCI France",
      year: 2026,
      viewStart: "2026-01-05",
      viewEnd: "2026-12-28",
    })
    .returning({ id: plannings.id });

  const pid = planning.id;
  console.log(`  ✓ Planning créé (${pid})`);

  // ---- Planning Settings ----
  await db.insert(planningSettings).values({
    planningId: pid,
    autoLate: true,
    autoCloseAfterMepDays: 30,
    notifyOnLate: true,
  });

  // ---- Project Roles (7) ----
  const roleRows = await db
    .insert(projectRoles)
    .values([
      { planningId: pid, code: "amoa",      name: "AMOA",             color: "#3B82F6", sortOrder: 0 },
      { planningId: pid, code: "moe_cp",    name: "MOE Chef Projet",  color: "#8B5CF6", sortOrder: 1 },
      { planningId: pid, code: "moa_cp",    name: "MOA Chef Projet",  color: "#EC4899", sortOrder: 2 },
      { planningId: pid, code: "moe_dev",   name: "MOE Dev",          color: "#10B981", sortOrder: 3 },
      { planningId: pid, code: "moa",       name: "MOA",              color: "#F59E0B", sortOrder: 4 },
      { planningId: pid, code: "directeur", name: "Directeur",        color: "#001D63", sortOrder: 5 },
      { planningId: pid, code: "ia",        name: "Référent IA",      color: "#6B7280", sortOrder: 6 },
    ])
    .returning({ id: projectRoles.id, code: projectRoles.code });

  const roleByCode = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));
  console.log(`  ✓ 7 rôles projet créés`);

  // ---- Users (8 membres) ----
  const userRows = await db
    .insert(users)
    .values([
      { email: "md@klint-consulting.com",   name: "Mathilde D.",   initials: "MD", avatarColor: "#001D63" },
      { email: "jl@klint-consulting.com",   name: "Jean-Luc L.",   initials: "JL", avatarColor: "#E8568A" },
      { email: "sb@klint-consulting.com",   name: "Sophie B.",     initials: "SB", avatarColor: "#3B82F6" },
      { email: "pm@klint-consulting.com",   name: "Pierre M.",     initials: "PM", avatarColor: "#F08A3E" },
      { email: "ac@klint-consulting.com",   name: "Arnaud C.",     initials: "AC", avatarColor: "#3FB66B" },
      { email: "tr@klint-consulting.com",   name: "Thomas R.",     initials: "TR", avatarColor: "#9069E0" },
      { email: "cg@klint-consulting.com",   name: "Cédric G.",     initials: "CG", avatarColor: "#5D63DC" },
      { email: "lf@klint-consulting.com",   name: "Laurent F.",    initials: "LF", avatarColor: "#3DA4D8" },
    ] as Array<{ email: string; name: string; initials?: string; avatarColor?: string }>)
    .returning({ id: users.id, email: users.email });

  const memberDefs = [
    { email: "md@klint-consulting.com", roleCode: "amoa",      color: "#001D63", initials: "MD" },
    { email: "jl@klint-consulting.com", roleCode: "moe_cp",    color: "#E8568A", initials: "JL" },
    { email: "sb@klint-consulting.com", roleCode: "moa_cp",    color: "#3B82F6", initials: "SB" },
    { email: "pm@klint-consulting.com", roleCode: "moe_dev",   color: "#F08A3E", initials: "PM" },
    { email: "ac@klint-consulting.com", roleCode: "moa",       color: "#3FB66B", initials: "AC" },
    { email: "tr@klint-consulting.com", roleCode: "directeur", color: "#9069E0", initials: "TR" },
    { email: "cg@klint-consulting.com", roleCode: "amoa",      color: "#5D63DC", initials: "CG" },
    { email: "lf@klint-consulting.com", roleCode: "ia",        color: "#3DA4D8", initials: "LF" },
  ];

  await db.insert(planningMembers).values(
    memberDefs.map((m) => ({
      planningId: pid,
      userId: userRows.find((u) => u.email === m.email)!.id,
      permission: "editor" as const,
      projectRoleId: roleByCode[m.roleCode],
      initials: m.initials,
      color: m.color,
    }))
  );
  console.log(`  ✓ 8 membres créés`);

  // ---- Phase Types (4) ----
  await db.insert(phaseTypes).values([
    { planningId: pid, code: "cadrage",   label: "Cadrage",       sortOrder: 0 },
    { planningId: pid, code: "dev",       label: "Développement", sortOrder: 1 },
    { planningId: pid, code: "recette",   label: "Recette",       sortOrder: 2 },
    { planningId: pid, code: "formation", label: "Formation",     sortOrder: 3 },
  ]);

  // ---- Milestone Types (5) ----
  await db.insert(milestoneTypes).values([
    { planningId: pid, code: "mep",       label: "MEP",             color: "#1E3A8A", sortOrder: 0 },
    { planningId: pid, code: "pmep",      label: "PMEP",            color: "#312E81", sortOrder: 1 },
    { planningId: pid, code: "cab",       label: "CAB",             color: "#65A30D", sortOrder: 2 },
    { planningId: pid, code: "livraison", label: "Livraison REC3",  color: "#0D9488", sortOrder: 3 },
    { planningId: pid, code: "custom",    label: "Personnalisé",    color: "#7C3AED", sortOrder: 4 },
  ]);

  // ---- Statuses (6) ----
  await db.insert(statuses).values([
    { planningId: pid, code: "planned",     label: "Planifié",      color: "#94A3B8", bg: "#F1F5F9", sortOrder: 0 },
    { planningId: pid, code: "in_progress", label: "En cours",      color: "#3B82F6", bg: "#E0EBFE", sortOrder: 1 },
    { planningId: pid, code: "review",      label: "En attente validation QA", color: "#EAB308", bg: "#FEF3C7", sortOrder: 2 },
    { planningId: pid, code: "done",        label: "Terminé",       color: "#16A34A", bg: "#DCFCE7", sortOrder: 3 },
    { planningId: pid, code: "risk",        label: "À risque",      color: "#F59E0B", bg: "#FEF3C7", sortOrder: 4 },
    { planningId: pid, code: "late",        label: "En retard",     color: "#DC2626", bg: "#FEE2E2", sortOrder: 5 },
  ]);

  console.log(`  ✓ Types et statuts créés`);

  // ---- Domains (9) ----
  const domainDefs = [
    { code: "mco",  name: "MCO",                bg: "#FCE9EE", bgAlt: "#F8DAE2", strong: "#BE185D", phaseColor: "#E8568A", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
    { code: "ceos", name: "CEOS",               bg: "#E2EEFF", bgAlt: "#D2E3FA", strong: "#1D4ED8", phaseColor: "#3B82F6", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
    { code: "cfpi", name: "CFPI",               bg: "#FCE9D6", bgAlt: "#F9DBBC", strong: "#C2410C", phaseColor: "#F08A3E", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
    { code: "nse",  name: "NSE",                bg: "#D9F2DE", bgAlt: "#C5EAD0", strong: "#15803D", phaseColor: "#3FB66B", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
    { code: "easy", name: "EASY DECLARE",       bg: "#E7DCFC", bgAlt: "#D8C8FA", strong: "#6D28D9", phaseColor: "#9069E0", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
    { code: "digi", name: "Digitalisation RC",  bg: "#DBE0FB", bgAlt: "#CAD0F8", strong: "#4338CA", phaseColor: "#5D63DC", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
    { code: "o2c",  name: "O2C",                bg: "#D6EEFB", bgAlt: "#BFE2F8", strong: "#0369A1", phaseColor: "#3DA4D8", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
    { code: "ia",   name: "IA",                 bg: "#E4E5E9", bgAlt: "#D5D7DC", strong: "#374151", phaseColor: "#6B7280", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
    { code: "einv", name: "E-Invoicing",        bg: "#E3DDD2", bgAlt: "#D3CABC", strong: "#44403C", phaseColor: "#7A6D5A", cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 } },
  ];

  const domainRows = await db
    .insert(domains)
    .values(
      domainDefs.map((d, i) => ({
        planningId: pid,
        code: d.code,
        name: d.name,
        bg: d.bg,
        bgAlt: d.bgAlt,
        strong: d.strong,
        phaseColor: d.phaseColor,
        cadence: d.cadence,
        sortOrder: i,
      }))
    )
    .returning({ id: domains.id, code: domains.code });

  const domainByCode = Object.fromEntries(domainRows.map((r) => [r.code, r.id]));
  console.log(`  ✓ 9 domaines créés`);

  // ---------------------------------------------------------------------------
  // Lots + Phases + Milestones
  // Derived exactly from DEFAULT_DATA.projects in app.html
  // ---------------------------------------------------------------------------

  const lotDefs = [
    // ---- MCO (9 lots) ----
    {
      domain: "mco", id: "lot438", name: "Lot 4.3.8", subtitle: "", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage", start: d(1,5),  end: d(1,9) },
      ],
      milestones: [
        { type: "mep",  date: d(1,8),  label: "MEP 08/01" },
      ],
    },
    {
      domain: "mco", id: "lot439", name: "Lot 4.3.9", subtitle: "[À CONFIRMER dev/recette]", sortOrder: 1, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(1,5),  end: d(1,23) },
        { type: "dev",      start: d(1,23), end: d(2,2) },
        { type: "recette",  start: d(2,2),  end: d(2,9) },
      ],
      milestones: [
        { type: "livraison", date: d(1,23), label: "Livraison REC3 23/01" },
        { type: "pmep",      date: d(2,2),  label: "PMEP 02/02" },
        { type: "cab",       date: d(2,6),  label: "CAB 06/02" },
        { type: "mep",       date: d(2,9),  label: "MEP 09/02" },
      ],
    },
    {
      domain: "mco", id: "lot4310", name: "Lot 4.3.10", subtitle: "[À CONFIRMER dev/recette]", sortOrder: 2, labelPos: "below",
      phases: [
        { type: "cadrage",  start: d(1,19), end: d(2,27) },
        { type: "dev",      start: d(2,27), end: d(3,6) },
        { type: "recette",  start: d(3,6),  end: d(3,12) },
      ],
      milestones: [
        { type: "livraison", date: d(2,27), label: "Livraison REC3 27/02" },
        { type: "pmep",      date: d(3,2),  label: "PMEP 02/03" },
        { type: "cab",       date: d(3,6),  label: "CAB 06/03" },
        { type: "mep",       date: d(3,12), label: "MEP 12/03" },
      ],
    },
    {
      domain: "mco", id: "lot4311", name: "Lot 4.3.11", subtitle: "", sortOrder: 3, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(3,2),  end: d(3,23) },
        { type: "dev",      start: d(3,23), end: d(3,30) },
        { type: "recette",  start: d(3,30), end: d(4,9) },
      ],
      milestones: [
        { type: "livraison", date: d(3,27), label: "Livraison REC3 27/03" },
        { type: "pmep",      date: d(4,9),  label: "PMEP 09/04" },
        { type: "cab",       date: d(4,10), label: "CAB 10/04" },
        { type: "mep",       date: d(4,14), label: "MEP 14/04" },
      ],
    },
    {
      domain: "mco", id: "lot4312", name: "Lot 4.3.12", subtitle: "O2C (VAC) + API Webikeo + Exportateurs", sortOrder: 4, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(1,26), end: d(5,4) },
        { type: "dev",      start: d(5,4),  end: d(6,15) },
        { type: "recette",  start: d(6,15), end: d(6,29) },
      ],
      milestones: [
        { type: "livraison", date: d(6,12), label: "Livraison REC3 12/06" },
        { type: "pmep",      date: d(6,29), label: "PMEP 29/06" },
        { type: "cab",       date: d(7,3),  label: "CAB 03/07" },
        { type: "mep",       date: d(7,6),  label: "MEP 06/07" },
      ],
    },
    {
      domain: "mco", id: "lot4313", name: "Lot 4.3.13", subtitle: "E-Facturation + CFENet ou Lien E-boutique", sortOrder: 5, labelPos: "below",
      phases: [
        { type: "cadrage",  start: d(1,19), end: d(5,11) },
        { type: "dev",      start: d(5,11), end: d(6,15) },
        { type: "recette",  start: d(6,15), end: d(6,29) },
      ],
      milestones: [
        { type: "livraison", date: d(6,12), label: "Livraison REC3 12/06" },
        { type: "pmep",      date: d(6,29), label: "PMEP 29/06" },
        { type: "cab",       date: d(7,3),  label: "CAB 03/07" },
        { type: "mep",       date: d(7,6),  label: "MEP 06/07" },
      ],
    },
    {
      domain: "mco", id: "lot4314", name: "Lot 4.3.14", subtitle: "Activ Créa + Lien E-boutique ou CFENet + ED & Flux ED", sortOrder: 6, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(2,2),  end: d(7,6) },
        { type: "dev",      start: d(7,6),  end: d(8,31) },
        { type: "recette",  start: d(8,31), end: d(9,21) },
      ],
      milestones: [
        { type: "livraison", date: d(8,31), label: "Livraison REC3 31/08" },
        { type: "pmep",      date: d(9,14), label: "PMEP 14/09" },
        { type: "cab",       date: d(9,18), label: "CAB 18/09" },
        { type: "mep",       date: d(9,21), label: "MEP 21/09" },
      ],
    },
    {
      domain: "mco", id: "lot4315", name: "Lot 4.3.15", subtitle: "Multicomptes + Exportateur V1 + Offres groupées", sortOrder: 7, labelPos: "below",
      phases: [
        { type: "cadrage",  start: d(6,22), end: d(10,5) },
        { type: "dev",      start: d(10,5), end: d(10,26) },
        { type: "recette",  start: d(10,26),end: d(11,2) },
      ],
      milestones: [
        { type: "livraison", date: d(10,9),  label: "Livraison REC3 09/10" },
        { type: "pmep",      date: d(10,23), label: "PMEP 23/10" },
        { type: "cab",       date: d(10,30), label: "CAB 30/10" },
        { type: "mep",       date: d(11,2),  label: "MEP 02/11" },
      ],
    },
    {
      domain: "mco", id: "lot4316", name: "Lot 4.3.16", subtitle: "Signature électronique + CFPI CCIT", sortOrder: 8, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(7,6),  end: d(11,2) },
        { type: "dev",      start: d(11,2), end: d(11,23) },
        { type: "recette",  start: d(11,23),end: d(12,7) },
      ],
      milestones: [
        { type: "livraison", date: d(11,19), label: "Livraison REC3 19/11" },
        { type: "pmep",      date: d(11,30), label: "PMEP 30/11" },
        { type: "cab",       date: d(12,4),  label: "CAB 04/12" },
        { type: "mep",       date: d(12,7),  label: "MEP 07/12" },
      ],
    },

    // ---- CEOS (2 lots) ----
    {
      domain: "ceos", id: "ceos-webikeo", name: "API Webikeo", subtitle: "", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(1,12), end: d(4,20) },
        { type: "dev",      start: d(4,20), end: d(5,18) },
        { type: "recette",  start: d(5,18), end: d(6,1) },
      ],
      milestones: [
        { type: "livraison", date: d(5,4),  label: "Livraison REC3 04/05" },
        { type: "pmep",      date: d(5,26), label: "PMEP 26/05" },
        { type: "cab",       date: d(5,29), label: "CAB 29/05" },
        { type: "mep",       date: d(6,1),  label: "MEP 01/06" },
      ],
    },
    {
      domain: "ceos", id: "ceos-activ", name: "Activ créa + Contact multicomptes", subtitle: "", sortOrder: 1, labelPos: "below",
      phases: [
        { type: "cadrage",  start: d(3,30), end: d(10,5) },
        { type: "dev",      start: d(10,5), end: d(11,2) },
        { type: "recette",  start: d(11,2), end: d(11,16) },
      ],
      milestones: [
        { type: "livraison", date: d(10,23), label: "Livraison en REC3 23/10" },
        { type: "pmep",      date: d(11,9),  label: "PMEP 09/11" },
        { type: "cab",       date: d(11,13), label: "CAB 13/11" },
        { type: "mep",       date: d(11,16), label: "MEP 16/11" },
      ],
    },

    // ---- CFPI (2 lots) ----
    {
      domain: "cfpi", id: "cfpi-cfenet", name: "Flux CFENet", subtitle: "", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(1,12), end: d(2,23) },
        { type: "cadrage",  start: d(3,23), end: d(4,27) },
        { type: "dev",      start: d(4,27), end: d(6,1) },
        { type: "recette",  start: d(6,1),  end: d(6,15) },
      ],
      milestones: [
        { type: "custom",    date: d(3,2),  label: "Fin Dév CCI France 02/03" },
        { type: "livraison", date: d(3,23), label: "Livraison CCI France 23/03" },
        { type: "livraison", date: d(6,12), label: "Livraison REC3 12/06" },
        { type: "pmep",      date: d(6,29), label: "PMEP 29/06" },
        { type: "cab",       date: d(7,3),  label: "CAB 03/07" },
        { type: "mep",       date: d(7,6),  label: "MEP 06/07" },
      ],
    },
    {
      domain: "cfpi", id: "cfpi-ccit", name: "CCIT", subtitle: "", sortOrder: 1, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(10,5), end: d(11,23) },
        { type: "dev",      start: d(11,23),end: d(12,14) },
        { type: "recette",  start: d(12,14),end: d(12,21) },
      ],
      milestones: [
        { type: "mep", date: d(12,21), label: "MEP 21/12" },
      ],
    },

    // ---- NSE (1 lot) ----
    {
      domain: "nse", id: "nse-expo", name: "L'exportateur", subtitle: "MVP + V1", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(1,12),  end: d(2,23),  label: undefined },
        { type: "dev",      start: d(2,23),  end: d(4,27),  label: "Dév. (MVP)" },
        { type: "recette",  start: d(4,27),  end: d(5,25),  label: "Recette NSE" },
        { type: "dev",      start: d(6,1),   end: d(8,31),  label: "Dév. (V1)" },
        { type: "recette",  start: d(8,31),  end: d(9,21),  label: "Recette NSE" },
      ],
      milestones: [
        { type: "livraison", date: d(5,4),   label: "Livraison CEOS REC3 04/05" },
        { type: "mep",       date: d(6,1),   label: "MEP NSE MVP 01/06" },
        { type: "livraison", date: d(9,14),  label: "Livraison CEOS REC3 14/09" },
        { type: "mep",       date: d(9,21),  label: "MEP NSE 21/09" },
        { type: "mep",       date: d(10,12), label: "MEP NSE V1 12/10" },
      ],
    },

    // ---- EASY DECLARE (2 lots) ----
    {
      domain: "easy", id: "easy-preq", name: "Parcours de préqualification", subtitle: "", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(1,5),  end: d(4,20) },
        { type: "dev",      start: d(6,22), end: d(8,31) },
        { type: "recette",  start: d(8,31), end: d(11,9) },
      ],
      milestones: [
        { type: "custom", date: d(11,30), label: "MEP à définir" },
      ],
    },
    {
      domain: "easy", id: "easy-offres", name: "Offres groupées", subtitle: "", sortOrder: 1, labelPos: "below",
      phases: [
        { type: "cadrage",  start: d(1,5),  end: d(4,13) },
        { type: "dev",      start: d(5,4),  end: d(6,29) },
        { type: "recette",  start: d(6,29), end: d(8,3) },
      ],
      milestones: [
        { type: "custom",    date: d(4,14), label: "Décision GO/No GO" },
        { type: "livraison", date: d(9,4),  label: "Livraison REC3 04/09" },
        { type: "custom",    date: d(11,30),label: "MEP à définir" },
      ],
    },

    // ---- Digitalisation RC (1 lot) ----
    {
      domain: "digi", id: "digi-eboutique", name: "Raccourci e-boutique", subtitle: "", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(1,5),  end: d(2,23) },
        { type: "dev",      start: d(2,23), end: d(4,27) },
        { type: "recette",  start: d(4,27), end: d(6,1) },
      ],
      milestones: [
        { type: "custom",    date: d(3,2),  label: "EDB Remise 02/03" },
        { type: "livraison", date: d(5,4),  label: "Livraison en REC3 04/05" },
        { type: "mep",       date: d(6,1),  label: "MEP 01/06" },
      ],
    },

    // ---- O2C (3 lots) ----
    {
      domain: "o2c", id: "o2c-conf", name: "Confiance 91", subtitle: "Process facturation 91 + Correctif", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(1,5),  end: d(1,26),  label: "Cadrage Dév." },
        { type: "recette",  start: d(1,26), end: d(2,23) },
        { type: "cadrage",  start: d(2,23), end: d(3,9) },
        { type: "dev",      start: d(5,11), end: d(6,15) },
        { type: "recette",  start: d(6,15), end: d(6,29) },
      ],
      milestones: [
        { type: "livraison", date: d(5,11), label: "Livraison REC3 11/05" },
        { type: "pmep",      date: d(5,26), label: "PMEP 26/05" },
        { type: "cab",       date: d(5,29), label: "CAB 29/05" },
        { type: "mep",       date: d(6,1),  label: "MEP 01/06" },
      ],
    },
    {
      domain: "o2c", id: "o2c-vac", name: "Automatisation VAC", subtitle: "", sortOrder: 1, labelPos: "below",
      phases: [
        { type: "cadrage",  start: d(2,9),  end: d(3,30) },
        { type: "dev",      start: d(5,18), end: d(6,22) },
        { type: "recette",  start: d(6,22), end: d(7,13) },
      ],
      milestones: [],
    },
    {
      domain: "o2c", id: "o2c-sig", name: "Signature électronique", subtitle: "", sortOrder: 2, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(8,3),  end: d(10,5) },
        { type: "dev",      start: d(10,5), end: d(11,30) },
        { type: "recette",  start: d(11,30),end: d(12,28) },
      ],
      milestones: [],
    },

    // ---- IA (2 lots) ----
    {
      domain: "ia", id: "ia-diag", name: "POC Diag 360", subtitle: "", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(4,13), end: d(7,27) },
        { type: "dev",      start: d(8,3),  end: d(10,12) },
        { type: "recette",  start: d(10,12),end: d(12,21) },
      ],
      milestones: [],
    },
    {
      domain: "ia", id: "ia-chat", name: "Chatbot DRCC", subtitle: "", sortOrder: 1, labelPos: "below",
      phases: [
        { type: "cadrage",  start: d(1,5),  end: d(4,13) },
        { type: "dev",      start: d(4,20), end: d(7,20) },
        { type: "recette",  start: d(7,27), end: d(9,21) },
      ],
      milestones: [
        { type: "custom", date: d(4,14), label: "Décision GO/No GO" },
        { type: "custom", date: d(9,21), label: "MEP à définir" },
      ],
    },

    // ---- E-Invoicing (1 lot) ----
    {
      domain: "einv", id: "einv", name: "E-Invoicing", subtitle: "", sortOrder: 0, labelPos: "above",
      phases: [
        { type: "cadrage",  start: d(2,9),  end: d(5,11) },
        { type: "dev",      start: d(5,11), end: d(6,8) },
        { type: "recette",  start: d(6,8),  end: d(6,29) },
      ],
      milestones: [
        { type: "livraison", date: d(6,12), label: "Livraison REC3 12/06" },
        { type: "pmep",      date: d(6,29), label: "PMEP 29/06" },
        { type: "cab",       date: d(7,3),  label: "CAB 03/07" },
        { type: "mep",       date: d(7,6),  label: "MEP 06/07" },
      ],
    },
  ] as Array<{
    domain: string;
    id: string;
    name: string;
    subtitle: string;
    sortOrder: number;
    labelPos: string;
    phases: Array<{ type: string; start: string; end: string; label?: string }>;
    milestones: Array<{ type: string; date: string; label: string }>;
  }>;

  let totalPhases = 0;
  let totalMilestones = 0;

  for (const lotDef of lotDefs) {
    const [lot] = await db
      .insert(lots)
      .values({
        planningId: pid,
        domainId: domainByCode[lotDef.domain],
        name: lotDef.name,
        subtitle: lotDef.subtitle || undefined,
        sortOrder: lotDef.sortOrder,
      })
      .returning({ id: lots.id });

    if (lotDef.phases.length > 0) {
      await db.insert(phases).values(
        lotDef.phases.map((p, i) => ({
          lotId: lot.id,
          type: p.type,
          label: p.label ?? null,
          startDate: p.start,
          endDate: p.end,
          progress: 0,
          sortOrder: i,
        }))
      );
      totalPhases += lotDef.phases.length;
    }

    if (lotDef.milestones.length > 0) {
      await db.insert(milestones).values(
        lotDef.milestones.map((m) => ({
          lotId: lot.id,
          type: m.type,
          label: m.label,
          date: m.date,
          labelPos: "auto" as const,
        }))
      );
      totalMilestones += lotDef.milestones.length;
    }
  }

  console.log(
    `  ✓ ${lotDefs.length} lots, ${totalPhases} phases, ${totalMilestones} jalons créés`
  );
  console.log("✅ Seed terminé avec succès !");
}

seed().catch((err) => {
  console.error("❌ Seed échoué :", err);
  process.exit(1);
});
