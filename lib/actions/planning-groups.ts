"use server";
/**
 * planning-groups.ts
 * Server actions for managing planning sync groups (linking/unlinking plannings).
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  planningGroups, planningGroupMembers, phaseSyncGroups,
  milestoneSyncGroups, phases, milestones, lots, planningMembers, plannings,
} from "@/lib/db/schema";
import { eq, and, inArray, ne, isNull, asc } from "drizzle-orm";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Permission guard (owner or admin only for sync group management)
// ---------------------------------------------------------------------------

async function assertIsOwnerOrAdmin(planningId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié.");
  if (session.user.role === "admin") return session.user.id;

  const [member] = await db
    .select({ permission: planningMembers.permission })
    .from(planningMembers)
    .where(and(
      eq(planningMembers.planningId, planningId),
      eq(planningMembers.userId, session.user.id),
    ))
    .limit(1);

  if (!member || member.permission !== "owner")
    throw new Error("Seul le propriétaire peut gérer les liens entre plannings.");

  return session.user.id;
}

// ---------------------------------------------------------------------------
// Create a sync group linking two plannings
// ---------------------------------------------------------------------------

const CreatePlanningLinkSchema = z.object({
  sourcePlanningId: z.string().uuid(),
  targetPlanningId: z.string().uuid(),
  groupName: z.string().min(1).max(200),
});

export async function createPlanningLink(input: z.infer<typeof CreatePlanningLinkSchema>) {
  const data = CreatePlanningLinkSchema.parse(input);
  if (data.sourcePlanningId === data.targetPlanningId)
    throw new Error("Un planning ne peut pas être lié à lui-même.");

  const actorId = await assertIsOwnerOrAdmin(data.sourcePlanningId);

  // Check actor has at least view access to the target planning (unless admin)
  const session = await auth();
  if (session?.user?.role !== "admin") {
    const [targetAccess] = await db
      .select({ permission: planningMembers.permission })
      .from(planningMembers)
      .where(and(
        eq(planningMembers.planningId, data.targetPlanningId),
        eq(planningMembers.userId, actorId),
      ))
      .limit(1);
    if (!targetAccess)
      throw new Error("Vous n'avez pas accès au planning cible.");
  }

  // Check if a group already links these two plannings
  const existingMemberships = await db
    .select({ groupId: planningGroupMembers.groupId })
    .from(planningGroupMembers)
    .where(eq(planningGroupMembers.planningId, data.sourcePlanningId));

  for (const { groupId } of existingMemberships) {
    const [alreadyLinked] = await db
      .select({ groupId: planningGroupMembers.groupId })
      .from(planningGroupMembers)
      .where(and(
        eq(planningGroupMembers.groupId, groupId),
        eq(planningGroupMembers.planningId, data.targetPlanningId),
      ))
      .limit(1);
    if (alreadyLinked) throw new Error("Ces deux plannings sont déjà liés.");
  }

  // Create the group
  const [newGroup] = await db
    .insert(planningGroups)
    .values({ name: data.groupName, createdBy: actorId })
    .returning({ id: planningGroups.id });

  // Add both plannings as members
  await db.insert(planningGroupMembers).values([
    { groupId: newGroup.id, planningId: data.sourcePlanningId, addedBy: actorId },
    { groupId: newGroup.id, planningId: data.targetPlanningId, addedBy: actorId },
  ]);

  revalidatePath(`/parametres`);
  return newGroup.id;
}

// ---------------------------------------------------------------------------
// Remove a planning from a sync group (and clean up empty groups)
// ---------------------------------------------------------------------------

const RemovePlanningLinkSchema = z.object({
  groupId: z.string().uuid(),
  planningId: z.string().uuid(),
});

export async function removePlanningFromSyncGroup(input: z.infer<typeof RemovePlanningLinkSchema>) {
  const data = RemovePlanningLinkSchema.parse(input);
  await assertIsOwnerOrAdmin(data.planningId);

  // Nullify sync_group_id on all phases of this planning that belong to this group's sync groups
  const phaseGroupIds = await db
    .select({ id: phaseSyncGroups.id })
    .from(phaseSyncGroups)
    .where(eq(phaseSyncGroups.planningGroupId, data.groupId));

  if (phaseGroupIds.length > 0) {
    const ids = phaseGroupIds.map((r) => r.id);
    // Get lots belonging to this planning
    const planningLots = await db
      .select({ id: lots.id })
      .from(lots)
      .where(eq(lots.planningId, data.planningId));

    if (planningLots.length > 0) {
      const lotIds = planningLots.map((l) => l.id);
      await db
        .update(phases)
        .set({ syncGroupId: null })
        .where(and(
          inArray(phases.syncGroupId, ids),
          inArray(phases.lotId, lotIds),
        ));
    }
  }

  // Nullify sync_group_id on all milestones of this planning in this group
  const msGroupIds = await db
    .select({ id: milestoneSyncGroups.id })
    .from(milestoneSyncGroups)
    .where(eq(milestoneSyncGroups.planningGroupId, data.groupId));

  if (msGroupIds.length > 0) {
    const ids = msGroupIds.map((r) => r.id);
    const planningLots = await db
      .select({ id: lots.id })
      .from(lots)
      .where(eq(lots.planningId, data.planningId));

    if (planningLots.length > 0) {
      const lotIds = planningLots.map((l) => l.id);
      await db
        .update(milestones)
        .set({ syncGroupId: null })
        .where(and(
          inArray(milestones.syncGroupId, ids),
          inArray(milestones.lotId, lotIds),
        ));
    }
  }

  // Remove from group
  await db
    .delete(planningGroupMembers)
    .where(and(
      eq(planningGroupMembers.groupId, data.groupId),
      eq(planningGroupMembers.planningId, data.planningId),
    ));

  // If fewer than 2 members remain, delete the group entirely
  const remaining = await db
    .select({ planningId: planningGroupMembers.planningId })
    .from(planningGroupMembers)
    .where(eq(planningGroupMembers.groupId, data.groupId));

  if (remaining.length < 2) {
    // Clean up orphan sync groups and the planning_groups entry
    await db.delete(phaseSyncGroups).where(eq(phaseSyncGroups.planningGroupId, data.groupId));
    await db.delete(milestoneSyncGroups).where(eq(milestoneSyncGroups.planningGroupId, data.groupId));
    await db.delete(planningGroupMembers).where(eq(planningGroupMembers.groupId, data.groupId));
    await db.delete(planningGroups).where(eq(planningGroups.id, data.groupId));
  }

  revalidatePath(`/parametres`);
}

// ---------------------------------------------------------------------------
// Link a phase to a sister phase in another planning (same sync group)
// ---------------------------------------------------------------------------

const LinkPhasesSchema = z.object({
  sourcePhaseId: z.string().uuid(),
  targetPhaseId: z.string().uuid(),
  planningGroupId: z.string().uuid(),
  planningId: z.string().uuid(),
});

export async function linkPhases(input: z.infer<typeof LinkPhasesSchema>) {
  const data = LinkPhasesSchema.parse(input);
  await assertIsOwnerOrAdmin(data.planningId);

  // If source phase already has a syncGroupId, reuse it (N-way add)
  const [sourcePhase] = await db
    .select({ syncGroupId: phases.syncGroupId })
    .from(phases)
    .where(eq(phases.id, data.sourcePhaseId))
    .limit(1);

  let syncGroupId: string;

  if (sourcePhase?.syncGroupId) {
    syncGroupId = sourcePhase.syncGroupId;
  } else {
    const [newSyncGroup] = await db
      .insert(phaseSyncGroups)
      .values({ planningGroupId: data.planningGroupId })
      .returning({ id: phaseSyncGroups.id });
    syncGroupId = newSyncGroup.id;
  }

  // Assign both phases to this sync group
  await db.update(phases)
    .set({ syncGroupId, version: 0 })
    .where(inArray(phases.id, [data.sourcePhaseId, data.targetPhaseId]));

  revalidatePath(`/parametres`);
  revalidatePath(`/p/${data.planningId}`);
  return syncGroupId;
}

// ---------------------------------------------------------------------------
// Unlink a phase from its sync group
// ---------------------------------------------------------------------------

export async function unlinkPhase(phaseId: string, planningId: string) {
  await assertIsOwnerOrAdmin(planningId);
  await db.update(phases).set({ syncGroupId: null }).where(eq(phases.id, phaseId));
  revalidatePath(`/parametres`);
}

// ---------------------------------------------------------------------------
// Link a milestone to a sister milestone in another planning
// ---------------------------------------------------------------------------

const LinkMilestonesSchema = z.object({
  sourceMilestoneId: z.string().uuid(),
  targetMilestoneId: z.string().uuid(),
  planningGroupId: z.string().uuid(),
  planningId: z.string().uuid(),
});

export async function linkMilestones(input: z.infer<typeof LinkMilestonesSchema>) {
  const data = LinkMilestonesSchema.parse(input);
  await assertIsOwnerOrAdmin(data.planningId);

  // If source milestone already has a syncGroupId, reuse it (N-way add)
  const [sourceMilestone] = await db
    .select({ syncGroupId: milestones.syncGroupId })
    .from(milestones)
    .where(eq(milestones.id, data.sourceMilestoneId))
    .limit(1);

  let syncGroupId: string;

  if (sourceMilestone?.syncGroupId) {
    syncGroupId = sourceMilestone.syncGroupId;
  } else {
    const [newSyncGroup] = await db
      .insert(milestoneSyncGroups)
      .values({ planningGroupId: data.planningGroupId })
      .returning({ id: milestoneSyncGroups.id });
    syncGroupId = newSyncGroup.id;
  }

  await db.update(milestones)
    .set({ syncGroupId, version: 0 })
    .where(inArray(milestones.id, [data.sourceMilestoneId, data.targetMilestoneId]));

  revalidatePath(`/parametres`);
  revalidatePath(`/p/${data.planningId}`);
  return syncGroupId;
}

// ---------------------------------------------------------------------------
// Unlink a milestone from its sync group
// ---------------------------------------------------------------------------

export async function unlinkMilestone(milestoneId: string, planningId: string) {
  await assertIsOwnerOrAdmin(planningId);
  await db.update(milestones).set({ syncGroupId: null }).where(eq(milestones.id, milestoneId));
  revalidatePath(`/parametres`);
}

// ---------------------------------------------------------------------------
// Add an existing planning to an existing sync group
// ---------------------------------------------------------------------------

const AddPlanningToGroupSchema = z.object({
  groupId: z.string().uuid(),
  planningId: z.string().uuid(),
  sourcePlanningId: z.string().uuid(),
});

export async function addPlanningToSyncGroup(input: z.infer<typeof AddPlanningToGroupSchema>) {
  const data = AddPlanningToGroupSchema.parse(input);
  await assertIsOwnerOrAdmin(data.sourcePlanningId);

  // Check not already a member
  const [existing] = await db
    .select({ groupId: planningGroupMembers.groupId })
    .from(planningGroupMembers)
    .where(and(
      eq(planningGroupMembers.groupId, data.groupId),
      eq(planningGroupMembers.planningId, data.planningId),
    ))
    .limit(1);

  if (existing) throw new Error("Ce planning est déjà membre de ce groupe.");

  const session = await auth();
  await db.insert(planningGroupMembers).values({
    groupId: data.groupId,
    planningId: data.planningId,
    addedBy: session!.user!.id!,
  });

  revalidatePath(`/parametres`);
}

// ---------------------------------------------------------------------------
// Types for sync candidate pickers
// ---------------------------------------------------------------------------

export type PhaseSyncCandidate = {
  phaseId: string;
  phaseLabel: string | null;
  phaseType: string;
  lotName: string;
  planningId: string;
  planningName: string;
  groupId: string;
};

export type MilestoneSyncCandidate = {
  milestoneId: string;
  milestoneLabel: string;
  milestoneType: string;
  lotName: string;
  planningId: string;
  planningName: string;
  groupId: string;
};

// ---------------------------------------------------------------------------
// Get unsynced phases from linked plannings (for the EditPanel link picker)
// ---------------------------------------------------------------------------

export async function getSyncCandidates(phaseId: string, planningId: string): Promise<PhaseSyncCandidate[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const memberships = await db
    .select({ groupId: planningGroupMembers.groupId })
    .from(planningGroupMembers)
    .where(eq(planningGroupMembers.planningId, planningId));

  if (!memberships.length) return [];
  const groupIds = memberships.map((m) => m.groupId);

  const otherMembers = await db
    .select({ planningId: planningGroupMembers.planningId, groupId: planningGroupMembers.groupId })
    .from(planningGroupMembers)
    .where(and(
      inArray(planningGroupMembers.groupId, groupIds),
      ne(planningGroupMembers.planningId, planningId),
    ));

  if (!otherMembers.length) return [];

  const otherPlanningIds = [...new Set(otherMembers.map((m) => m.planningId))];

  const [planningsRows, otherLots, currentPhaseRows] = await Promise.all([
    db.select({ id: plannings.id, name: plannings.name })
      .from(plannings)
      .where(inArray(plannings.id, otherPlanningIds)),
    db.select({ id: lots.id, name: lots.name, planningId: lots.planningId })
      .from(lots)
      .where(inArray(lots.planningId, otherPlanningIds)),
    db.select({ label: phases.label, type: phases.type })
      .from(phases)
      .where(eq(phases.id, phaseId))
      .limit(1),
  ]);

  if (!otherLots.length) return [];

  const planningNameMap = Object.fromEntries(planningsRows.map((p) => [p.id, p.name]));
  const lotMap = Object.fromEntries(otherLots.map((l) => [l.id, l]));
  const otherLotIds = otherLots.map((l) => l.id);
  const currentLabel = currentPhaseRows[0]?.label ?? null;
  const currentType = currentPhaseRows[0]?.type ?? "";

  const candidatePhases = await db
    .select({ id: phases.id, label: phases.label, type: phases.type, lotId: phases.lotId })
    .from(phases)
    .where(and(inArray(phases.lotId, otherLotIds), isNull(phases.syncGroupId)));

  return candidatePhases
    .map((p) => {
      const lot = lotMap[p.lotId];
      const linkedPlanningId = lot.planningId;
      const groupId = otherMembers.find((m) => m.planningId === linkedPlanningId)?.groupId ?? groupIds[0];
      return {
        phaseId: p.id,
        phaseLabel: p.label,
        phaseType: p.type,
        lotName: lot.name,
        planningId: linkedPlanningId,
        planningName: planningNameMap[linkedPlanningId] ?? "Inconnu",
        groupId,
      };
    })
    .sort((a, b) => {
      const aMatch = a.phaseLabel === currentLabel && currentLabel !== null || (!a.phaseLabel && a.phaseType === currentType);
      const bMatch = b.phaseLabel === currentLabel && currentLabel !== null || (!b.phaseLabel && b.phaseType === currentType);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return (a.phaseLabel ?? a.phaseType).localeCompare(b.phaseLabel ?? b.phaseType);
    });
}

// ---------------------------------------------------------------------------
// Get unsynced milestones from linked plannings (for the EditPanel link picker)
// ---------------------------------------------------------------------------

export async function getMilestoneSyncCandidates(milestoneId: string, planningId: string): Promise<MilestoneSyncCandidate[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const memberships = await db
    .select({ groupId: planningGroupMembers.groupId })
    .from(planningGroupMembers)
    .where(eq(planningGroupMembers.planningId, planningId));

  if (!memberships.length) return [];
  const groupIds = memberships.map((m) => m.groupId);

  const otherMembers = await db
    .select({ planningId: planningGroupMembers.planningId, groupId: planningGroupMembers.groupId })
    .from(planningGroupMembers)
    .where(and(
      inArray(planningGroupMembers.groupId, groupIds),
      ne(planningGroupMembers.planningId, planningId),
    ));

  if (!otherMembers.length) return [];

  const otherPlanningIds = [...new Set(otherMembers.map((m) => m.planningId))];

  const [planningsRows, otherLots, currentMsRows] = await Promise.all([
    db.select({ id: plannings.id, name: plannings.name })
      .from(plannings)
      .where(inArray(plannings.id, otherPlanningIds)),
    db.select({ id: lots.id, name: lots.name, planningId: lots.planningId })
      .from(lots)
      .where(inArray(lots.planningId, otherPlanningIds)),
    db.select({ label: milestones.label })
      .from(milestones)
      .where(eq(milestones.id, milestoneId))
      .limit(1),
  ]);

  if (!otherLots.length) return [];

  const planningNameMap = Object.fromEntries(planningsRows.map((p) => [p.id, p.name]));
  const lotMap = Object.fromEntries(otherLots.map((l) => [l.id, l]));
  const otherLotIds = otherLots.map((l) => l.id);
  const currentLabel = currentMsRows[0]?.label ?? "";

  const candidateMilestones = await db
    .select({ id: milestones.id, label: milestones.label, type: milestones.type, lotId: milestones.lotId })
    .from(milestones)
    .where(and(inArray(milestones.lotId, otherLotIds), isNull(milestones.syncGroupId)));

  return candidateMilestones
    .map((m) => {
      const lot = lotMap[m.lotId];
      const linkedPlanningId = lot.planningId;
      const groupId = otherMembers.find((om) => om.planningId === linkedPlanningId)?.groupId ?? groupIds[0];
      return {
        milestoneId: m.id,
        milestoneLabel: m.label,
        milestoneType: m.type,
        lotName: lot.name,
        planningId: linkedPlanningId,
        planningName: planningNameMap[linkedPlanningId] ?? "Inconnu",
        groupId,
      };
    })
    .sort((a, b) => {
      if (a.milestoneLabel === currentLabel && b.milestoneLabel !== currentLabel) return -1;
      if (b.milestoneLabel === currentLabel && a.milestoneLabel !== currentLabel) return 1;
      return a.milestoneLabel.localeCompare(b.milestoneLabel);
    });
}

// ---------------------------------------------------------------------------
// Bulk-link all phases/milestones of a lot by matching label across linked plannings
// ---------------------------------------------------------------------------

const BulkLinkLotSchema = z.object({
  sourceLotId: z.string().uuid(),
  planningGroupId: z.string().uuid(),
  planningId: z.string().uuid(),
});

export async function bulkLinkLot(
  input: z.infer<typeof BulkLinkLotSchema>,
): Promise<{ linkedPhases: number; linkedMilestones: number }> {
  const data = BulkLinkLotSchema.parse(input);
  await assertIsOwnerOrAdmin(data.planningId);

  // Get other plannings in this group
  const otherMembers = await db
    .select({ planningId: planningGroupMembers.planningId })
    .from(planningGroupMembers)
    .where(and(
      eq(planningGroupMembers.groupId, data.planningGroupId),
      ne(planningGroupMembers.planningId, data.planningId),
    ));

  if (!otherMembers.length) return { linkedPhases: 0, linkedMilestones: 0 };

  const otherPlanningIds = otherMembers.map((m) => m.planningId);

  // Get lots from other plannings
  const targetLots = await db
    .select({ id: lots.id })
    .from(lots)
    .where(inArray(lots.planningId, otherPlanningIds));

  if (!targetLots.length) return { linkedPhases: 0, linkedMilestones: 0 };
  const targetLotIds = targetLots.map((l) => l.id);

  // Fetch unsynced source phases and target phases in parallel
  const [sourcePhases, targetPhases, sourceMilestones, targetMilestones] = await Promise.all([
    db.select({ id: phases.id, label: phases.label, type: phases.type })
      .from(phases)
      .where(and(eq(phases.lotId, data.sourceLotId), isNull(phases.syncGroupId))),
    db.select({ id: phases.id, label: phases.label, type: phases.type })
      .from(phases)
      .where(and(inArray(phases.lotId, targetLotIds), isNull(phases.syncGroupId))),
    db.select({ id: milestones.id, label: milestones.label })
      .from(milestones)
      .where(and(eq(milestones.lotId, data.sourceLotId), isNull(milestones.syncGroupId))),
    db.select({ id: milestones.id, label: milestones.label })
      .from(milestones)
      .where(and(inArray(milestones.lotId, targetLotIds), isNull(milestones.syncGroupId))),
  ]);

  const usedTargetPhaseIds = new Set<string>();
  let linkedPhases = 0;

  for (const sp of sourcePhases) {
    const labelKey = sp.label ?? sp.type;
    const match = targetPhases.find(
      (tp) => !usedTargetPhaseIds.has(tp.id) && (tp.label === sp.label || (!sp.label && !tp.label && tp.type === sp.type)),
    );
    if (!match) continue;

    const [newSyncGroup] = await db
      .insert(phaseSyncGroups)
      .values({ planningGroupId: data.planningGroupId })
      .returning({ id: phaseSyncGroups.id });

    await db.update(phases)
      .set({ syncGroupId: newSyncGroup.id, version: 0 })
      .where(inArray(phases.id, [sp.id, match.id]));

    usedTargetPhaseIds.add(match.id);
    linkedPhases++;
    void labelKey; // suppress unused warning
  }

  const usedTargetMsIds = new Set<string>();
  let linkedMilestones = 0;

  for (const sm of sourceMilestones) {
    const match = targetMilestones.find(
      (tm) => !usedTargetMsIds.has(tm.id) && tm.label === sm.label,
    );
    if (!match) continue;

    const [newSyncGroup] = await db
      .insert(milestoneSyncGroups)
      .values({ planningGroupId: data.planningGroupId })
      .returning({ id: milestoneSyncGroups.id });

    await db.update(milestones)
      .set({ syncGroupId: newSyncGroup.id, version: 0 })
      .where(inArray(milestones.id, [sm.id, match.id]));

    usedTargetMsIds.add(match.id);
    linkedMilestones++;
  }

  revalidatePath(`/parametres`);
  revalidatePath(`/p/${data.planningId}`);
  return { linkedPhases, linkedMilestones };
}
