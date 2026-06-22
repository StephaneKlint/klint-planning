"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPasswordFromInvitation } from "@/lib/actions/invitations";

interface Props {
  token: string;
  email: string;
}

export function InviteForm({ token, email }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    border: "1.5px solid #E2E8F0",
    borderRadius: 8,
    outline: "none",
    fontFamily: "var(--font-display, system-ui)",
    boxSizing: "border-box" as const,
    color: "#001036",
    background: "#fff",
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8)  { setError("Au moins 8 caractères requis."); return; }

    startTransition(async () => {
      const result = await setPasswordFromInvitation(token, password);
      if (!result.success) { setError(result.error ?? "Une erreur est survenue."); return; }
      router.push("/login?invited=1");
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Adresse e-mail
        </label>
        <input value={email} disabled style={{ ...inputStyle, background: "#F9FAFB", color: "#6B7280" }} />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Mot de passe <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(8 caractères minimum)</span>
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoFocus
          style={inputStyle}
          disabled={isPending}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••"
          required
          style={inputStyle}
          disabled={isPending}
        />
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !password || !confirm}
        style={{
          padding: "12px",
          background: isPending || !password || !confirm ? "#94A3B8" : "#001036",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: isPending ? "wait" : "pointer",
          fontFamily: "var(--font-display, system-ui)",
          transition: "background 150ms",
        }}
      >
        {isPending ? "Enregistrement…" : "Définir mon mot de passe"}
      </button>
    </form>
  );
}
