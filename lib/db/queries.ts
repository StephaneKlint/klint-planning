import { db } from "./index";
import {
  plannings, domains, lots, phases, milestones,
  planningMembers, users, phaseAssignees,
  phaseTypes, milestoneTypes, statuses, planningSettings,
  activityLog, closurePeriods, connectionLogs, shareTokens, baselines,
} from "./schema";
import { eq, asc, desc, inArray, and, isNull, isNotNull, sql } from "drizzle-orm";

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

/** Plannings accessibles à un utilisateur non-admin (uniquement ceux où il est membre) */
export async function listPlanningsForUser(userId: string) {
  const notDeleted = isNull(plannings.deletedAt);
  const rows = await db
    .select({
      id: plannings.id,
      name: plannings.name,
      year: plannings.year,
      type: plannings.type,
      archived: plannings.archived,
      disabled: plannings.disabled,
      isTemplate: plannings.isTemplate,
      deletedAt: plannings.deletedAt,
      viewStart: plannings.viewStart,
      viewEnd: plannings.viewEnd,
      createdAt: plannings.createdAt,
      projectName: plannings.projectName,
      domainCount: sql<number>`(SELECT COUNT(*) FROM domains WHERE domains.planning_id = ${plannings.id})::int`,
    })
    .from(plannings)
    .innerJoin(planningMembers, eq(planningMembers.planningId, plannings.id))
    .where(
      and(
        notDeleted,
        eq(plannings.archived, false),
        eq(plannings.disabled, false),
        eq(plannings.isTemplate, false),
        eq(planningMembers.userId, userId)
      )
    )
    .orderBy(desc(plannings.createdAt));

  // Déduplique (un user peut être membre plusieurs fois via des rôles différents)
  const seen = new Set<string>();
  return rows.filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

/** IDs de tous les plannings auxquels l'utilisateur appartient, tous statuts confondus. */
export async function getAccessiblePlanningIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ planningId: planningMembers.planningId })
    .from(planningMembers)
    .where(eq(planningMembers.userId, userId));
  return new Set(rows.map((r) => r.planningId));
}

export async function listPlannings(filter: "active" | "archived" | "disabled" | "all" | "templates" | "trashed" = "active") {
  const notDeleted = isNull(plannings.deletedAt);
  const rows = await db
    .select({
      id: plannings.id,
      name: plannings.name,
      year: plannings.year,
      type: plannings.type,
      archived: plannings.archived,
      disabled: plannings.disabled,
      isTemplate: plannings.isTemplate,
      deletedAt: plannings.deletedAt,
      viewStart: plannings.viewStart,
      viewEnd: plannings.viewEnd,
      createdAt: plannings.createdAt,
      projectName: plannings.projectName,
      domainCount: sql<number>`(SELECT COUNT(*) FROM domains WHERE domains.planning_id = ${plannings.id})::int`,
    })
    .from(plannings)
    .where(
      filter === "active"    ? and(notDeleted, eq(plannings.archived, false), eq(plannings.disabled, false), eq(plannings.isTemplate, false)) :
      filter === "templates" ? and(notDeleted, eq(plannings.archived, false), eq(plannings.disabled, false), eq(plannings.isTemplate, true)) :
      filter === "archived"  ? and(notDeleted, eq(plannings.archived, true)) :
      filter === "disabled"  ? and(notDeleted, eq(plannings.archived, false), eq(plannings.disabled, true)) :
      filter === "trashed"   ? isNotNull(plannings.deletedAt) :
      undefined  // "all"
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

export type BaselineRow = {
  id: string;
  name: string;
  createdAt: Date;
  phases: Record<string, { startDate: string; endDate: string }>;
  milestones: Record<string, { date: string }>;
};

export type BaselineMeta = { id: string; name: string; createdAt: Date };

export async function getLatestBaselineForPlanning(planningId: string): Promise<BaselineRow | null> {
  const [row] = await db
    .select()
    .from(baselines)
    .where(eq(baselines.planningId, planningId))
    .orderBy(desc(baselines.createdAt))
    .limit(1);

  if (!row) return null;
  const snap = row.snapshot as { phases: Record<string, { startDate: string; endDate: string }>; milestones: Record<string, { date: string }> };
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    phases: snap.phases ?? {},
    milestones: snap.milestones ?? {},
  };
}

export async function listBaselinesForPlanning(planningId: string): Promise<BaselineMeta[]> {
  return db
    .select({ id: baselines.id, name: baselines.name, createdAt: baselines.createdAt })
    .from(baselines)
    .where(eq(baselines.planningId, planningId))
    .orderBy(desc(baselines.createdAt));
}

export async function getGanttDataByToken(token: string): Promise<GanttData | null> {
  const [shareToken] = await db
    .select({ planningId: shareTokens.planningId, expiresAt: shareTokens.expiresAt })
    .from(shareTokens)
    .where(eq(shareTokens.token, token))
    .limit(1);

  if (!shareToken) return null;
  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) return null;

  return getGanttData(shareToken.planningId);
}

// ── Vue Portefeuille ─────────────────────────────────────────────────────────

