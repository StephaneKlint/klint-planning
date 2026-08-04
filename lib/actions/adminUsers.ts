"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, platformEvents } from "@/lib/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("Réservé aux administrateurs.");
  }
  return session.user;
}

async function logEvent(params: {
  actorId: string;
  actorEmail: string | null | undefined;
  targetId?: string | null;
  targetEmail?: string | null;
  eventType: string;
  summary: string;
}) {
  await db.insert(platformEvents).values({
    actorId:     params.actorId,
    actorEmail:  params.actorEmail ?? null,
    targetId:    params.targetId ?? null,
    targetEmail: params.targetEmail ?? null,
    eventType:   params.eventType,
    summary:     params.summary,
  });
}

// ── Créer un utilisateur plateforme ───────────────────────────────────────────

const CreateUserSchema = z.object({
  name:  z.string().min(1).max(160),
  email: z.string().email().max(255),
  role:  z.enum(["admin", "user", "contact"]).default("user"),
});

export async function adminCreateUser(
  input: z.input<typeof CreateUserSchema>
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const actor = await requireAdmin().catch(e => { throw e; });
  const data = CreateUserSchema.parse(input);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "Un utilisateur avec cet email existe déjà." };
  }

  const initialHash = await bcrypt.hash("Klint2026!", 12);
  const [newUser] = await db
    .insert(users)
    .values({ name: data.name, email: data.email, role: data.role, passwordHash: initialHash })
    .returning({ id: users.id });

  await logEvent({
    actorId:     actor.id,
    actorEmail:  actor.email,
    targetId:    newUser.id,
    targetEmail: data.email,
    eventType:   "user_created",
    summary:     `Utilisateur créé : ${data.name} (${data.email}) — rôle ${data.role}`,
  });

  revalidatePath("/administration");
  return { success: true, userId: newUser.id };
}

// ── Modifier un utilisateur plateforme ────────────────────────────────────────

const UpdateUserSchema = z.object({
  userId: z.string().uuid(),
  name:   z.string().min(1).max(160),
  email:  z.string().email().max(255),
  role:   z.enum(["admin", "user", "contact"]),
});

export async function adminUpdateUser(
  input: z.input<typeof UpdateUserSchema>
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAdmin().catch(e => { throw e; });
  const data = UpdateUserSchema.parse(input);

  const [target] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, data.userId))
    .limit(1);

  if (!target) return { success: false, error: "Utilisateur introuvable." };

  await db
    .update(users)
    .set({ name: data.name, email: data.email, role: data.role })
    .where(eq(users.id, data.userId));

  await logEvent({
    actorId:     actor.id,
    actorEmail:  actor.email,
    targetId:    target.id,
    targetEmail: data.email,
    eventType:   "user_updated",
    summary:     `Utilisateur modifié : ${data.name} (${data.email}) — rôle ${data.role}`,
  });

  revalidatePath("/administration");
  revalidatePath("/parametres");
  return { success: true };
}

// ── Désactiver un utilisateur plateforme ──────────────────────────────────────

export async function adminDisableUser(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAdmin().catch(e => { throw e; });

  const [target] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) return { success: false, error: "Utilisateur introuvable." };

  await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, targetUserId));

  await logEvent({
    actorId:     actor.id,
    actorEmail:  actor.email,
    targetId:    target.id,
    targetEmail: target.email,
    eventType:   "user_disabled",
    summary:     `Utilisateur désactivé : ${target.name || target.email}`,
  });

  revalidatePath("/administration");
  revalidatePath("/parametres");
  return { success: true };
}

// ── Réactiver un utilisateur plateforme ───────────────────────────────────────

export async function adminEnableUser(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAdmin().catch(e => { throw e; });

  const [target] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) return { success: false, error: "Utilisateur introuvable." };

  await db.update(users).set({ disabledAt: null }).where(eq(users.id, targetUserId));

  await logEvent({
    actorId:     actor.id,
    actorEmail:  actor.email,
    targetId:    target.id,
    targetEmail: target.email,
    eventType:   "user_enabled",
    summary:     `Utilisateur réactivé : ${target.name || target.email}`,
  });

  revalidatePath("/administration");
  revalidatePath("/parametres");
  return { success: true };
}

// ── Supprimer définitivement un utilisateur plateforme ────────────────────────

export async function adminDeleteUser(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAdmin().catch(e => { throw e; });

  if (targetUserId === actor.id) {
    return { success: false, error: "Impossible de supprimer votre propre compte." };
  }

  const [target] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) return { success: false, error: "Utilisateur introuvable." };

  await logEvent({
    actorId:     actor.id,
    actorEmail:  actor.email,
    targetId:    null,
    targetEmail: target.email,
    eventType:   "user_deleted",
    summary:     `Utilisateur supprimé : ${target.name || target.email} (${target.email})`,
  });

  await db.delete(users).where(eq(users.id, targetUserId));

  revalidatePath("/administration");
  revalidatePath("/parametres");
  revalidatePath("/ressources");
  return { success: true };
}
