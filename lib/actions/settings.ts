"use server";
/**
 * lib/actions/settings.ts
 * Server actions for planning settings: phase types, milestone types, statuses, cadence.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  phaseTypes, milestoneTypes, domains, planningSettings, planningMembers,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Phase types ──────────────────────────────────────────────────────────────

const PhaseTypeSchema = z.object({
  planningId: z.string().uuid(),
  code:       z.string().min(1).max(40),
  label:      z.string().min(1).max(80),
});

export async function addPhaseType(input: z.infer<typeof PhaseTypeSchema>) {
  const data = PhaseTypeSchema.parse(input);
  await db.insert(phaseTypes).values({
    planningId: data.planningId,
    code:       data.code,
    label:      data.label,
    sortOrder:  999,
  });
  revalidatePath(`/parametres`);
}

export async function deletePhaseType(id: string, planningId: string) {
  await db.delete(phaseTypes).where(and(eq(phaseTypes.id, id), eq(phaseTypes.planningId, planningId)));
  revalidatePath(`/parametres`);
}

const UpdatePhaseTypeSchema = z.object({
  id:         z.string().uuid(),
  planningId: z.string().uuid(),
  label:      z.string().min(1).max(80),
});

export async function updatePhaseType(input: z.infer<typeof UpdatePhaseTypeSchema>) {
  const data = UpdatePhaseTypeSchema.parse(input);
  await db.update(phaseTypes)
    .set({ label: data.label })
    .where(and(eq(phaseTypes.id, data.id), eq(phaseTypes.planningId, data.planningId)));
  revalidatePath(`/parametres`);
}

// ── Milestone types ───────────────────────────────────────────────────────────

const MilestoneTypeSchema = z.object({
  planningId: z.string().uuid(),
  code:       z.string().min(1).max(40),
  label:      z.string().min(1).max(80),
  color:      z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function addMilestoneType(input: z.infer<typeof MilestoneTypeSchema>) {
  const data = MilestoneTypeSchema.parse(input);
  await db.insert(milestoneTypes).values({
    planningId: data.planningId,
    code:       data.code,
    label:      data.label,
    color:      data.color,
    sortOrder:  999,
  });
  revalidatePath(`/parametres`);
}

export async function deleteMilestoneType(id: string, planningId: string) {
  await db.delete(milestoneTypes).where(and(eq(milestoneTypes.id, id), eq(milestoneTypes.planningId, planningId)));
  revalidatePath(`/parametres`);
}

const UpdateMilestoneTypeSchema = z.object({
  id:         z.string().uuid(),
  planningId: z.string().uuid(),
  label:      z.string().min(1).max(80),
  color:      z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function updateMilestoneType(input: z.infer<typeof UpdateMilestoneTypeSchema>) {
  const data = UpdateMilestoneTypeSchema.parse(input);
  await db.update(milestoneTypes)
    .set({ label: data.label, color: data.color })
    .where(and(eq(milestoneTypes.id, data.id), eq(milestoneTypes.planningId, data.planningId)));
  revalidatePath(`/parametres`);
}

// ── Domain cadence ─────────────────────────────────────────────────────────────

const CadenceSchema = z.object({
  domainId:   z.string().uuid(),
  planningId: z.string().uuid(),
  livraison:  z.coerce.number().int().min(0).max(60),
  pmep:       z.coerce.number().int().min(0).max(60),
  cab:        z.coerce.number().int().min(0).max(60),
  mep:        z.coerce.number().int().min(0).max(60),
});

export async function updateDomainCadence(input: z.infer<typeof CadenceSchema>) {
  const data = CadenceSchema.parse(input);
  await db.update(domains)
    .set({ cadence: { livraison: data.livraison, pmep: data.pmep, cab: data.cab, mep: data.mep } })
    .where(and(eq(domains.id, data.domainId), eq(domains.planningId, data.planningId)));
  revalidatePath(`/parametres`);
}

// ── Planning general settings ──────────────────────────────────────────────────

const PlanningSettingsSchema = z.object({
  planningId:              z.string().uuid(),
  autoLate:                z.boolean(),
  autoCloseAfterMepDays:   z.coerce.number().int().min(0).max(365),
  notifyOnLate:            z.boolean(),
});

export async function updatePlanningSettings(input: z.infer<typeof PlanningSettingsSchema>) {
  const data = PlanningSettingsSchema.parse(input);
  await db.update(planningSettings)
    .set({
      autoLate:              data.autoLate,
      autoCloseAfterMepDays: data.autoCloseAfterMepDays,
      notifyOnLate:          data.notifyOnLate,
    })
    .where(eq(planningSettings.planningId, data.planningId));
  revalidatePath(`/parametres`);
}

// ── Gestion des rôles (RBAC) ─────────────────────────────────────────────────

const UpdateMemberPermissionSchema = z.object({
  memberId:   z.string().uuid(),
  planningId: z.string().uuid(),
  permission: z.enum(["owner", "editor", "viewer"]),
});

export async function updateMemberPermission(
  input: z.infer<typeof UpdateMemberPermissionSchema>
) {
  const data = UpdateMemberPermissionSchema.parse(input);
  await db.update(planningMembers)
    .set({ permission: data.permission })
    .where(
      and(
        eq(planningMembers.id, data.memberId),
        eq(planningMembers.planningId, data.planningId)
      )
    );
  revalidatePath(`/parametres`);
  revalidatePath(`/ressources`);
}
