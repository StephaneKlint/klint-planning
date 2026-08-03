/**
 * create-conges-planning.ts
 * Crée le planning "Congés — Klint & partenaires" :
 *   - 4 domaines : KLINT, CCI, Masao, Almaviva CX
 *   - 1 lot par personne (pas de sous-lot staffing, pas de phases pour l'instant)
 *   - Types de phase adaptés au suivi d'absences (CP, RTT, Formation, Arrêt, Autre)
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const { plannings, planningSettings, phaseTypes, statuses, domains, lots, activityLog, users } =
  schema;

const DATABASE_URL =
  "postgresql://neondb_owner:npg_uDVIUF1n0Zje@ep-muddy-silence-a2o47z8h-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const PLANNING_NAME = "Congés — Klint & partenaires";

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

type DomainDef = {
  code: string;
  name: string;
  bg: string;
  bgAlt: string;
  strong: string;
  phaseColor: string;
  members: string[];
};

const DOMAINS: DomainDef[] = [
  {
    code: "klint",
    name: "KLINT",
    bg: "#E2EEFF",
    bgAlt: "#D2E3FA",
    strong: "#1D4ED8",
    phaseColor: "#3B82F6",
    members: ["Chaïma", "Chanez", "Nesrine", "Guillaume", "Stéphane"],
  },
  {
    code: "cci",
    name: "CCI",
    bg: "#D9F2DE",
    bgAlt: "#C5EAD0",
    strong: "#15803D",
    phaseColor: "#3FB66B",
    members: [
      "Emeline", "Corinne", "Isabelle", "Fabrice", "Ludovic", "Leïla",
      "Marie-Liesse", "Franck", "Damien", "Rosalie", "Mauricio", "Hamed",
      "Dariia", "Ismaïl", "Rose-Marie", "Véronique",
    ],
  },
  {
    code: "masao",
    name: "Masao",
    bg: "#E7DCFC",
    bgAlt: "#D8C8FA",
    strong: "#6D28D9",
    phaseColor: "#9069E0",
    members: ["Daniel", "Nicolas"],
  },
  {
    code: "almaviva",
    name: "Almaviva CX",
    bg: "#FCE9D6",
    bgAlt: "#F9DBBC",
    strong: "#C2410C",
    phaseColor: "#F08A3E",
    members: ["Nicolas", "Lenny"],
  },
];

async function main() {
  const [existing] = await db
    .select({ id: plannings.id })
    .from(plannings)
    .where(eq(plannings.name, PLANNING_NAME));
  if (existing) {
    throw new Error(
      `Un planning "${PLANNING_NAME}" existe déjà (id: ${existing.id}). Arrêt pour éviter un doublon.`
    );
  }

  const [creator] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "sdurand@klint-consulting.com"));

  console.log(`Création du planning "${PLANNING_NAME}"…`);

  const [planning] = await db
    .insert(plannings)
    .values({
      name: PLANNING_NAME,
      type: "mono",
      year: 2026,
      viewStart: "2026-01-01",
      viewEnd: "2026-12-31",
      description: "Suivi centralisé des congés/absences — consultants Klint et interlocuteurs partenaires (CCI, Masao, Almaviva CX).",
      referenceDate: "2026-08-03",
      createdBy: creator?.id ?? null,
    })
    .returning({ id: plannings.id });

  const pid = planning.id;

  try {
    await db.insert(planningSettings).values({
      planningId: pid,
      autoLate: false,
      autoCloseAfterMepDays: 30,
      notifyOnLate: false,
    });

    await db.insert(phaseTypes).values([
      { planningId: pid, code: "cp",        label: "Congés payés",     sortOrder: 0 },
      { planningId: pid, code: "rtt",       label: "RTT",              sortOrder: 1 },
      { planningId: pid, code: "formation", label: "Formation",        sortOrder: 2 },
      { planningId: pid, code: "arret",     label: "Arrêt / maladie",  sortOrder: 3 },
      { planningId: pid, code: "autre",     label: "Autre absence",    sortOrder: 4 },
    ]);

    await db.insert(statuses).values([
      { planningId: pid, code: "planned",     label: "Planifiée", color: "#94A3B8", bg: "#F1F5F9", sortOrder: 0 },
      { planningId: pid, code: "in_progress", label: "En cours",  color: "#3B82F6", bg: "#E0EBFE", sortOrder: 1 },
      { planningId: pid, code: "done",        label: "Terminée",  color: "#16A34A", bg: "#DCFCE7", sortOrder: 3 },
    ]);

    let totalLots = 0;
    for (let i = 0; i < DOMAINS.length; i++) {
      const d = DOMAINS[i];
      const [dom] = await db
        .insert(domains)
        .values({
          planningId: pid,
          code: d.code,
          name: d.name,
          bg: d.bg,
          bgAlt: d.bgAlt,
          strong: d.strong,
          phaseColor: d.phaseColor,
          sortOrder: i,
        })
        .returning({ id: domains.id });

      await db.insert(lots).values(
        d.members.map((name, idx) => ({
          planningId: pid,
          domainId: dom.id,
          name,
          sortOrder: idx,
        }))
      );
      totalLots += d.members.length;
      console.log(`  Domaine "${d.name}" : ${d.members.length} lot(s).`);
    }

    await db
      .insert(activityLog)
      .values({
        planningId: pid,
        verb: "created",
        targetType: "planning",
        targetId: pid,
        summary: `Planning créé (${DOMAINS.length} domaines, ${totalLots} lots)`,
      })
      .catch(() => {});

    console.log(`\n✅ Planning "${PLANNING_NAME}" créé avec succès !`);
    console.log("   ID  :", pid);
    console.log("   URL : https://klint-planning.vercel.app/p/" + pid);
  } catch (err) {
    await db.delete(plannings).where(eq(plannings.id, pid)).catch(() => {});
    console.error("❌ Erreur — rollback effectué :", err);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
