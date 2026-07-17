"use client";
/**
 * Error boundary for /p/[planningId].
 * Catches: server component throws, server action errors propagated via useTransition.
 */
import { useEffect } from "react";

export default function PlanningError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error("[PlanningError]", error); }, [error]);

  const isPermission =
    error.message?.includes("lecture seule") ||
    error.message?.includes("non autorisé") ||
    error.message?.includes("authentifié");

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      padding: 40,
      fontFamily: "var(--font-display, system-ui)",
      gap: 16,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--klint-navy, #001036)", margin: 0 }}>
        {isPermission ? "Accès non autorisé" : "Une erreur est survenue"}
      </h1>
      <p style={{ fontSize: 14, color: "#6B7280", maxWidth: 460, margin: 0 }}>
        {isPermission
          ? "Vous n'avez pas les droits pour effectuer cette action. Contactez un administrateur pour obtenir un rôle Contributeur ou Responsable sur ce planning."
          : "Une erreur inattendue s'est produite lors du chargement ou de la modification du planning."}
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
        <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0 }}>
          Référence : {error.digest}
        </p>
      )}
    </div>
  );
}
