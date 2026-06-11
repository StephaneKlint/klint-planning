"use server";
/**
 * lib/actions/planning.ts
 * Server Actions for planning mutations.
 * Jalon 4: CRUD phases, lots, milestones.
 * Jalon 5: assertCanEdit will enforce permissions with real auth.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { phases, lots, domains, milestones, activityLog, planningMembers, users, phaseAssignees } from "@/lib/db/schema";
import { eq, inArray, gte, and } from "drizzle-orm";
import { getGanttData } from "@/lib/db/queries";
import type { GanttData } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Permission guard (placeholder — real auth in Jalon 5)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function assertCanEdit(_planningId: string): Promise<void> {
  // TODO Jalon 5: verify user session + planning_member.permission !== 'viewer'
}

// ---------------------------------------------------------------------------
// Activity log helper
// ---------------------------------------------------------------------------
async function logActivity(
  planningId: string,
  verb: string,
  targetType: string,
  targetId: string,
  summary: string,
  meta?: Record<string, unknown>
) {
  await db.insert(activityLog).values({
    planningId,
    verb,
    targetType,
    targetId,
    summary,
    meta: meta ?? null,
  });
}

// ---------------------------------------------------------------------------
// Phase mutations
// ---------------------------------------------------------------------------

const UpdatePhaseStatusSchema = z.object({
  phaseId: z.string().uuid(),
  planningId: z.string().uuid(),
  status: z.enum(["planned", "in_progress", "review", "done", "risk", "late"]).nullable(),
});

export async function updatePhaseStatus(input: z.infer<typeof UpdatePhaseStatusSchema>) {
  const data = UpdatePhaseStatusSchema.parse(input);
  await assertCanEdit(data.planningId);

  const [updated] = await db
    .update(phases)
    .set({ status: data.status })
    .where(eq(phases.id, data.phaseId))
    .returning({ id: phases.id, status: phases.status });

  await logActivity(data.planningId, "status_changed", "phase", data.phaseId,
    `Statut mis à jour → ${data.status ?? "auto"}`);

  revalidatePath(`/p/${data.planningId}`);
  return updated;
}

const UpdatePhaseProgressSchema = z.object({
  phaseId: z.string().uuid(),
  planningId: z.string().uuid(),
  progress: z.number().int().min(0).max(100),
});

export async function updatePhaseProgress(input: z.infer<typeof UpdatePhaseProgressSchema>) {
  const data = UpdatePhaseProgressSchema.parse(input);
  await assertCanEdit(data.planningId);

  const [updated] = await db
    .update(phases)
    .set({ progress: data.progress })
    .where(eq(phases.id, data.phaseId))
    .returning({ id: phases.id, progress: phases.progress });

  await logActivity(data.planningId, "progress_updated", "phase", data.phaseId,
    `Avancement → ${data.progress}%`, { progress: data.progress });

  revalidatePath(`/p/${data.planningId}`);
  return updated;
}

const UpdatePhaseDatesSchema = z.object({
  phaseId: z.string().uuid(),
  planningId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function updatePhaseDates(input: z.infer<typeof UpdatePhaseDatesSchema>) {
  const data = UpdatePhaseDatesSchema.parse(input);
  await assertCanEdit(data.planningId);

  if (data.startDate > data.endDate) {
    throw new Error("La date de début doit être avant la date de fin.");
  }

  const [updated] = await db
    .update(phases)
    .set({ startDate: data.startDate, endDate: data.endDate })
    .where(eq(phases.id, data.phaseId))
    .returning({ id: phases.id, startDate: phases.startDate, endDate: phases.endDate });

  await logActivity(data.planningId, "moved", "phase", data.phaseId,
    `Déplacé : ${data.startDate} → ${data.endDate}`);

  revalidatePath(`/p/${data.planningId}`);
  return updated;
}

const UpdatePhaseLabelSchema = z.object({
  phaseId: z.string().uuid(),
  planningId: z.string().uuid(),
  label: z.string().max(200).nullable(),
});

export async function updatePhaseLabel(input: z.infer<typeof UpdatePhaseLabelSchema>) {
  const data = UpdatePhaseLabelSchema.parse(input);
  await assertCanEdit(data.planningId);

  const [updated] = await db
    .update(phases)
    .set({ label: data.label })
    .where(eq(phases.id, data.phaseId))
    .returning({ id: phases.id, label: phases.label });

  revalidatePath(`/p/${data.planningId}`);
  return updated;
}

const UpdatePhaseNoteSchema = z.object({
  phaseId: z.string().uuid(),
  planningId: z.string().uuid(),
  note: z.string().max(2000).nullable(),
});

export async function updatePhaseNote(input: z.infer<typeof UpdatePhaseNoteSchema>) {
  const data = UpdatePhaseNoteSchema.parse(input);
  await assertCanEdit(data.planningId);

  const [updated] = await db
    .update(phases)
    .set({ note: data.note })
    .where(eq(phases.id, data.phaseId))
    .returning({ id: phases.id, note: phases.note });

  revalidatePath(`/p/${data.planningId}`);
  return updated;
}

const UpdatePhaseColorSchema = z.object({
  phaseId: z.string().uuid(),
  planningId: z.string().uuid(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
});

export async function updatePhaseColor(input: z.infer<typeof UpdatePhaseColorSchema>) {
  const data = UpdatePhaseColorSchema.parse(input);
  await assertCanEdit(data.planningId);

  const [updated] = await db
    .update(phases)
    .set({ color: data.color })
    .where(eq(phases.id, data.phaseId))
    .returning({ id: phases.id, color: phases.color });

  revalidatePath(`/p/${data.planningId}`);
  return updated;
}

// Bulk status update
const BulkUpdateStatusSchema = z.object({
  phaseIds: z.array(z.string().uuid()).min(1).max(100),
  planningId: z.string().uuid(),
  status: z.enum(["planned", "in_progress", "review", "done", "risk", "late"]),
});

export async function bulkUpdatePhaseStatus(input: z.infer<typeof BulkUpdateStatusSchema>) {
  const data = BulkUpdateStatusSchema.parse(input);
  await assertCanEdit(data.planningId);

  await db
    .update(phases)
    .set({ status: data.status })
    .where(inArray(phases.id, data.phaseIds));

  await logActivity(data.planningId, "bulk_status_changed", "phase", data.phaseIds[0],
    `${data.phaseIds.length} phases → statut ${data.status}`,
    { phaseIds: data.phaseIds, status: data.status });

  revalidatePath(`/p/${data.planningId}`);
}

// ---------------------------------------------------------------------------
// Domain creation
// ---------------------------------------------------------------------------

const CreateDomainSchema = z.object({
  planningId: z.string().uuid(),
  code:       z.string().min(1).max(10).toUpperCase(),
  name:       z.string().min(1).max(80),
  bg:         z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  bgAlt:      z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  strong:     z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  phaseColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function createDomain(input: z.infer<typeof CreateDomainSchema>) {
  const data = CreateDomainSchema.parse(input);
  await assertCanEdit(data.planningId);

  // Sort order = count of existing domains + 1
  const existing = await db.select({ id: domains.id }).from(domains)
    .where(eq(domains.planningId, data.planningId));

  const [newDomain] = await db.insert(domains).values({
    planningId: data.planningId,
    code:       data.code.toUpperCase().slice(0, 10),
    name:       data.name,
    bg:         data.bg,
    bgAlt:      data.bgAlt ?? data.bg,
    strong:     data.strong,
    phaseColor: data.phaseColor,
    sortOrder:  existing.length,
    collapsed:  false,
    cadence:    { livraison: 0, pmep: 10, cab: 12, mep: 15 },
  }).returning({ id: domains.id, name: domains.name });

  await logActivity(data.planningId, "created", "domain", newDomain.id, `Nouveau domaine : ${data.name}`);
  revalidatePath(`/p/${data.planningId}`);
  return newDomain;
}

// ---------------------------------------------------------------------------
// Lot creation
// ---------------------------------------------------------------------------

const CreateLotSchema = z.object({
  planningId: z.string().uuid(),
  domainId:   z.string().uuid(),
  name:       z.string().min(1).max(160),
  subtitle:   z.string().max(500).nullable().optional(),
});

export async function createLot(input: z.infer<typeof CreateLotSchema>) {
  const data = CreateLotSchema.parse(input);
  await assertCanEdit(data.planningId);

  const [newLot] = await db.insert(lots).values({
    planningId: data.planningId,
    domainId:   data.domainId,
    name:       data.name,
    subtitle:   data.subtitle ?? null,
    sortOrder:  999,
  }).returning({ id: lots.id, name: lots.name });

  await logActivity(data.planningId, "created", "lot", newLot.id, `Nouveau projet : ${data.name}`);
  revalidatePath(`/p/${data.planningId}`);
  return newLot;
}

// ---------------------------------------------------------------------------
// Phase creation
// ---------------------------------------------------------------------------

const CreatePhaseSchema = z.object({
  planningId: z.string().uuid(),
  lotId:      z.string().uuid(),
  type:       z.string().min(1).max(40),
  label:      z.string().max(200).nullable().optional(),
  startDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createPhase(input: z.infer<typeof CreatePhaseSchema>) {
  const data = CreatePhaseSchema.parse(input);
  await assertCanEdit(data.planningId);

  if (data.startDate > data.endDate) {
    throw new Error("La date de début doit être avant la date de fin.");
  }

  const [newPhase] = await db.insert(phases).values({
    lotId:     data.lotId,
    type:      data.type,
    label:     data.label ?? null,
    startDate: data.startDate,
    endDate:   data.endDate,
    progress:  0,
    sortOrder: 999,
  }).returning({ id: phases.id, type: phases.type });

  await logActivity(data.planningId, "created", "phase", newPhase.id, `Nouvelle phase : ${data.label ?? data.type}`);
  revalidatePath(`/p/${data.planningId}`);
  return newPhase;
}

// ---------------------------------------------------------------------------
// Lot mutations
// ---------------------------------------------------------------------------

const UpdateLotSchema = z.object({
  lotId: z.string().uuid(),
  planningId: z.string().uuid(),
  name: z.string().min(1).max(160).optional(),
  subtitle: z.string().max(500).nullable().optional(),
  hidden: z.boolean().optional(),
});

export async function updateLot(input: z.infer<typeof UpdateLotSchema>) {
  const data = UpdateLotSchema.parse(input);
  await assertCanEdit(data.planningId);

  const updates: Partial<{ name: string; subtitle: string | null; hidden: boolean }> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.subtitle !== undefined) updates.subtitle = data.subtitle;
  if (data.hidden !== undefined) updates.hidden = data.hidden;

  const [updated] = await db
    .update(lots)
    .set(updates)
    .where(eq(lots.id, data.lotId))
    .returning({ id: lots.id, name: lots.name, subtitle: lots.subtitle, hidden: lots.hidden });

  revalidatePath(`/p/${data.planningId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// Milestone mutations
// ---------------------------------------------------------------------------

const UpdateMilestoneSchema = z.object({
  milestoneId: z.string().uuid(),
  planningId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  label: z.string().min(1).max(200).optional(),
  note: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  type: z.string().max(40).optional(),
  labelPos: z.enum(["auto", "above", "below"]).optional(),
});

export async function updateMilestone(input: z.infer<typeof UpdateMilestoneSchema>) {
  const data = UpdateMilestoneSchema.parse(input);
  await assertCanEdit(data.planningId);

  const updates: Partial<{
    date: string; label: string; note: string | null;
    color: string | null; type: string; labelPos: "auto" | "above" | "below";
  }> = {};
  if (data.date    !== undefined) updates.date     = data.date;
  if (data.label   !== undefined) updates.label    = data.label;
  if (data.note    !== undefined) updates.note     = data.note;
  if (data.color   !== undefined) updates.color    = data.color;
  if (data.type    !== undefined) updates.type     = data.type;
  if (data.labelPos !== undefined) updates.labelPos = data.labelPos;

  const [updated] = await db
    .update(milestones)
    .set(updates)
    .where(eq(milestones.id, data.milestoneId))
    .returning({ id: milestones.id, date: milestones.date, label: milestones.label });

  const desc = data.date
    ? `Jalon déplacé au ${data.date}`
    : `Jalon modifié : ${data.label ?? ""}`;
  await logActivity(data.planningId, "updated", "milestone", data.milestoneId, desc);

  revalidatePath(`/p/${data.planningId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// Phase assignee toggle
// ---------------------------------------------------------------------------

const TogglePhaseAssigneeSchema = z.object({
  phaseId: z.string().uuid(),
  memberId: z.string().uuid(),
  planningId: z.string().uuid(),
});

export async function togglePhaseAssignee(input: z.infer<typeof TogglePhaseAssigneeSchema>) {
  const data = TogglePhaseAssigneeSchema.parse(input);
  await assertCanEdit(data.planningId);

  const existing = await db
    .select()
    .from(phaseAssignees)
    .where(and(eq(phaseAssignees.phaseId, data.phaseId), eq(phaseAssignees.memberId, data.memberId)));

  if (existing.length > 0) {
    await db
      .delete(phaseAssignees)
      .where(and(eq(phaseAssignees.phaseId, data.phaseId), eq(phaseAssignees.memberId, data.memberId)));
  } else {
    await db.insert(phaseAssignees).values({ phaseId: data.phaseId, memberId: data.memberId });
  }

  revalidatePath(`/p/${data.planningId}`);
}

// ---------------------------------------------------------------------------
// Data fetch action (callable from client via TanStack Query)
// Server Action boundary ensures DB code stays server-side.
// ---------------------------------------------------------------------------
export async function fetchPlanningData(planningId: string): Promise<GanttData | null> {
  return getGanttData(planningId);
}

// ---------------------------------------------------------------------------
// Présence — heartbeat + active members
// ---------------------------------------------------------------------------

/**
 * Heartbeat — met à jour last_seen_at pour le membre courant.
 * Appelé toutes les 30s côté client.
 * En Jalon 5, memberId viendra de la session auth.
 * Pour l'instant, on accepte le memberId passé par le client.
 */
export async function heartbeat(planningId: string, memberId: string): Promise<void> {
  if (!planningId || !memberId) return;
  await db
    .update(planningMembers)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(planningMembers.planningId, planningId),
        eq(planningMembers.id, memberId)
      )
    );
}

export interface ActiveMember {
  memberId: string;
  initials: string;
  color: string;
  userName: string;
}

/**
 * Retourne les membres actifs dans les 5 dernières minutes.
 * Appelé par TanStack Query (refetchInterval 30s).
 */
export async function getActiveMembers(planningId: string): Promise<ActiveMember[]> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const rows = await db
    .select({
      memberId: planningMembers.id,
      initials: planningMembers.initials,
      color: planningMembers.color,
      userName: users.name,
    })
    .from(planningMembers)
    .innerJoin(users, eq(planningMembers.userId, users.id))
    .where(
      and(
        eq(planningMembers.planningId, planningId),
        gte(planningMembers.lastSeenAt, fiveMinAgo)
      )
    );

  return rows.map((r) => ({
    memberId: r.memberId,
    initials: r.initials ?? "?",
    color: r.color ?? "#001D63",
    userName: r.userName,
  }));
}
