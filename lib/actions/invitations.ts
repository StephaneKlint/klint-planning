"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users, invitationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

// ── Générer un lien d'invitation (valable 7 jours) ───────────────────────────

export async function generateInvitationLink(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Invalider les anciens tokens non utilisés pour cet utilisateur
  await db.delete(invitationTokens).where(eq(invitationTokens.userId, userId));

  await db.insert(invitationTokens).values({ userId, token, expiresAt });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cci-planning-claude-design.vercel.app";
  return `${baseUrl}/invite/${token}`;
}

// ── Vérifier un token d'invitation ───────────────────────────────────────────

export async function getInvitationByToken(token: string) {
  const rows = await db
    .select({
      inviteId:  invitationTokens.id,
      userId:    invitationTokens.userId,
      expiresAt: invitationTokens.expiresAt,
      usedAt:    invitationTokens.usedAt,
      name:      users.name,
      email:     users.email,
    })
    .from(invitationTokens)
    .innerJoin(users, eq(users.id, invitationTokens.userId))
    .where(eq(invitationTokens.token, token))
    .limit(1);

  return rows[0] ?? null;
}

// ── Définir le mot de passe depuis le lien d'invitation ──────────────────────

export async function setPasswordFromInvitation(
  token: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  if (password.length < 8) {
    return { success: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const invite = await getInvitationByToken(token);

  if (!invite) return { success: false, error: "Lien invalide ou expiré." };
  if (invite.usedAt) return { success: false, error: "Ce lien a déjà été utilisé." };
  if (invite.expiresAt < new Date()) return { success: false, error: "Ce lien a expiré (validité 7 jours)." };

  const passwordHash = await bcrypt.hash(password, 12);

  await db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, invite.userId));

  await db.update(invitationTokens)
    .set({ usedAt: new Date() })
    .where(eq(invitationTokens.token, token));

  revalidatePath("/parametres");
  return { success: true };
}
