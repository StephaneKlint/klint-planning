"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset, resetPasswordWithToken } from "@/lib/actions/authActions";
import styles from "@/app/login/Login.module.css";

export function ResetPasswordForm({ token }: { token?: string }) {
  if (token) return <SetNewPasswordForm token={token} />;
  return <RequestResetForm />;
}

// ── Formulaire : demande de lien (saisie email) ───────────────────────────────

function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      await requestPasswordReset(email);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div>
        <h1 className={styles.heading}>Email envoyé</h1>
        <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#166534", marginBottom: 20 }}>
          Si un compte existe pour <strong>{email}</strong>, vous recevrez un email avec un lien de réinitialisation valable 1 heure.
        </div>
        <p className={styles.hint}>
          <a href="/login" style={{ color: "#6B7280", textDecoration: "underline" }}>
            Retour à la connexion
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.heading}>Mot de passe oublié</h1>
      <p className={styles.subheading}>
        Saisissez votre adresse email. Vous recevrez un lien pour définir un nouveau mot de passe.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div>
          <label className={styles.label} htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="prenom.nom@organisation.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            disabled={isPending}
          />
        </div>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isPending || !email.trim()}
        >
          {isPending ? "Envoi en cours…" : "Envoyer le lien de réinitialisation"}
        </button>
        <p className={styles.hint}>
          <a href="/login" style={{ color: "#6B7280", textDecoration: "underline" }}>
            Retour à la connexion
          </a>
        </p>
      </form>
    </div>
  );
}

// ── Formulaire : définir un nouveau mot de passe (token présent) ──────────────

function SetNewPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    startTransition(async () => {
      const res = await resetPasswordWithToken(token, password);
      if (res.success) {
        setDone(true);
      } else {
        setError(res.error ?? "Une erreur est survenue.");
      }
    });
  }

  if (done) {
    return (
      <div>
        <h1 className={styles.heading}>Mot de passe modifié</h1>
        <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#166534", marginBottom: 20 }}>
          Votre mot de passe a été mis à jour avec succès.
        </div>
        <a href="/login" className={styles.submitBtn} style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          Se connecter
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className={styles.heading}>Nouveau mot de passe</h1>
      <p className={styles.subheading}>
        Choisissez un nouveau mot de passe d&apos;au moins 8 caractères.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div>
          <label className={styles.label} htmlFor="password">Nouveau mot de passe</label>
          <input
            id="password"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            disabled={isPending}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor="confirm">Confirmer le mot de passe</label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={styles.input}
            disabled={isPending}
          />
        </div>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isPending || !password || !confirm}
        >
          {isPending ? "Enregistrement…" : "Définir le nouveau mot de passe"}
        </button>
      </form>
    </div>
  );
}
