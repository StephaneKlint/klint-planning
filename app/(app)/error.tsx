"use client";
/** Fallback error boundary for all (app) routes. */
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error("[AppError]", error); }, [error]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "80vh",
      padding: 40,
      fontFamily: "var(--font-display, system-ui)",
      gap: 16,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--klint-navy, #001036)", margin: 0 }}>
        Une erreur est survenue
      </h1>
      <p style={{ fontSize: 14, color: "#6B7280", maxWidth: 420, margin: 0 }}>
        Si vous essayiez de modifier un élément, vérifiez que vous avez bien un rôle{" "}
        <strong>Contributeur</strong> ou <strong>Responsable</strong> sur ce planning.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "8px 20px",
          background: "var(--klint-navy, #001036)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Réessayer
      </button>
      {error.digest && (
        <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0 }}>Référence : {error.digest}</p>
      )}
    </div>
  );
}
