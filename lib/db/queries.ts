import { db } from "./index";
import {
  plannings, domains, lots, phases, milestones,
  planningMembers, users, phaseAssignees,
  phaseTypes, milestoneTypes, statuses, planningSettings,
  activityLog, closurePeriods, connectionLogs,
} from "./schema";
import { eq, asc, desc, inArray, and } from "drizzle-orm";

export type DomainRow = typeof domains.$inferSelect;
export type LotRow = typeof lots.$inferSelect;
export type PhaseRow = typeof phases.$inferSelect;
export type MilestoneRow = typeof milestones.$inferSelect;
export type MemberRow = typeof planningMembers.$inferSelect & {
  userName: string;
  userEmail: string;
};
export type PhaseTypeRow = typeof phaseTypes.$inferSelect;
export type MilestoneTypeRow = typeof milestoneTypes.$inferSelect;
export type StatusRow = typeof statuses.$inferSelect;
export type ClosurePeriodRow = typeof closurePeriods.$inferSelect;
export type ConnectionLogRow = typeof connectionLogs.$inferSelect;

export interface GanttData {
  planning: typeof plannings.$inferSelect;
  settings: typeof planningSettings.$inferSelect | null;
  domains: DomainRow[];
  lots: LotRow[];
  phases: PhaseRow[];
  milestones: MilestoneRow[];
  members: MemberRow[];
  phaseTypes: PhaseTypeRow[];
  milestoneTypes: MilestoneTypeRow[];
  statuses: StatusRow[];
  phaseAssignees: { phaseId: string; memberId: string }[];
  closurePeriods: ClosurePeriodRow[];
}

export async function getGanttData(planningId: string): Promise<GanttData | null> {
  const [planning] = await db.select().from(plannings).where(eq(plannings.id, planningId));
  if (!planning) return null;

  // Members query shape (shared)
  const memberSelect = {
    id: planningMembers.id,
    planningId: planningMembers.planningId,
    userId: planningMembers.userId,
    permission: planningMembers.permission,
    projectRoleId: planningMembers.projectRoleId,
    initials: planningMembers.initials,
    color: planningMembers.color,
    lastSeenAt: planningMembers.lastSeenAt,
    userName: users.name,
    userEmail: users.email,
  } as const;

  const [
    planningDomains, planningLots, planningPhaseTypes,
    planningMilestoneTypes, planningStatuses, settings, rawMembers,
  ] = await Promise.all([
    db.select().from(domains).where(eq(domains.planningId, planningId)).orderBy(asc(domains.sortOrder)),
    db.select().from(lots).where(eq(lots.planningId, planningId)).orderBy(asc(lots.sortOrder)),
    db.select().from(phaseTypes).where(eq(phaseTypes.planningId, planningId)).orderBy(asc(phaseTypes.sortOrder)),
    db.select().from(milestoneTypes).where(eq(milestoneTypes.planningId, planningId)).orderBy(asc(milestoneTypes.sortOrder)),
    db.select().from(statuses).where(eq(statuses.planningId, planningId)).orderBy(asc(statuses.sortOrder)),
    db.select().from(planningSettings).where(eq(planningSettings.planningId, planningId)).then((r) => r[0] ?? null),
    // Always load members — needed even on empty plannings for the Ressources view
    db.select(memberSelect).from(planningMembers)
      .innerJoin(users, eq(planningMembers.userId, users.id))
      .where(eq(planningMembers.planningId, planningId)),
  ]);

  // Load closure periods for this planning (catch si table absente en dev/migration partielle)
  const planningClosures = await db
    .select()
    .from(closurePeriods)
    .where(eq(closurePeriods.planningId, planningId))
    .orderBy(asc(closurePeriods.sortOrder), asc(closurePeriods.startDate))
    .catch(() => [] as (typeof closurePeriods.$inferSelect)[]);

  if (planningLots.length === 0) {
    return {
      planning, settings,
      domains: planningDomains, lots: [], phases: [], milestones: [],
      members: rawMembers,
      phaseTypes: planningPhaseTypes, milestoneTypes: planningMilestoneTypes,
      statuses: planningStatuses, phaseAssignees: [],
      closurePeriods: planningClosures,
    };
  }

  const lotIds = planningLots.map((l) => l.id);

  const [planningPhases, planningMilestones] = await Promise.all([
    db.select().from(phases).where(inArray(phases.lotId, lotIds)).orderBy(asc(phases.sortOrder)),
    db.select().from(milestones).where(inArray(milestones.lotId, lotIds)),
  ]);

  const rawAssignees = planningPhases.length > 0
    ? await db.select().from(phaseAssignees).where(inArray(phaseAssignees.phaseId, planningPhases.map((p) => p.id)))
    : [];

  return {
    planning, settings,
    domains: planningDomains,
    lots: planningLots,
    phases: planningPhases,
    milestones: planningMilestones,
    members: rawMembers,
    phaseTypes: planningPhaseTypes,
    milestoneTypes: planningMilestoneTypes,
    statuses: planningStatuses,
    phaseAssignees: rawAssignees,
    closurePeriods: planningClosures,
  };
}

