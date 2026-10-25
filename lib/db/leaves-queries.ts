/**
 * lib/db/leaves-queries.ts — lecture SEULE des congés d'un planning.
 *
 * Un congé = une phase (table phases) dont le type est un type « congé » (CP, RTT, Formation, Absence…), rattachée à un lot
 * du planning (lots.planningId) et assignée à un membre (phase_assignees → planning_members → users). Les colonnes sont
 * énumérées une à une : label, note, couleur, statut et progression des phases ne sont JAMAIS lus.
 */
import { and, asc, eq, gte, isNull, lte, or, sql, inArray } from "drizzle-orm";
import { db } from "./index";
import { domains, lots, phaseAssignees, phases, phaseTypes, planningMembers, plannings, users } from "./schema";
import type { LeaveRowInput } from "../leaves-api";

export async function planningIsReadable(planningId: string): Promise<boolean> {
  const [p] = await db.select({ id: plannings.id }).from(plannings)
    .where(and(eq(plannings.id, planningId), isNull(plannings.deletedAt), eq(plannings.disabled, false), eq(plannings.isTemplate, false))).limit(1);
  return !!p;
}

// `types` : codes (ou libellés) de types de phase en minuscules. Période : toute phase qui chevauche [from, to].
export async function listLeaves(planningId: string, from: string, to: string, types: string[]): Promise<LeaveRowInput[]> {
  const rows = await db
    .select({
      phaseId: phases.id,
      memberId: planningMembers.id,
      type: phases.type,
      start: phases.startDate,
      end: phases.endDate,
      email: users.email,
      name: users.name,
    })
    .from(phases)
    .innerJoin(lots, eq(lots.id, phases.lotId))
    .innerJoin(domains, and(eq(domains.id, lots.domainId), eq(domains.planningId, lots.planningId)))
    .innerJoin(phaseAssignees, eq(phaseAssignees.phaseId, phases.id))
    // le membre doit appartenir au MÊME planning (jamais d'affectation croisée)
    .innerJoin(planningMembers, and(eq(planningMembers.id, phaseAssignees.memberId), eq(planningMembers.planningId, lots.planningId)))
    .innerJoin(users, eq(users.id, planningMembers.userId))
    .leftJoin(phaseTypes, and(eq(phaseTypes.planningId, lots.planningId), eq(phaseTypes.code, phases.type)))
    .where(and(
      eq(lots.planningId, planningId),
      lte(phases.startDate, to),
      gte(phases.endDate, from),
      or(
        inArray(sql`lower(${phases.type})`, types),
        inArray(sql`lower(${phaseTypes.label})`, types),
      ),
    ))
    .orderBy(asc(phases.startDate), asc(users.name))
    .limit(2000);
  return rows;
}
