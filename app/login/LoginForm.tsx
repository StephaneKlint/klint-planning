"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./Login.module.css";

export function LoginForm({ error }: { error?: boolean; verify?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(error ? "Identifiants incorrects. Vérifiez votre email et mot de passe." : null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setAuthError(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setAuthError(
          result.code === "geo-blocked"
            ? "Connexion bloquée depuis ce pays. Contactez votre administrateur."
            : "Email ou mot de passe incorrect."
        );
      } else {
        router.push("/p");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {authError && (
        <div className={styles.errorBanner}>{authError}</div>
      )}

      <div>
        <label className={styles.label} htmlFor="email">
          Adresse e-mail
        </label>
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

      <div>
        <label className={styles.label} htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          disabled={isPending}
        />
      </div>

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={isPending || !email.trim() || !password}
      >
        {isPending ? "Connexion en cours…" : "Se connecter"}
      </button>

      <p className={styles.hint}>
        Mot de passe oublié ? Contactez votre administrateur Klint Planning.
      </p>
    </form>
  );
}
