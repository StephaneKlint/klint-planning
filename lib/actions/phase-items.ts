"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { phases, lots, phaseItems, phaseItemImports } from "@/lib/db/schema";
import { eq, inArray, and, count, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { planningMembers } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Permission guard
// ---------------------------------------------------------------------------
async function assertCanEdit(planningId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Non authentifié.");
  if (session.user.role === "admin") return;

  const [member] = await db
    .select({ permission: planningMembers.permission })
    .from(planningMembers)
    .where(and(
      eq(planningMembers.planningId, planningId),
      eq(planningMembers.userId, session.user.id),
    ))
    .limit(1);

  if (!member) throw new Error("Accès non autorisé à ce planning.");
  if (member.permission === "viewer") throw new Error("Accès en lecture seule.");
}

// ---------------------------------------------------------------------------
// Helper: résoudre planningId depuis phaseId
// ---------------------------------------------------------------------------
async function getPlanningIdFromPhase(phaseId: string): Promise<string> {
  const [row] = await db
    .select({ planningId: lots.planningId })
    .from(phases)
    .innerJoin(lots, eq(phases.lotId, lots.id))
    .where(eq(phases.id, phaseId))
    .limit(1);
  if (!row) throw new Error("Phase introuvable.");
  return row.planningId;
}

// ---------------------------------------------------------------------------
// Helper: recalcule et met à jour phases.progress depuis les items
// Fait / (total - Annulés) × 100, arrondi à l'entier
// Si aucun item actif → ne touche pas le progress (géré manuellement)
// ---------------------------------------------------------------------------
async function syncPhaseProgress(phaseId: string): Promise<void> {
  const items = await db
    .select({ status: phaseItems.status })
    .from(phaseItems)
    .where(eq(phaseItems.phaseId, phaseId));

  if (items.length === 0) return;

  const done      = items.filter((i) => i.status === "done").length;
  const active    = items.filter((i) => i.status !== "cancelled").length;
  const progress  = active > 0 ? Math.round((done / active) * 100) : 0;

  await db.update(phases).set({ progress }).where(eq(phases.id, phaseId));
}

// ---------------------------------------------------------------------------
// CRUD — Phase items
// ---------------------------------------------------------------------------

const PhaseItemInput = z.object({
  phaseId:   z.string().uuid(),
  title:     z.string().min(1).max(300),
  detail:    z.string().max(5000).optional().nullable(),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status:    z.enum(["todo", "doing", "done", "cancelled"]).default("todo"),
});

export async function createPhaseItem(input: z.infer<typeof PhaseItemInput>) {
  const data = PhaseItemInput.parse(input);
  const planningId = await getPlanningIdFromPhase(data.phaseId);
  await assertCanEdit(planningId);

  const existing = await db
    .select({ sortOrder: phaseItems.sortOrder })
    .from(phaseItems)
    .where(eq(phaseItems.phaseId, data.phaseId))
    .orderBy(sql`sort_order DESC`)
    .limit(1);

  const nextOrder = existing.length > 0 ? existing[0].sortOrder + 1 : 0;

  const [item] = await db.insert(phaseItems).values({
    phaseId:   data.phaseId,
    title:     data.title,
    detail:    data.detail ?? null,
    date:      data.date ?? null,
    status:    data.status,
    sortOrder: nextOrder,
  }).returning();

  await syncPhaseProgress(data.phaseId);
  revalidatePath(`/p/${planningId}`);
  return item;
}

const UpdatePhaseItemInput = z.object({
  id:      z.string().uuid(),
  phaseId: z.string().uuid(),
  title:   z.string().min(1).max(300).optional(),
  detail:  z.string().max(5000).optional().nullable(),
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status:  z.enum(["todo", "doing", "done", "cancelled"]).optional(),
});

export async function updatePhaseItem(input: z.infer<typeof UpdatePhaseItemInput>) {
  const data = UpdatePhaseItemInput.parse(input);
  const planningId = await getPlanningIdFromPhase(data.phaseId);
  await assertCanEdit(planningId);

  const updates: Record<string, unknown> = {};
  if (data.title  !== undefined) updates.title  = data.title;
  if (data.detail !== undefined) updates.detail = data.detail ?? null;
  if (data.date   !== undefined) updates.date   = data.date ?? null;
  if (data.status !== undefined) updates.status = data.status;

  const [item] = await db
    .update(phaseItems)
    .set(updates)
    .where(and(eq(phaseItems.id, data.id), eq(phaseItems.phaseId, data.phaseId)))
    .returning();

  await syncPhaseProgress(data.phaseId);
  revalidatePath(`/p/${planningId}`);
  return item;
}

export async function deletePhaseItem(id: string, phaseId: string) {
  const planningId = await getPlanningIdFromPhase(phaseId);
  await assertCanEdit(planningId);

  await db.delete(phaseItems).where(and(eq(phaseItems.id, id), eq(phaseItems.phaseId, phaseId)));

  await syncPhaseProgress(phaseId);
  revalidatePath(`/p/${planningId}`);
}

export async function listPhaseItems(phaseId: string) {
  return db
    .select()
    .from(phaseItems)
    .where(eq(phaseItems.phaseId, phaseId))
    .orderBy(phaseItems.sortOrder, phaseItems.createdAt);
}

// ---------------------------------------------------------------------------
// Import via bridge (texte libre → Claude CLI)
// ---------------------------------------------------------------------------

export async function submitPhaseItemImport(phaseId: string, rawText: string) {
  const planningId = await getPlanningIdFromPhase(phaseId);
  await assertCanEdit(planningId);

  const [job] = await db.insert(phaseItemImports).values({
    phaseId,
    rawText: rawText.trim(),
    status:  "pending",
  }).returning({ id: phaseItemImports.id });

  return { jobId: job.id };
}

export async function getPhaseItemImport(jobId: string) {
  const [job] = await db
    .select()
    .from(phaseItemImports)
    .where(eq(phaseItemImports.id, jobId))
    .limit(1);
  return job ?? null;
}

// ---------------------------------------------------------------------------
// Appelé par le bridge pour insérer les items importés
// ---------------------------------------------------------------------------

export type ImportedItem = {
  title:  string;
  detail?: string | null;
  date?:  string | null;
  status?: "todo" | "doing" | "done" | "cancelled";
};

export async function confirmPhaseItemImport(jobId: string, items: ImportedItem[]) {
  const [job] = await db
    .select()
    .from(phaseItemImports)
    .where(eq(phaseItemImports.id, jobId))
    .limit(1);

  if (!job) throw new Error("Job introuvable.");

  const existing = await db
    .select({ sortOrder: phaseItems.sortOrder })
    .from(phaseItems)
    .where(eq(phaseItems.phaseId, job.phaseId))
    .orderBy(sql`sort_order DESC`)
    .limit(1);

  let nextOrder = existing.length > 0 ? existing[0].sortOrder + 1 : 0;

  for (const it of items) {
    await db.insert(phaseItems).values({
      phaseId:   job.phaseId,
      title:     it.title.slice(0, 300),
      detail:    it.detail ?? null,
      date:      it.date ?? null,
      status:    it.status ?? "todo",
      sortOrder: nextOrder++,
    });
  }

  await db.update(phaseItemImports)
    .set({ status: "done", resultJson: items, processedAt: new Date() })
    .where(eq(phaseItemImports.id, jobId));

  await syncPhaseProgress(job.phaseId);

  const planningId = await getPlanningIdFromPhase(job.phaseId);
  revalidatePath(`/p/${planningId}`);
}
