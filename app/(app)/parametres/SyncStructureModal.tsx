"use client";

import { useEffect, useState, useTransition } from "react";
import {
  diffPlanningGroupStructure,
  syncPlanningGroupStructure,
} from "@/lib/actions/planning-groups";
import type {
  PlanningGroupStructureDiff,
  StructureDiff,
  LotDiffEntry,
} from "@/lib/actions/planning-groups";
import type { PlanningGroupRow } from "@/lib/db/queries";

interface Props {
  group: PlanningGroupRow;
  currentPlanningId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type LotKey = string; // `${targetPlanningId}::${sourceLotId}`
type ModalState = "loading" | "preview" | "syncing" | "success" | "error";

function lotKey(targetPlanningId: string, sourceLotId: string): LotKey {
  return `${targetPlanningId}::${sourceLotId}`;
}

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

interface DiffRowProps {
  diff: StructureDiff;
  selectedLotKeys: Set<LotKey>;
  onToggleLot: (key: LotKey) => void;
  onToggleDomain: (targetPlanningId: string, domainKeys: string[]) => void;
  onToggleAll: (targetPlanningId: string, currentlyAllSelected: boolean) => void;
}

function DiffRow({ diff, selectedLotKeys, onToggleLot, onToggleDomain, onToggleAll }: DiffRowProps) {
  const [open, setOpen] = useState(true);

  // Group by domain
  const domainOrder: string[] = [];
  const byDomain = new Map<string, LotDiffEntry[]>();
  for (const ld of diff.lotDiffs) {
    if (!byDomain.has(ld.domainName)) {
      domainOrder.push(ld.domainName);
      byDomain.set(ld.domainName, []);
    }
    byDomain.get(ld.domainName)!.push(ld);
  }

  const allKeys = diff.lotDiffs.map((ld) => lotKey(diff.targetPlanningId, ld.sourceLotId));
  const selectedInPlanning = allKeys.filter((k) => selectedLotKeys.has(k));
  const allSelected = selectedInPlanning.length === allKeys.length && allKeys.length > 0;

  const selectedLots = diff.lotDiffs.filter((ld) =>
    selectedLotKeys.has(lotKey(diff.targetPlanningId, ld.sourceLotId)),
  );
  const selLotsCount = selectedLots.filter((ld) => ld.isNewLot).length;
  const selPhasesCount = selectedLots.reduce((s, ld) => s + ld.phases.length, 0);
  const selMsCount = selectedLots.reduce((s, ld) => s + ld.milestones.length, 0);

  if (diff.lotDiffs.length === 0) {
    return (
      <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#0F2746" }}>{diff.targetPlanningName}</span>
        <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 500 }}>✓ À jour</span>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#FAFBFF" }}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = selectedInPlanning.length > 0 && !allSelected;
          }}
          onChange={() => onToggleAll(diff.targetPlanningId, allSelected)}
          style={{ width: 14, height: 14, accentColor: "#2563EB", flexShrink: 0, cursor: "pointer" }}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, flexWrap: "wrap" }}
        >
          <span style={{ fontWeight: 600, fontSize: 13, color: "#0F2746", flexShrink: 0, marginRight: 4 }}>
            {diff.targetPlanningName}
          </span>
          <Badge n={selLotsCount} label="lot" />
          <Badge n={selPhasesCount} label="phase" />
          <Badge n={selMsCount} label="jalon" />
          <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* Content grouped by domain */}
      {open && (
        <div style={{ padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {domainOrder.map((domainName) => {
            const domainLots = byDomain.get(domainName) ?? [];
            const domainKeys = domainLots.map((ld) => lotKey(diff.targetPlanningId, ld.sourceLotId));
            const domAllSelected = domainKeys.every((k) => selectedLotKeys.has(k));
            const domSomeSelected = domainKeys.some((k) => selectedLotKeys.has(k));

            return (
              <div key={domainName}>
                {/* Domain header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0 4px", borderBottom: "1px solid #F1F5F9", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {domainName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleDomain(diff.targetPlanningId, domainKeys)}
                    style={{ fontSize: 10, color: domAllSelected ? "#DC2626" : "#2563EB", background: "none", border: "none", cursor: "pointer", padding: "1px 4px" }}
                  >
                    {domAllSelected ? "Désélectionner" : domSomeSelected ? "Tout sélectionner" : "Tout sélectionner"}
                  </button>
                </div>

                {/* Lots */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
                  {domainLots.map((ld, i) => {
                    const key = lotKey(diff.targetPlanningId, ld.sourceLotId);
                    const checked = selectedLotKeys.has(key);
                    return (
                      <label
                        key={i}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
                          padding: "5px 8px", borderRadius: 6,
                          background: checked ? "#F8FAFC" : "transparent",
                          borderLeft: `3px solid ${ld.isNewLot ? "#2563EB" : "#CBD5E1"}`,
                          opacity: checked ? 1 : 0.4,
                          transition: "opacity 0.1s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleLot(key)}
                          style={{ width: 13, height: 13, accentColor: "#2563EB", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
                        />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            {ld.isNewLot && (
                              <span style={{ fontSize: 9, background: "#DBEAFE", color: "#1D4ED8", borderRadius: 3, padding: "0 4px", fontWeight: 700, textTransform: "uppercase" }}>
                                Nouveau
                              </span>
                            )}
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{ld.lotName}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 1, display: "flex", gap: 6 }}>
                            {ld.phases.length > 0 && <span>{ld.phases.length} phase{ld.phases.length > 1 ? "s" : ""}</span>}
                            {ld.milestones.length > 0 && <span>{ld.milestones.length} jalon{ld.milestones.length > 1 ? "s" : ""}</span>}
                            <span style={{ color: "#94A3B8" }}>depuis {ld.sourcePlanningName}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
  const [selectedLotKeys, setSelectedLotKeys] = useState<Set<LotKey>>(new Set());

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await diffPlanningGroupStructure({
          groupId: group.groupId,
          planningId: currentPlanningId,
        });
        setDiff(result);
        // All lots selected by default
        const allKeys = new Set<LotKey>();
        for (const d of result.diffs) {
          for (const ld of d.lotDiffs) {
            allKeys.add(lotKey(d.targetPlanningId, ld.sourceLotId));
          }
        }
        setSelectedLotKeys(allKeys);
        setState("preview");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de l'analyse.");
        setState("error");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggleLot(key: LotKey) {
    setSelectedLotKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleToggleDomain(targetPlanningId: string, domainKeys: string[]) {
    setSelectedLotKeys((prev) => {
      const next = new Set(prev);
      const allDomainSelected = domainKeys.every((k) => next.has(k));
      if (allDomainSelected) domainKeys.forEach((k) => next.delete(k));
      else domainKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function handleToggleAll(targetPlanningId: string, currentlyAllSelected: boolean) {
    setSelectedLotKeys((prev) => {
      const next = new Set(prev);
      if (!diff) return next;
      const d = diff.diffs.find((x) => x.targetPlanningId === targetPlanningId);
      if (!d) return next;
      const planningKeys = d.lotDiffs.map((ld) => lotKey(targetPlanningId, ld.sourceLotId));
      if (currentlyAllSelected) planningKeys.forEach((k) => next.delete(k));
      else planningKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  // Count selected elements for button label
  const selectedTotal = diff
    ? diff.diffs.reduce((sum, d) => {
        return (
          sum +
          d.lotDiffs.reduce((s, ld) => {
            if (!selectedLotKeys.has(lotKey(d.targetPlanningId, ld.sourceLotId))) return s;
            return s + (ld.isNewLot ? 1 : 0) + ld.phases.length + ld.milestones.length;
          }, 0)
        );
      }, 0)
    : 0;

  function handleSync() {
    if (!diff) return;
    setState("syncing");

    // Build lot filter — undefined means "all"
    const allKeys = diff.diffs.flatMap((d) =>
      d.lotDiffs.map((ld) => lotKey(d.targetPlanningId, ld.sourceLotId)),
    );
    const isAllSelected =
      allKeys.length === selectedLotKeys.size && allKeys.every((k) => selectedLotKeys.has(k));

    const lotFilter = isAllSelected
      ? undefined
      : Array.from(selectedLotKeys).map((key) => {
          const sep = key.indexOf("::");
          return {
            targetPlanningId: key.slice(0, sep),
            sourceLotId: key.slice(sep + 2),
          };
        });

    startTransition(async () => {
      try {
        const result = await syncPlanningGroupStructure({
          groupId: group.groupId,
          planningId: currentPlanningId,
          lotFilter,
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

  const canSync = selectedTotal > 0 && state === "preview";

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

      {/* Modal — overflow: hidden is the key fix for inner scroll */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 1001, width: "min(680px, 96vw)",
        background: "#fff", borderRadius: 12,
        boxShadow: "0 8px 40px rgba(15,39,70,0.18)",
        display: "flex", flexDirection: "column",
        maxHeight: "88vh",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #E2E8F0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0F2746", margin: 0 }}>
              ⇄ Synchronisation structurelle
            </p>
            <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
              Groupe « {group.groupName} »
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

        {/* Body — scrollable */}
        <div style={{
          flex: "1 1 0",
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          {/* Loading */}
          {state === "loading" && (
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
                    Cochez les lots à créer. Tous sont sélectionnés par défaut — décochez ceux à ignorer.
                  </p>
                  {diff.diffs.map((d) => (
                    <DiffRow
                      key={d.targetPlanningId}
                      diff={d}
                      selectedLotKeys={selectedLotKeys}
                      onToggleLot={handleToggleLot}
                      onToggleDomain={handleToggleDomain}
                      onToggleAll={handleToggleAll}
                    />
                  ))}
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
            {state === "preview" && (
              <button
                type="button"
                onClick={handleSync}
                disabled={isPending || !canSync}
                style={{
                  fontSize: 13, padding: "7px 18px",
                  background: canSync ? "#2563EB" : "#E5E7EB",
                  color: canSync ? "#fff" : "#9CA3AF",
                  border: "none", borderRadius: 6,
                  cursor: canSync ? "pointer" : "default",
                  fontWeight: 600,
                }}
              >
                ⇄ Synchroniser ({selectedTotal})
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
