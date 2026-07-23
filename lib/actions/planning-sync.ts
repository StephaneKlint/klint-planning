/**
 * planning-sync.ts
 * Propagation functions for linked-planning sync groups.
 * Called from within server actions in planning.ts — never exported as server actions themselves.
 * No "use server" directive: these are plain async DB helpers.
 */
import { db } from "@/lib/db";
import {
  phases, milestones, lots,
  phaseSyncGroups, milestoneSyncGroups, activityLog,
} from "@/lib/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PhaseUpdates = Partial<Pick<
  typeof phases.$inferInsert,
  "startDate" | "endDate" | "progress" | "color" | "note" | "label" | "status"
>>;

type MilestoneUpdates = Partial<Pick<
  typeof milestones.$inferInsert,
  "date" | "color" | "note" | "label"
>>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function logSyncActivity(
  planningId: string,
  targetType: "phase" | "milestone",
  targetId: string,
  summary: string,
) {
  await db.insert(activityLog).values({
    planningId,
    verb: "sync_propagated",
    targetType,
    targetId,
    summary,
    meta: null,
  });
}

// ---------------------------------------------------------------------------
// Phase propagation
// ---------------------------------------------------------------------------

/**
 * Propagates a phase update to all sister phases sharing the same sync_group_id.
 * Only fields listed in the group's sync_fields are propagated.
 * Returns the list of planning IDs that were affected (for revalidatePath).
 */
export async function propagatePhaseSyncGroup(
  sourcePhaseId: string,
  updates: PhaseUpdates,
): Promise<string[]> {
  // 1. Fetch source phase's sync_group_id
  const [sourcePhase] = await db
    .select({ syncGroupId: phases.syncGroupId, version: phases.version })
    .from(phases)
    .where(eq(phases.id, sourcePhaseId));

  if (!sourcePhase?.syncGroupId) return [];

  // 2. Fetch sync_fields config for this group
  const [syncGroup] = await db
    .select({ syncFields: phaseSyncGroups.syncFields })
    .from(phaseSyncGroups)
    .where(eq(phaseSyncGroups.id, sourcePhase.syncGroupId));

  if (!syncGroup) return [];

  const allowed = new Set(syncGroup.syncFields as string[]);

  // 3. Filter updates to only the allowed fields
  const filtered: PhaseUpdates = {};
  for (const [field, value] of Object.entries(updates)) {
    if (allowed.has(field)) {
      (filtered as Record<string, unknown>)[field] = value;
    }
  }
  if (Object.keys(filtered).length === 0) return [];

  // 4. Find sister phases (same sync group, excluding source)
  const sisters = await db
    .select({ id: phases.id, lotId: phases.lotId, version: phases.version })
    .from(phases)
    .where(and(
      eq(phases.syncGroupId, sourcePhase.syncGroupId),
      ne(phases.id, sourcePhaseId),
    ));

  if (sisters.length === 0) return [];

  // 5. Resolve planning IDs for sister phases
  const lotIds = [...new Set(sisters.map((s) => s.lotId))];
  const lotRows = await db
    .select({ id: lots.id, planningId: lots.planningId })
    .from(lots)
    .where(inArray(lots.id, lotIds));
  const planningByLotId = Object.fromEntries(lotRows.map((l) => [l.id, l.planningId]));

  // 6. Update each sister phase and log in the affected planning
  const affectedPlanningIds = new Set<string>();
  for (const sister of sisters) {
    // Optimistic lock: skip if version mismatch (another writer won)
    const result = await db
      .update(phases)
      .set({ ...filtered, version: sister.version + 1 })
      .where(and(eq(phases.id, sister.id), eq(phases.version, sister.version)))
      .returning({ id: phases.id });

    if (result.length === 0) continue; // Conflict — skip silently for now

    const planningId = planningByLotId[sister.lotId];
    if (planningId) {
      affectedPlanningIds.add(planningId);
      await logSyncActivity(planningId, "phase", sister.id,
        `Phase mise à jour par synchronisation inter-planning`);
    }
  }

  return [...affectedPlanningIds];
}

// ---------------------------------------------------------------------------
// Milestone propagation
// ---------------------------------------------------------------------------

/**
 * Propagates a milestone update to all sister milestones sharing the same sync_group_id.
 * Returns the list of planning IDs that were affected (for revalidatePath).
 */
export async function propagateMilestoneSyncGroup(
  sourceMilestoneId: string,
  updates: MilestoneUpdates,
): Promise<string[]> {
  // 1. Fetch source milestone's sync_group_id
  const [sourceMilestone] = await db
    .select({ syncGroupId: milestones.syncGroupId, version: milestones.version })
    .from(milestones)
    .where(eq(milestones.id, sourceMilestoneId));

  if (!sourceMilestone?.syncGroupId) return [];

  // 2. Fetch sync_fields config
  const [syncGroup] = await db
    .select({ syncFields: milestoneSyncGroups.syncFields })
    .from(milestoneSyncGroups)
    .where(eq(milestoneSyncGroups.id, sourceMilestone.syncGroupId));

  if (!syncGroup) return [];

  const allowed = new Set(syncGroup.syncFields as string[]);

  // 3. Filter updates to allowed fields
  const filtered: MilestoneUpdates = {};
  for (const [field, value] of Object.entries(updates)) {
    if (allowed.has(field)) {
      (filtered as Record<string, unknown>)[field] = value;
    }
  }
  if (Object.keys(filtered).length === 0) return [];

  // 4. Find sister milestones
  const sisters = await db
    .select({ id: milestones.id, lotId: milestones.lotId, version: milestones.version })
    .from(milestones)
    .where(and(
      eq(milestones.syncGroupId, sourceMilestone.syncGroupId),
      ne(milestones.id, sourceMilestoneId),
    ));

  if (sisters.length === 0) return [];

  // 5. Resolve planning IDs
  const lotIds = [...new Set(sisters.map((s) => s.lotId))];
  const lotRows = await db
    .select({ id: lots.id, planningId: lots.planningId })
    .from(lots)
    .where(inArray(lots.id, lotIds));
  const planningByLotId = Object.fromEntries(lotRows.map((l) => [l.id, l.planningId]));

  // 6. Update each sister milestone
  const affectedPlanningIds = new Set<string>();
  for (const sister of sisters) {
    const result = await db
      .update(milestones)
      .set({ ...filtered, version: sister.version + 1 })
      .where(and(eq(milestones.id, sister.id), eq(milestones.version, sister.version)))
      .returning({ id: milestones.id });

    if (result.length === 0) continue;

    const planningId = planningByLotId[sister.lotId];
    if (planningId) {
      affectedPlanningIds.add(planningId);
      await logSyncActivity(planningId, "milestone", sister.id,
        `Jalon mis à jour par synchronisation inter-planning`);
    }
  }

  return [...affectedPlanningIds];
}

