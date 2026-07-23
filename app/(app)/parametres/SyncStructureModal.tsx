"use client";

import { useEffect, useState, useTransition } from "react";
import {
  diffPlanningGroupStructure,
  syncPlanningGroupStructure,
} from "@/lib/actions/planning-groups";
import type {
  PlanningGroupStructureDiff,
  StructureDiff,
} from "@/lib/actions/planning-groups";
import type { PlanningGroupRow } from "@/lib/db/queries";

interface Props {
  group: PlanningGroupRow;
  currentPlanningId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalState = "loading" | "preview" | "syncing" | "success" | "error";

function Badge({ n, label }: { n: number; label: string }) {
  if (n === 0) return null;
  return (
    <span style={{
      fontSize: 11, background: "#EFF6FF", color: "#1D4ED8",
      borderRadius: 4, padding: "1px 6px", fontWeight: 600,
    }}>
      {n} {label}{n > 1 ? "s" : ""}
    </span>
  );
}

function DiffRow({ diff }: { diff: StructureDiff }) {
  const [open, setOpen] = useState(diff.totalLotsToCreate + diff.totalPhasesToCreate + diff.totalMilestonesToCreate > 0);
  const hasNothing = diff.lotDiffs.length === 0;

  return (
    <div style={{
      border: "1px solid var(--klint-line, #E2E8F0)",
      borderRadius: 8, overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: hasNothing ? "#F8FAFC" : "#FAFBFF",
          border: "none", cursor: hasNothing ? "default" : "pointer", textAlign: "left",
          gap: 10,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--klint-navy, #0F2746)", flexShrink: 0 }}>
          {diff.targetPlanningName}
        </span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {hasNothing ? (
            <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 500 }}>✓ À jour</span>
          ) : (
            <>
              <Badge n={diff.totalLotsToCreate} label="lot" />
              <Badge n={diff.totalPhasesToCreate} label="phase" />
              <Badge n={diff.totalMilestonesToCreate} label="jalon" />
            </>
          )}
        </span>
        {!hasNothing && (
          <span style={{ fontSize: 12, color: "#94A3B8", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
        )}
      </button>

      {open && !hasNothing && (
        <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {diff.lotDiffs.map((ld, i) => (
            <div key={i} style={{
              padding: "7px 10px", background: "#F8FAFC",
              borderRadius: 6, borderLeft: `3px solid ${ld.isNewLot ? "#2563EB" : "#94A3B8"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {ld.isNewLot && (
                  <span style={{
                    fontSize: 10, background: "#DBEAFE", color: "#1D4ED8",
                    borderRadius: 3, padding: "0 5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>Nouveau</span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{ld.lotName}</span>
                <span style={{ fontSize: 11, color: "#64748B" }}>— {ld.domainName}</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 3, display: "flex", gap: 8 }}>
                {ld.phases.length > 0 && <span>{ld.phases.length} phase{ld.phases.length > 1 ? "s" : ""}</span>}
                {ld.milestones.length > 0 && <span>{ld.milestones.length} jalon{ld.milestones.length > 1 ? "s" : ""}</span>}
                <span style={{ color: "#94A3B8" }}>depuis {ld.sourcePlanningName}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SyncStructureModal({ group, currentPlanningId, onClose, onSuccess }: Props) {
  const [state, setState] = useState<ModalState>("loading");
  const [diff, setDiff] = useState<PlanningGroupStructureDiff | null>(null);
  const [totalCreated, setTotalCreated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await diffPlanningGroupStructure({
          groupId: group.groupId,
          planningId: currentPlanningId,
        });
        setDiff(result);
        setState("preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'analyse.");
        setState("error");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSync() {
    setState("syncing");
    startTransition(async () => {
      try {
        const result = await syncPlanningGroupStructure({
          groupId: group.groupId,
          planningId: currentPlanningId,
        });
        setTotalCreated(result.totalCreated);
        setState("success");
        onSuccess();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la synchronisation.");
        setState("error");
      }
    });
  }

  const canSync = diff && diff.grandTotal > 0;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(15,39,70,0.45)",
          zIndex: 1000, backdropFilter: "blur(2px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 1001, width: "min(620px, 94vw)",
        background: "#fff", borderRadius: 12,
        boxShadow: "0 8px 40px rgba(15,39,70,0.18)",
        display: "flex", flexDirection: "column", maxHeight: "85vh",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #E2E8F0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--klint-navy, #0F2746)", margin: 0 }}>
              ⇄ Synchronisation structurelle
            </p>
            <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
              Groupe &laquo; {group.groupName} &raquo;
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none", border: "none", fontSize: 20, color: "#94A3B8",
              cursor: "pointer", lineHeight: 1, padding: "2px 6px", borderRadius: 4,
            }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Loading */}
          {(state === "loading") && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748B" }}>
              <div style={{
                width: 32, height: 32, border: "3px solid #E2E8F0",
                borderTopColor: "#2563EB", borderRadius: "50%",
                margin: "0 auto 12px", animation: "spin 0.8s linear infinite",
              }} />
              <p style={{ fontSize: 13, margin: 0 }}>Analyse des différences en cours…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Syncing */}
          {state === "syncing" && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748B" }}>
              <div style={{
                width: 32, height: 32, border: "3px solid #E2E8F0",
                borderTopColor: "#2563EB", borderRadius: "50%",
                margin: "0 auto 12px", animation: "spin 0.8s linear infinite",
              }} />
              <p style={{ fontSize: 13, margin: 0 }}>Création et liaison des éléments…</p>
            </div>
          )}

          {/* Preview */}
          {state === "preview" && diff && (
            <>
              {diff.grandTotal === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ fontSize: 28, margin: "0 0 10px" }}>✓</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#16A34A", margin: "0 0 4px" }}>
                    Tous les plannings sont déjà synchronisés
                  </p>
                  <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                    Aucun élément manquant détecté dans le groupe.
                  </p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 4px" }}>
                    Les éléments ci-dessous seront créés dans chaque planning et automatiquement liés.
                  </p>
                  {diff.diffs.map((d) => (
                    <DiffRow key={d.targetPlanningId} diff={d} />
                  ))}
                  {/* Plannings already up-to-date (not in diffs) */}
                  {/* We only show plannings that have diffs above; up-to-date ones are omitted for brevity */}
                </>
              )}
            </>
          )}

          {/* Success */}
          {state === "success" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: 36, margin: "0 0 10px" }}>✓</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#16A34A", margin: "0 0 6px" }}>
                Synchronisation terminée
              </p>
              <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
                {totalCreated} élément{totalCreated > 1 ? "s" : ""} créé{totalCreated > 1 ? "s" : ""} et lié{totalCreated > 1 ? "s" : ""} avec succès.
              </p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA",
              borderRadius: 8, padding: 16, textAlign: "center",
            }}>
              <p style={{ fontSize: 13, color: "#DC2626", margin: 0 }}>
                {error ?? "Une erreur est survenue."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: "1px solid #E2E8F0",
          display: "flex", flexDirection: "column", gap: 10, flexShrink: 0,
        }}>
          {state === "preview" && (
            <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontStyle: "italic" }}>
              Les assignations non-membres du planning cible seront ignorées.
              Les statuts et avancements sont copiés à la création.
            </p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending && state === "syncing"}
              style={{
                fontSize: 13, padding: "7px 16px", background: "none",
                border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", color: "#374151",
              }}
            >
              {state === "success" ? "Fermer" : "Annuler"}
            </button>
            {state === "preview" && canSync && (
              <button
                type="button"
                onClick={handleSync}
                disabled={isPending}
                style={{
                  fontSize: 13, padding: "7px 18px",
                  background: "#2563EB", color: "#fff",
                  border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600,
                }}
              >
                ⇄ Synchroniser ({diff?.grandTotal})
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