export type PortfolioCard = {
  id: string;
  name: string;
  phaseCount: number;
  milestoneCount: number;
  avgProgress: number;
  latePhaseCount: number;
  upcomingMilestones: { id: string; label: string; date: string; color: string | null }[];
  overdueMilestones:  { id: string; label: string; date: string; color: string | null }[];
  status: "on-track" | "at-risk" | "late";
};

export async function getPortfolioData(userId?: string): Promise<PortfolioCard[]> {
  const planningList = userId
    ? await listPlanningsForUser(userId)
    : await listPlannings("active");
  if (planningList.length === 0) return [];

  const planningIds = planningList.map((p) => p.id);

  const today = new Date().toISOString().slice(0, 10);
  const in30  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const in7   = new Date(Date.now() +  7 * 86400000).toISOString().slice(0, 10);

  const [allPhases, allMilestones] = await Promise.all([
    db
      .select({
        id:        phases.id,
        endDate:   phases.endDate,
        progress:  phases.progress,
        status:    phases.status,
        planningId: lots.planningId,
      })
      .from(phases)
      .innerJoin(lots, eq(phases.lotId, lots.id))
      .where(inArray(lots.planningId, planningIds)),
    db
      .select({
        id:        milestones.id,
        label:     milestones.label,
        date:      milestones.date,
        color:     milestones.color,
        planningId: lots.planningId,
      })
      .from(milestones)
      .innerJoin(lots, eq(milestones.lotId, lots.id))
      .where(inArray(lots.planningId, planningIds)),
  ]);

  return planningList.map((planning) => {
    const pPhases    = allPhases.filter((p) => p.planningId === planning.id);
    const pMilestones = allMilestones.filter((m) => m.planningId === planning.id);

    const avgProgress =
      pPhases.length > 0
        ? Math.round(pPhases.reduce((sum, p) => sum + (p.progress ?? 0), 0) / pPhases.length)
        : 0;

    const latePhases = pPhases.filter((p) => p.endDate < today && p.status !== "done");

    const upcomingMilestones = pMilestones
      .filter((m) => m.date >= today && m.date <= in30)
      .sort((a, b) => a.date.localeCompare(b.date));

    const overdueMilestones = pMilestones
      .filter((m) => m.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));

    const status: "on-track" | "at-risk" | "late" =
      latePhases.length > 0 || overdueMilestones.length > 0
        ? "late"
        : upcomingMilestones.some((m) => m.date <= in7)
        ? "at-risk"
        : "on-track";

    return {
      id: planning.id,
      name: planning.name,
      phaseCount:    pPhases.length,
      milestoneCount: pMilestones.length,
      avgProgress,
      latePhaseCount: latePhases.length,
      upcomingMilestones: upcomingMilestones.slice(0, 5).map((m) => ({
        id: m.id, label: m.label, date: m.date, color: m.color,
      })),
      overdueMilestones: overdueMilestones.slice(0, 3).map((m) => ({
        id: m.id, label: m.label, date: m.date, color: m.color,
      })),
      status,
    };
  });
}

// ---------------------------------------------------------------------------
// Annuaire partagé — tous les contacts de la plateforme
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "user" | "contact";

export type DirectoryContact = {
  userId: string;
  name: string | null;
  email: string;
  initials: string | null;
  color: string | null;
  disabledAt: Date | null;
  role: UserRole;
  allowInternational: boolean;
  plannings: { id: string; memberId: string; name: string; permission: string }[];
};

export async function listAllDirectoryContacts(): Promise<DirectoryContact[]> {
  const rows = await db
    .select({
      userId:       users.id,
      name:         users.name,
      email:        users.email,
      initials:     planningMembers.initials,
      color:        planningMembers.color,
      disabledAt:   users.disabledAt,
      role:         users.role,
      allowInternational: users.allowInternational,
      memberId:     planningMembers.id,
      planningId:   plannings.id,
      planningName: plannings.name,
      permission:   planningMembers.permission,
    })
    .from(users)
    .leftJoin(planningMembers, eq(planningMembers.userId, users.id))
    .leftJoin(plannings, eq(plannings.id, planningMembers.planningId))
    .orderBy(asc(users.name));

  const map = new Map<string, DirectoryContact>();
  for (const row of rows) {
    if (!map.has(row.userId)) {
      map.set(row.userId, {
        userId:     row.userId,
        name:       row.name,
        email:      row.email,
        initials:   row.initials ?? null,
        color:      row.color ?? null,
        disabledAt: row.disabledAt ?? null,
        role:       (row.role as UserRole) ?? "contact",
        allowInternational: row.allowInternational ?? false,
        plannings:  [],
      });
    }
    const contact = map.get(row.userId)!;
    if (!contact.initials && row.initials) contact.initials = row.initials;
    if (!contact.color   && row.color)    contact.color    = row.color;
    if (row.planningId && row.planningName && row.memberId) {
      contact.plannings.push({
        id:         row.planningId,
        memberId:   row.memberId,
        name:       row.planningName,
        permission: row.permission ?? "viewer",
      });
    }
  }
  return Array.from(map.values());
}
