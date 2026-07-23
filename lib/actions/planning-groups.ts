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
  milestoneSyncGroups, phases, milestones, lots, planningMembers,
} from "@/lib/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
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

  // Find or create a phase_sync_group for this planning group
  const [existingGroup] = await db
    .select({ id: phaseSyncGroups.id })
    .from(phaseSyncGroups)
    .where(eq(phaseSyncGroups.planningGroupId, data.planningGroupId))
    .limit(1);

  let syncGroupId: string;

  if (existingGroup) {
    syncGroupId = existingGroup.id;
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

  const [existingGroup] = await db
    .select({ id: milestoneSyncGroups.id })
    .from(milestoneSyncGroups)
    .where(eq(milestoneSyncGroups.planningGroupId, data.planningGroupId))
    .limit(1);

  let syncGroupId: string;

  if (existingGroup) {
    syncGroupId = existingGroup.id;
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