export async function listPlannings(filter: "active" | "archived" | "disabled" | "all" = "active") {
  const rows = await db
    .select({
      id: plannings.id,
      name: plannings.name,
      year: plannings.year,
      type: plannings.type,
      archived: plannings.archived,
      disabled: plannings.disabled,
      viewStart: plannings.viewStart,
      viewEnd: plannings.viewEnd,
      createdAt: plannings.createdAt,
    })
    .from(plannings)
    .where(
      filter === "active"   ? and(eq(plannings.archived, false), eq(plannings.disabled, false)) :
      filter === "archived" ? eq(plannings.archived, true) :
      filter === "disabled" ? and(eq(plannings.archived, false), eq(plannings.disabled, true)) :
      undefined
    )
    .orderBy(desc(plannings.createdAt));
  return rows;
}

export interface ActivityEntry {
  id: string;
  verb: string;
  targetType: string | null;
  summary: string;
  createdAt: Date;
  actorName: string | null;
  actorInitials: string | null;
  actorColor: string | null;
}

export async function getActivityLog(planningId: string, limit = 150): Promise<ActivityEntry[]> {
  const rows = await db
    .select({
      id: activityLog.id,
      verb: activityLog.verb,
      targetType: activityLog.targetType,
      summary: activityLog.summary,
      createdAt: activityLog.createdAt,
      actorName: users.name,
      actorInitials: planningMembers.initials,
      actorColor: planningMembers.color,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.actorId, users.id))
    .leftJoin(
      planningMembers,
      and(
        eq(planningMembers.userId, activityLog.actorId!),
        eq(planningMembers.planningId, activityLog.planningId)
      )
    )
    .where(eq(activityLog.planningId, planningId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    verb: r.verb,
    targetType: r.targetType,
    summary: r.summary,
    createdAt: r.createdAt,
    actorName: r.actorName ?? null,
    actorInitials: r.actorInitials ?? (r.actorName ? r.actorName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?"),
    actorColor: r.actorColor ?? "#001D63",
  }));
}

export async function listConnectionLogs(limit = 100): Promise<ConnectionLogRow[]> {
  return db
    .select()
    .from(connectionLogs)
    .orderBy(desc(connectionLogs.createdAt))
    .limit(limit);
}

// ── Utilisateurs existants (pour le picker de membres) ───────────────────────
export type ExistingUserRow = {
  id: string;
  name: string | null;
  email: string;
  initials: string | null;
  color: string | null;
};

/**
 * Retourne tous les utilisateurs déjà connus dans la plateforme
 * qui ne sont PAS encore membres du planning donné.
 * Utile pour le picker "Ajouter un responsable existant".
 */
export async function listUsersNotInPlanning(planningId: string): Promise<ExistingUserRow[]> {
  // Étape 1 : IDs des users déjà membres de ce planning
  const existingMembers = await db
    .select({ userId: planningMembers.userId })
    .from(planningMembers)
    .where(eq(planningMembers.planningId, planningId));

  const excludedIds = new Set(existingMembers.map((m) => m.userId));

  // Étape 2 : tous les users avec initiales/couleur d'un planning précédent
  const rows = await db
    .select({
      id:       users.id,
      name:     users.name,
      email:    users.email,
      initials: planningMembers.initials,
      color:    planningMembers.color,
    })
    .from(users)
    .leftJoin(planningMembers, eq(planningMembers.userId, users.id))
    .limit(500);

  // Déduplication + exclusion des membres existants
  const seen = new Set<string>();
  const result: ExistingUserRow[] = [];
  for (const row of rows) {
    if (!seen.has(row.id) && !excludedIds.has(row.id)) {
      seen.add(row.id);
      result.push(row);
    }
  }
  return result;
}
