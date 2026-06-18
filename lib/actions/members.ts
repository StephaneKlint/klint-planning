"use server";
/**
 * lib/actions/members.ts
 * Gestion des responsables d'un planning (add, update, remove, restore).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, planningMembers, phaseAssignees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Ajouter un responsable ────────────────────────────────────────────────────

const AddMemberSchema = z.object({
  planningId: z.string().uuid(),
  name:       z.string().min(1).max(160),
  email:      z.string().email().max(255),
  initials:   z.string().min(1).max(3),
  color:      z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function addMember(input: z.infer<typeof AddMemberSchema>) {
  const data = AddMemberSchema.parse(input);

  // Upsert user by email
  const existingUsers = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  let userId: string;
  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
  } else {
    const [newUser] = await db.insert(users).values({
      name:  data.name,
      email: data.email,
    }).returning({ id: users.id });
    userId = newUser.id;
  }

  // Check if already a member
  const existing = await db.select({ id: planningMembers.id })
    .from(planningMembers)
    .where(and(eq(planningMembers.planningId, data.planningId), eq(planningMembers.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Ce membre appartient déjà à ce planning.");
  }

  const [member] = await db.insert(planningMembers).values({
    planningId: data.planningId,
    userId,
    initials:   data.initials.slice(0, 3).toUpperCase(),
    color:      data.color,
    permission: "editor",
  }).returning({ id: planningMembers.id });

  revalidatePath("/ressources");
  return member;
}

// ── Modifier un responsable ───────────────────────────────────────────────────

const UpdateMemberSchema = z.object({
  memberId:   z.string().uuid(),
  planningId: z.string().uuid(),
  name:       z.string().min(1).max(160),
  initials:   z.string().min(1).max(3),
  color:      z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function updateMember(input: z.infer<typeof UpdateMemberSchema>) {
  const data = UpdateMemberSchema.parse(input);

  // Update member display data
  await db.update(planningMembers)
    .set({ initials: data.initials.slice(0, 3).toUpperCase(), color: data.color })
    .where(and(eq(planningMembers.id, data.memberId), eq(planningMembers.planningId, data.planningId)));

  // Update user display name
  const [member] = await db.select({ userId: planningMembers.userId })
    .from(planningMembers)
    .where(eq(planningMembers.id, data.memberId));

  if (member) {
    await db.update(users)
      .set({ name: data.name })
      .where(eq(users.id, member.userId));
  }

  revalidatePath("/ressources");
}

// ── Supprimer un responsable ──────────────────────────────────────────────────

export async function removeMember(memberId: string, planningId: string) {
  await db.delete(planningMembers)
    .where(and(eq(planningMembers.id, memberId), eq(planningMembers.planningId, planningId)));

  revalidatePath("/ressources");
}

// ── Restaurer un responsable supprimé (undo) ─────────────────────────────────

const RestoreMemberSchema = z.object({
  userId:     z.string().uuid(),
  planningId: z.string().uuid(),
  initials:   z.string().max(3).nullable(),
  color:      z.string().nullable(),
  permission: z.string(),
  phaseIds:   z.array(z.string().uuid()),
});

export async function restoreMember(input: z.infer<typeof RestoreMemberSchema>) {
  const data = RestoreMemberSchema.parse(input);

  // Vérifier si le membre existe déjà (double undo protection)
  const existing = await db.select({ id: planningMembers.id })
    .from(planningMembers)
    .where(and(
      eq(planningMembers.planningId, data.planningId),
      eq(planningMembers.userId, data.userId)
    ))
    .limit(1);

  if (existing.length > 0) return; // déjà restauré

  const [member] = await db.insert(planningMembers).values({
    planningId: data.planningId,
    userId:     data.userId,
    initials:   data.initials?.toUpperCase().slice(0, 3) ?? undefined,
    color:      data.color ?? undefined,
    permission: (data.permission as "owner" | "editor" | "viewer") ?? "editor",
  }).returning({ id: planningMembers.id });

  if (data.phaseIds.length > 0) {
    await db.insert(phaseAssignees).values(
      data.phaseIds.map((phaseId) => ({ phaseId, memberId: member.id }))
    );
  }

  revalidatePath("/ressources");
  revalidatePath(`/p`);
}

// ── Désactiver un contact (répertoire) ────────────────────────────────────────

export async function disableContact(userId: string) {
  await db.update(users)
    .set({ disabledAt: new Date() })
    .where(eq(users.id, userId));
  revalidatePath("/parametres");
}

// ── Réactiver un contact désactivé ────────────────────────────────────────────

export async function enableContact(userId: string) {
  await db.update(users)
    .set({ disabledAt: null })
    .where(eq(users.id, userId));
  revalidatePath("/parametres");
}

// ── Assigner un contact existant à un planning ────────────────────────────────

export async function assignExistingContactToPlanning(userId: string, planningId: string) {
  const existing = await db.select({ id: planningMembers.id })
    .from(planningMembers)
    .where(and(eq(planningMembers.planningId, planningId), eq(planningMembers.userId, userId)))
    .limit(1);

  if (existing.length > 0) return;

  const otherMember = await db.select({ initials: planningMembers.initials, color: planningMembers.color })
    .from(planningMembers)
    .where(eq(planningMembers.userId, userId))
    .limit(1);

  await db.insert(planningMembers).values({
    planningId,
    userId,
    initials: otherMember[0]?.initials ?? undefined,
    color:    otherMember[0]?.color ?? "#001D63",
    permission: "editor",
  });

  revalidatePath("/parametres");
  revalidatePath("/ressources");
}

// ── Mettre à jour un contact (répertoire global) ──────────────────────────────

const UpdateContactSchema = z.object({
  userId:   z.string().uuid(),
  name:     z.string().min(1).max(160),
  initials: z.string().min(1).max(3),
  color:    z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export async function updateContact(input: z.infer<typeof UpdateContactSchema>) {
  const data = UpdateContactSchema.parse(input);

  await db.update(users)
    .set({ name: data.name })
    .where(eq(users.id, data.userId));

  await db.update(planningMembers)
    .set({ initials: data.initials.slice(0, 3).toUpperCase(), color: data.color })
    .where(eq(planningMembers.userId, data.userId));

  revalidatePath("/parametres");
  revalidatePath("/ressources");
}

// ── Supprimer définitivement un contact ───────────────────────────────────────

export async function deleteContact(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/parametres");
  revalidatePath("/ressources");
}
