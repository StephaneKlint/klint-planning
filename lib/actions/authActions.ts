"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
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

  // Vérifier le mot de passe actuel
  if (user.passwordHash) {
    const valid = await bcrypt.compare(data.data.currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false, error: "Mot de passe actuel incorrect." };
    }
  }

  // Hacher et enregistrer le nouveau mot de passe
  const hash = await bcrypt.hash(data.data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: hash })
    .where(eq(users.id, session.user.id));

  return { success: true };
}
