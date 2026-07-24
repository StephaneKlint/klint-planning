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
  domains, phaseItems, phaseAssignees,
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

  // Normalize label for matching: use label if set, otherwise type; lowercase + trim
  const phaseKey = (label: string | null, type: string) =>
    (label ?? type).trim().toLowerCase();

  // Get the source lot name to match by name in other plannings
  const [sourceLot] = await db
    .select({ name: lots.name })
    .from(lots)
    .where(eq(lots.id, data.sourceLotId));

  if (!sourceLot) return { linkedPhases: 0, linkedMilestones: 0 };

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

  // Only match lots with the SAME NAME as the source lot
  const targetLots = await db
    .select({ id: lots.id })
    .from(lots)
    .where(and(
      inArray(lots.planningId, otherPlanningIds),
      eq(lots.name, sourceLot.name),
    ));

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
    const match = targetPhases.find(
      (tp) => !usedTargetPhaseIds.has(tp.id) &&
        phaseKey(tp.label, tp.type) === phaseKey(sp.label, sp.type),
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
  }

  const usedTargetMsIds = new Set<string>();
  let linkedMilestones = 0;

  for (const sm of sourceMilestones) {
    const match = targetMilestones.find(
      (tm) => !usedTargetMsIds.has(tm.id) &&
        (sm.label ?? "").trim().toLowerCase() === (tm.label ?? "").trim().toLowerCase(),
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

  // Revalidate all plannings in the group, not just the current one
  for (const m of otherMembers) {
    revalidatePath(`/p/${m.planningId}`);
  }
  revalidatePath(`/parametres`);
  revalidatePath(`/p/${data.planningId}`);
  return { linkedPhases, linkedMilestones };
}

// ---------------------------------------------------------------------------
// Types for structural diff/sync
// ---------------------------------------------------------------------------

export type PhaseDiffItem = {
  sourcePhaseId: string;
  label: string | null;
  type: string;
};

export type MilestoneDiffItem = {
  sourceMilestoneId: string;
  label: string;
};

export type LotDiffEntry = {
  sourceLotId: string;
  lotName: string;
  domainName: string;
  isNewLot: boolean;
  sourcePlanningId: string;
  sourcePlanningName: string;
  phases: PhaseDiffItem[];
  milestones: MilestoneDiffItem[];
};

export type StructureDiff = {
  targetPlanningId: string;
  targetPlanningName: string;
  lotDiffs: LotDiffEntry[];
  totalLotsToCreate: number;
  totalPhasesToCreate: number;
  totalMilestonesToCreate: number;
};

export type PlanningGroupStructureDiff = {
  groupId: string;
  groupName: string;
  diffs: StructureDiff[];
  grandTotal: number;
};

// ---------------------------------------------------------------------------
// Helper: load full structure of a planning (domains → lots → phases → milestones)
// ---------------------------------------------------------------------------

type LoadedPhase = {
  id: string; label: string | null; type: string; startDate: string; endDate: string;
  status: string | null; progress: number; color: string | null; note: string | null;
  sortOrder: number; syncGroupId: string | null; version: number; lotId: string;
};
type LoadedMilestone = {
  id: string; label: string; type: string; date: string; color: string | null;
  labelPos: string; note: string | null; syncGroupId: string | null; version: number; lotId: string;
};
type LoadedLot = {
  id: string; name: string; subtitle: string | null; icon: string | null; sortOrder: number;
  domainId: string; planningId: string; hidden: boolean; isPostponed: boolean;
  postponedNote: string | null; postponedLabelColor: string | null;
  postponedLabelFont: string | null; postponedLabelSize: number | null;
  phases: LoadedPhase[]; milestones: LoadedMilestone[];
};
type LoadedDomain = {
  id: string; name: string; code: string; planningId: string;
  bg: string; bgAlt: string; strong: string; phaseColor: string;
  sortOrder: number; collapsed: boolean;
  cadence: { livraison: number; pmep: number; cab: number; mep: number };
  lots: LoadedLot[];
};

async function loadFullPlanningStructure(planningId: string): Promise<LoadedDomain[]> {
  const planningDomains = await db
    .select()
    .from(domains)
    .where(eq(domains.planningId, planningId))
    .orderBy(asc(domains.sortOrder));

  if (!planningDomains.length) return [];

  const domainIds = planningDomains.map((d) => d.id);
  const planningLots = await db
    .select()
    .from(lots)
    .where(inArray(lots.domainId, domainIds))
    .orderBy(asc(lots.sortOrder));

  if (!planningLots.length) {
    return planningDomains.map((d) => ({ ...d, lots: [] }));
  }

  const lotIds = planningLots.map((l) => l.id);
  const [allPhases, allMilestones] = await Promise.all([
    db.select().from(phases).where(inArray(phases.lotId, lotIds)).orderBy(asc(phases.sortOrder)),
    db.select().from(milestones).where(inArray(milestones.lotId, lotIds)),
  ]);

  const phasesByLot = new Map<string, LoadedPhase[]>();
  for (const ph of allPhases) {
    const arr = phasesByLot.get(ph.lotId) ?? [];
    arr.push(ph as LoadedPhase);
    phasesByLot.set(ph.lotId, arr);
  }
  const milestonesByLot = new Map<string, LoadedMilestone[]>();
  for (const ms of allMilestones) {
    const arr = milestonesByLot.get(ms.lotId) ?? [];
    arr.push(ms as LoadedMilestone);
    milestonesByLot.set(ms.lotId, arr);
  }
  const lotsByDomain = new Map<string, typeof planningLots>();
  for (const lot of planningLots) {
    const arr = lotsByDomain.get(lot.domainId) ?? [];
    arr.push(lot);
    lotsByDomain.set(lot.domainId, arr);
  }

  return planningDomains.map((d) => ({
    ...d,
    lots: (lotsByDomain.get(d.id) ?? []).map((l) => ({
      ...l,
      phases: phasesByLot.get(l.id) ?? [],
      milestones: milestonesByLot.get(l.id) ?? [],
    })),
  }));
}

// ---------------------------------------------------------------------------
// diffPlanningGroupStructure — compute what each planning is missing (bidirectional)
// ---------------------------------------------------------------------------

const SyncStructureSchema = z.object({
  groupId: z.string().uuid(),
  planningId: z.string().uuid(),
});

export async function diffPlanningGroupStructure(
  input: z.infer<typeof SyncStructureSchema>,
): Promise<PlanningGroupStructureDiff> {
  const data = SyncStructureSchema.parse(input);
  await assertIsOwnerOrAdmin(data.planningId);

  const [groupRow] = await db
    .select({ id: planningGroups.id, name: planningGroups.name })
    .from(planningGroups)
    .where(eq(planningGroups.id, data.groupId))
    .limit(1);
  if (!groupRow) throw new Error("Groupe introuvable.");

  const members = await db
    .select({ planningId: planningGroupMembers.planningId })
    .from(planningGroupMembers)
    .where(eq(planningGroupMembers.groupId, data.groupId));

  const memberIds = members.map((m) => m.planningId);
  if (memberIds.length < 2) return { groupId: data.groupId, groupName: groupRow.name, diffs: [], grandTotal: 0 };

  const planningRows = await db
    .select({ id: plannings.id, name: plannings.name })
    .from(plannings)
    .where(inArray(plannings.id, memberIds));

  const planningNameMap = Object.fromEntries(planningRows.map((p) => [p.id, p.name]));

  // Load full structure for all plannings in parallel
  const structureMap = new Map<string, LoadedDomain[]>();
  await Promise.all(
    memberIds.map(async (pid) => {
      structureMap.set(pid, await loadFullPlanningStructure(pid));
    }),
  );

  const diffs: StructureDiff[] = [];

  for (const targetPlanningId of memberIds) {
    const targetStructure = structureMap.get(targetPlanningId)!;

    // Build lookup sets for what target already has
    const targetLotKeys = new Set<string>();
    const targetPhaseKeys = new Set<string>();
    const targetMsKeys = new Set<string>();

    for (const domain of targetStructure) {
      for (const lot of domain.lots) {
        const lotKey = `${domain.name}::${lot.name}`;
        targetLotKeys.add(lotKey);
        for (const ph of lot.phases) {
          targetPhaseKeys.add(`${lotKey}::${ph.label ?? ph.type}`);
        }
        for (const ms of lot.milestones) {
          targetMsKeys.add(`${lotKey}::${ms.label}`);
        }
      }
    }

    // Track what we've already counted (de-dup across multiple source plannings)
    const processedLotKeys = new Set<string>();
    const processedPhaseKeys = new Set<string>();
    const processedMsKeys = new Set<string>();

    // lotDiffs keyed by lotKey for merging missing phases from different sources
    const lotDiffMap = new Map<string, LotDiffEntry>();

    for (const sourcePlanningId of memberIds) {
      if (sourcePlanningId === targetPlanningId) continue;
      const sourceStructure = structureMap.get(sourcePlanningId)!;

      for (const sourceDomain of sourceStructure) {
        for (const sourceLot of sourceDomain.lots) {
          const lotKey = `${sourceDomain.name}::${sourceLot.name}`;

          if (!targetLotKeys.has(lotKey) && !processedLotKeys.has(lotKey)) {
            // Entire lot is missing
            processedLotKeys.add(lotKey);
            for (const ph of sourceLot.phases) processedPhaseKeys.add(`${lotKey}::${ph.label ?? ph.type}`);
            for (const ms of sourceLot.milestones) processedMsKeys.add(`${lotKey}::${ms.label}`);

            lotDiffMap.set(lotKey, {
              sourceLotId: sourceLot.id,
              lotName: sourceLot.name,
              domainName: sourceDomain.name,
              isNewLot: true,
              sourcePlanningId,
              sourcePlanningName: planningNameMap[sourcePlanningId] ?? "Inconnu",
              phases: sourceLot.phases.map((ph) => ({ sourcePhaseId: ph.id, label: ph.label, type: ph.type })),
              milestones: sourceLot.milestones.map((ms) => ({ sourceMilestoneId: ms.id, label: ms.label })),
            });
          } else if (targetLotKeys.has(lotKey)) {
            // Lot exists — check for missing phases/milestones
            const missingPhases: PhaseDiffItem[] = [];
            const missingMilestones: MilestoneDiffItem[] = [];

            for (const ph of sourceLot.phases) {
              const phKey = `${lotKey}::${ph.label ?? ph.type}`;
              if (!targetPhaseKeys.has(phKey) && !processedPhaseKeys.has(phKey)) {
                processedPhaseKeys.add(phKey);
                missingPhases.push({ sourcePhaseId: ph.id, label: ph.label, type: ph.type });
              }
            }
            for (const ms of sourceLot.milestones) {
              const msKey = `${lotKey}::${ms.label}`;
              if (!targetMsKeys.has(msKey) && !processedMsKeys.has(msKey)) {
                processedMsKeys.add(msKey);
                missingMilestones.push({ sourceMilestoneId: ms.id, label: ms.label });
              }
            }

            if (missingPhases.length > 0 || missingMilestones.length > 0) {
              const existing = lotDiffMap.get(lotKey);
              if (existing) {
                existing.phases.push(...missingPhases);
                existing.milestones.push(...missingMilestones);
              } else {
                lotDiffMap.set(lotKey, {
                  sourceLotId: sourceLot.id,
                  lotName: sourceLot.name,
                  domainName: sourceDomain.name,
                  isNewLot: false,
                  sourcePlanningId,
                  sourcePlanningName: planningNameMap[sourcePlanningId] ?? "Inconnu",
                  phases: missingPhases,
                  milestones: missingMilestones,
                });
              }
            }
          }
        }
      }
    }

    const lotDiffs = [...lotDiffMap.values()];
    const totalLotsToCreate = lotDiffs.filter((ld) => ld.isNewLot).length;
    const totalPhasesToCreate = lotDiffs.reduce((acc, ld) => acc + ld.phases.length, 0);
    const totalMilestonesToCreate = lotDiffs.reduce((acc, ld) => acc + ld.milestones.length, 0);

    if (lotDiffs.length > 0) {
      diffs.push({
        targetPlanningId,
        targetPlanningName: planningNameMap[targetPlanningId] ?? "Inconnu",
        lotDiffs,
        totalLotsToCreate,
        totalPhasesToCreate,
        totalMilestonesToCreate,
      });
    }
  }

  const grandTotal = diffs.reduce(
    (acc, d) => acc + d.totalLotsToCreate + d.totalPhasesToCreate + d.totalMilestonesToCreate,
    0,
  );

  return { groupId: data.groupId, groupName: groupRow.name, diffs, grandTotal };
}

// ---------------------------------------------------------------------------
// syncPlanningGroupStructure — create missing elements bidirectionally + link them
// ---------------------------------------------------------------------------

export async function syncPlanningGroupStructure(
  input: z.infer<typeof SyncStructureSchema>,
): Promise<{ totalCreated: number }> {
  const data = SyncStructureSchema.parse(input);
  await assertIsOwnerOrAdmin(data.planningId);

  const diff = await diffPlanningGroupStructure(input);
  if (diff.grandTotal === 0) return { totalCreated: 0 };

  let totalCreated = 0;

  for (const structDiff of diff.diffs) {
    const { targetPlanningId, lotDiffs } = structDiff;

    // Load target planning context
    const targetDomains = await db
      .select()
      .from(domains)
      .where(eq(domains.planningId, targetPlanningId));

    const targetDomainByName = new Map(targetDomains.map((d) => [d.name.toLowerCase(), d]));

    const targetMembers = await db
      .select({ id: planningMembers.id, userId: planningMembers.userId })
      .from(planningMembers)
      .where(eq(planningMembers.planningId, targetPlanningId));

    const targetMemberByUserId = new Map(targetMembers.map((m) => [m.userId, m.id]));

    const targetDomainIds = targetDomains.map((d) => d.id);
    const targetLots = targetDomainIds.length > 0
      ? await db.select().from(lots).where(inArray(lots.domainId, targetDomainIds))
      : [];

    const targetLotByKey = new Map<string, typeof targetLots[0]>();
    for (const tl of targetLots) {
      const dom = targetDomains.find((d) => d.id === tl.domainId);
      if (dom) targetLotByKey.set(`${dom.name}::${tl.name}`, tl);
    }

    for (const lotDiff of lotDiffs) {
      const { domainName, lotName, isNewLot, sourceLotId, sourcePlanningId } = lotDiff;

      // Ensure domain exists in target
      let targetDomain = targetDomainByName.get(domainName.toLowerCase());
      if (!targetDomain) {
        const [sourceDomainRow] = await db
          .select()
          .from(domains)
          .where(and(eq(domains.planningId, sourcePlanningId), eq(domains.name, domainName)))
          .limit(1);

        if (!sourceDomainRow) continue;

        const [newDomain] = await db
          .insert(domains)
          .values({
            planningId: targetPlanningId,
            code: sourceDomainRow.code,
            name: sourceDomainRow.name,
            bg: sourceDomainRow.bg,
            bgAlt: sourceDomainRow.bgAlt,
            strong: sourceDomainRow.strong,
            phaseColor: sourceDomainRow.phaseColor,
            sortOrder: targetDomains.length,
            collapsed: false,
            cadence: sourceDomainRow.cadence,
          })
          .returning();
        targetDomain = newDomain;
        targetDomainByName.set(domainName.toLowerCase(), newDomain);
        targetDomains.push(newDomain);
      }
      if (!targetDomain) continue;

      // Ensure lot exists in target
      const lotKey = `${domainName}::${lotName}`;
      let targetLot = isNewLot ? undefined : targetLotByKey.get(lotKey);

      if (!targetLot) {
        const [sourceLotRow] = await db
          .select()
          .from(lots)
          .where(eq(lots.id, sourceLotId))
          .limit(1);
        if (!sourceLotRow) continue;

        const [newLot] = await db
          .insert(lots)
          .values({
            planningId: targetPlanningId,
            domainId: targetDomain.id,
            name: sourceLotRow.name,
            subtitle: sourceLotRow.subtitle,
            icon: sourceLotRow.icon,
            sortOrder: targetLots.filter((l) => l.domainId === targetDomain!.id).length,
            hidden: false,
            isPostponed: false,
            postponedNote: null,
            postponedLabelColor: null,
            postponedLabelFont: null,
            postponedLabelSize: null,
          })
          .returning();
        targetLot = newLot;
        targetLotByKey.set(lotKey, newLot);
        totalCreated++;
      }
      if (!targetLot) continue;

      // Create missing phases
      for (const phDiff of lotDiff.phases) {
        const [sourcePhase] = await db
          .select()
          .from(phases)
          .where(eq(phases.id, phDiff.sourcePhaseId))
          .limit(1);
        if (!sourcePhase) continue;

        const [newPhase] = await db
          .insert(phases)
          .values({
            lotId: targetLot.id,
            type: sourcePhase.type,
            label: sourcePhase.label,
            startDate: sourcePhase.startDate,
            endDate: sourcePhase.endDate,
            status: sourcePhase.status,
            progress: sourcePhase.progress,
            color: sourcePhase.color,
            note: sourcePhase.note,
            sortOrder: sourcePhase.sortOrder,
            version: 0,
          })
          .returning({ id: phases.id });

        // Link via syncGroupId
        if (sourcePhase.syncGroupId) {
          await db.update(phases).set({ syncGroupId: sourcePhase.syncGroupId }).where(eq(phases.id, newPhase.id));
        } else {
          const [newSyncGroup] = await db
            .insert(phaseSyncGroups)
            .values({ planningGroupId: data.groupId })
            .returning({ id: phaseSyncGroups.id });
          await db.update(phases)
            .set({ syncGroupId: newSyncGroup.id, version: 0 })
            .where(inArray(phases.id, [sourcePhase.id, newPhase.id]));
        }

        // Copy assignees (only if user is member of target planning)
        const sourceAssignees = await db
          .select({ memberId: phaseAssignees.memberId })
          .from(phaseAssignees)
          .where(eq(phaseAssignees.phaseId, sourcePhase.id));

        if (sourceAssignees.length > 0) {
          const memberIds_local = sourceAssignees.map((a) => a.memberId);
          const sourceMemberRows = await db
            .select({ id: planningMembers.id, userId: planningMembers.userId })
            .from(planningMembers)
            .where(inArray(planningMembers.id, memberIds_local));

          const assigneeValues = sourceMemberRows
            .map((sm) => {
              const targetMemberId = targetMemberByUserId.get(sm.userId);
              return targetMemberId ? { phaseId: newPhase.id, memberId: targetMemberId } : null;
            })
            .filter((v): v is { phaseId: string; memberId: string } => v !== null);

          if (assigneeValues.length > 0) {
            await db.insert(phaseAssignees).values(assigneeValues).onConflictDoNothing();
          }
        }

        // Copy phaseItems
        const sourceItemRows = await db
          .select()
          .from(phaseItems)
          .where(eq(phaseItems.phaseId, sourcePhase.id))
          .orderBy(asc(phaseItems.sortOrder));

        if (sourceItemRows.length > 0) {
          await db.insert(phaseItems).values(
            sourceItemRows.map((item) => ({
              phaseId: newPhase.id,
              title: item.title,
              detail: item.detail,
              date: item.date,
              status: item.status,
              sortOrder: item.sortOrder,
            })),
          );
        }

        totalCreated++;
      }

      // Create missing milestones
      for (const msDiff of lotDiff.milestones) {
        const [sourceMs] = await db
          .select()
          .from(milestones)
          .where(eq(milestones.id, msDiff.sourceMilestoneId))
          .limit(1);
        if (!sourceMs) continue;

        const [newMs] = await db
          .insert(milestones)
          .values({
            lotId: targetLot.id,
            type: sourceMs.type,
            label: sourceMs.label,
            date: sourceMs.date,
            color: sourceMs.color,
            labelPos: sourceMs.labelPos,
            note: sourceMs.note,
            version: 0,
          })
          .returning({ id: milestones.id });

        if (sourceMs.syncGroupId) {
          await db.update(milestones).set({ syncGroupId: sourceMs.syncGroupId }).where(eq(milestones.id, newMs.id));
        } else {
          const [newSyncGroup] = await db
            .insert(milestoneSyncGroups)
            .values({ planningGroupId: data.groupId })
            .returning({ id: milestoneSyncGroups.id });
          await db.update(milestones)
            .set({ syncGroupId: newSyncGroup.id, version: 0 })
            .where(inArray(milestones.id, [sourceMs.id, newMs.id]));
        }

        totalCreated++;
      }
    }
  }

  // Revalidate all plannings in the group
  const allMembers = await db
    .select({ planningId: planningGroupMembers.planningId })
    .from(planningGroupMembers)
    .where(eq(planningGroupMembers.groupId, data.groupId));

  for (const { planningId } of allMembers) {
    revalidatePath(`/p/${planningId}`);
  }
  revalidatePath(`/parametres`);

  return { totalCreated };
}
