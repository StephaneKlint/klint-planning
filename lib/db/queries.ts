import { db } from "./index";
import {
  plannings, domains, lots, phases, milestones,
  planningMembers, users, phaseAssignees,
  phaseTypes, milestoneTypes, statuses, planningSettings,
  activityLog,
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
}

export async function getGanttData(planningId: string): Promise<GanttData | null> {
  const [planning] = await db.select().from(plannings).where(eq(plannings.id, planningId));
  if (!planning) return null;

  const [
    planningDomains, planningLots, planningPhaseTypes,
    planningMilestoneTypes, planningStatuses, settings,
  ] = await Promise.all([
    db.select().from(domains).where(eq(domains.planningId, planningId)).orderBy(asc(domains.sortOrder)),
    db.select().from(lots).where(eq(lots.planningId, planningId)).orderBy(asc(lots.sortOrder)),
    db.select().from(phaseTypes).where(eq(phaseTypes.planningId, planningId)).orderBy(asc(phaseTypes.sortOrder)),
    db.select().from(milestoneTypes).where(eq(milestoneTypes.planningId, planningId)).orderBy(asc(milestoneTypes.sortOrder)),
    db.select().from(statuses).where(eq(statuses.planningId, planningId)).orderBy(asc(statuses.sortOrder)),
    db.select().from(planningSettings).where(eq(planningSettings.planningId, planningId)).then((r) => r[0] ?? null),
  ]);

  if (planningLots.length === 0) {
    return { planning, settings, domains: planningDomains, lots: [], phases: [], milestones: [], members: [], phaseTypes: planningPhaseTypes, milestoneTypes: planningMilestoneTypes, statuses: planningStatuses, phaseAssignees: [] };
  }

  const lotIds = planningLots.map((l) => l.id);

  const [planningPhases, planningMilestones, rawMembers] = await Promise.all([
    db.select().from(phases).where(inArray(phases.lotId, lotIds)).orderBy(asc(phases.sortOrder)),
    db.select().from(milestones).where(inArray(milestones.lotId, lotIds)),
    db.select({
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
    }).from(planningMembers)
      .innerJoin(users, eq(planningMembers.userId, users.id))
      .where(eq(planningMembers.planningId, planningId)),
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
  };
}

export async function listPlannings() {
  return db
    .select({
      id:       plannings.id,
      name:     plannings.name,
      year:     plannings.year,
      type:     plannings.type,
      archived: plannings.archived,
      viewStart: plannings.viewStart,
      viewEnd:   plannings.viewEnd,
      createdAt: plannings.createdAt,
    })
    .from(plannings)
    .where(eq(plannings.archived, false))
    .orderBy(asc(plannings.createdAt));
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
