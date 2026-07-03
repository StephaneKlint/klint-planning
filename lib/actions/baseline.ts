"use server";

import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { baselines, lots, phases, milestones } from "@/lib/db/schema";
import { auth } from "@/auth";
import { inArray } from "drizzle-orm";

export type BaselineSnapshot = {
  id: string;
  name: string;
  createdAt: Date;
  phases: Record<string, { startDate: string; endDate: string }>;
  milestones: Record<string, { date: string }>;
};

export type BaselineMeta = {
  id: string;
  name: string;
  createdAt: Date;
};

async function buildSnapshot(planningId: string) {
  const planningLots = await db.select({ id: lots.id }).from(lots).where(eq(lots.planningId, planningId));
  const lotIds = planningLots.map((l) => l.id);

  const [planningPhases, planningMilestones] = await (lotIds.length > 0
    ? Promise.all([
        db.select({ id: phases.id, startDate: phases.startDate, endDate: phases.endDate })
          .from(phases).where(inArray(phases.lotId, lotIds)),
        db.select({ id: milestones.id, date: milestones.date })
          .from(milestones).where(inArray(milestones.lotId, lotIds)),
      ])
    : Promise.resolve([[], []] as [{ id: string; startDate: string; endDate: string }[], { id: string; date: string }[]]));

  return {
    phases: Object.fromEntries(planningPhases.map((p) => [p.id, { startDate: p.startDate, endDate: p.endDate }])),
    milestones: Object.fromEntries(planningMilestones.map((m) => [m.id, { date: m.date }])),
  };
}

export async function createBaseline(planningId: string, name: string): Promise<BaselineSnapshot> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié.");

  const snapshot = await buildSnapshot(planningId);

  const [row] = await db.insert(baselines).values({ planningId, name, snapshot }).returning();
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    phases: snapshot.phases,
    milestones: snapshot.milestones,
  };
}

export async function listBaselines(planningId: string): Promise<BaselineMeta[]> {
  const rows = await db
    .select({ id: baselines.id, name: baselines.name, createdAt: baselines.createdAt })
    .from(baselines)
    .where(eq(baselines.planningId, planningId))
    .orderBy(desc(baselines.createdAt));
  return rows;
}

export async function getBaselineById(id: string): Promise<BaselineSnapshot | null> {
  const [row] = await db.select().from(baselines).where(eq(baselines.id, id)).limit(1);
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

export async function deleteBaselineById(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié.");
  await db.delete(baselines).where(eq(baselines.id, id));
}

/** @deprecated — conservé pour compatibilité, supprime toutes les baselines */
export async function deleteBaseline(planningId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié.");
  await db.delete(baselines).where(eq(baselines.planningId, planningId));
}

export async function getLatestBaseline(planningId: string): Promise<BaselineSnapshot | null> {
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
