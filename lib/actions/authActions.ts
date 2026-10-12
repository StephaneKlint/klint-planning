"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { users, platformEvents, passwordResetTokens } from "@/lib/db/schema";
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

// ── Demande de réinitialisation de mot de passe (public, sans session) ────────

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean }> {
  const normalized = email.trim().toLowerCase();

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  // Toujours success pour ne pas révéler si l'email existe
  if (!user) return { success: true };

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://cci-planning-claude-design.vercel.app";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await sendPasswordResetEmail({ toEmail: user.email!, toName: user.name ?? user.email!, resetUrl });

  return { success: true };
}

async function sendPasswordResetEmail({
  toEmail, toName, resetUrl,
}: { toEmail: string; toName: string; resetUrl: string }) {
  if (!process.env.BREVO_API_KEY) return;

  const fromRaw = process.env.EMAIL_FROM ?? "Klint Planning <sdurand@klint-consulting.com>";
  const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
  const senderName  = fromMatch ? fromMatch[1].trim() : "Klint Planning";
  const senderEmail = fromMatch ? fromMatch[2].trim() : fromRaw;

  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: toName }],
        subject: "Réinitialisation de votre mot de passe — Klint Planning",
        htmlContent: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
              <div style="width:36px;height:36px;border-radius:10px;background:#001036;color:white;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center">K</div>
              <span style="font-size:15px;font-weight:700;color:#001036">Klint Planning</span>
            </div>
            <h2 style="color:#001036;margin:0 0 12px;font-size:20px">Réinitialisation de mot de passe</h2>
            <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">
              Bonjour ${toName},<br><br>
              Vous avez demandé à réinitialiser votre mot de passe Klint Planning.
              Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
              Ce lien est valable <strong>1 heure</strong>.
            </p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#001036;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
              Réinitialiser mon mot de passe
            </a>
            <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;line-height:1.5">
              Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe reste inchangé.<br>
              Ce lien expirera automatiquement dans 1 heure.
            </p>
          </div>
        `,
      }),
    });
  } catch {
    // fire-and-forget
  }
}

// ── Réinitialisation du MDP via token (public, sans session) ─────────────────

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 8) {
    return { success: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const [row] = await db
    .select({
      id:        passwordResetTokens.id,
      userId:    passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt:    passwordResetTokens.usedAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!row)              return { success: false, error: "Lien invalide ou expiré." };
  if (row.usedAt)        return { success: false, error: "Ce lien a déjà été utilisé." };
  if (row.expiresAt < new Date()) return { success: false, error: "Ce lien a expiré (validité 1 heure)." };

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));

  return { success: true };
}
