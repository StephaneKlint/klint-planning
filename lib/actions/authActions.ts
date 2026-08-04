"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, platformEvents } from "@/lib/db/schema";
import { auth } from "@/auth";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Non authentifié." };
  }

  const data = ChangePasswordSchema.safeParse(input);
  if (!data.success) {
    return { success: false, error: data.error.errors[0]?.message ?? "Données invalides." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return { success: false, error: "Utilisateur introuvable." };
  }

  if (user.passwordHash) {
    const valid = await bcrypt.compare(data.data.currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false, error: "Mot de passe actuel incorrect." };
    }
  }

  const hash = await bcrypt.hash(data.data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: hash })
    .where(eq(users.id, session.user.id));

  return { success: true };
}

export async function adminResetPassword(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return { success: false, error: "Réservé aux administrateurs." };
  }

  const [target] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) {
    return { success: false, error: "Utilisateur introuvable." };
  }

  const hash = await bcrypt.hash("Klint2026!", 12);
  await db
    .update(users)
    .set({ passwordHash: hash })
    .where(eq(users.id, targetUserId));

  await db.insert(platformEvents).values({
    actorId:     session.user.id,
    actorEmail:  session.user.email ?? null,
    targetId:    target.id,
    targetEmail: target.email,
    eventType:   "password_reset",
    summary:     `MDP réinitialisé pour ${target.name || target.email} → Klint2026!`,
  });

  return { success: true };
}
