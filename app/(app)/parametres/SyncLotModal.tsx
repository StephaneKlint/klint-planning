"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkLinkLot, syncPlanningGroupStructure } from "@/lib/actions/planning-groups";
import type { PlanningGroupRow } from "@/lib/db/queries";

interface LotWithDomain {
  id: string;
  name: string;
  domainId: string | null;
  domainName: string;
}

interface Props {
  group: PlanningGroupRow;
  currentPlanningId: string;
  currentLots: LotWithDomain[];
  onClose: () => void;
  onSuccess: () => void;
}

type SyncResult = {
  createdElements: number;
  linkedPhases: number;
  linkedMilestones: number;
  lotsNoNameMatch: number;
};

export function SyncLotModal({ group, currentPlanningId, currentLots, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Group lots by domain, preserving insertion order
  const domainOrder: string[] = [];
  const byDomain = new Map<string, LotWithDomain[]>();
  for (const lot of currentLots) {
    const key = lot.domainId ?? "__none__";
    if (!byDomain.has(key)) {
      domainOrder.push(key);
      byDomain.set(key, []);
    }
    byDomain.get(key)!.push(lot);
  }
  const domainNameFor = (key: string) =>
    key === "__none__" ? "Sans domaine" : (byDomain.get(key)?.[0]?.domainName ?? key);

  function toggleLot(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setResult(null);
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === currentLots.length ? new Set() : new Set(currentLots.map((l) => l.id)),
    );
    setResult(null);
  }

  function toggleDomain(domKey: string) {
    const ids = (byDomain.get(domKey) ?? []).map((l) => l.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      ids.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
      return next;
    });
    setResult(null);
  }

  function handleSync() {
    if (selected.size === 0) return;
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        let createdElements = 0;

        if (group.linkedPlannings.length > 0) {
          const lotFilter = [];
          for (const lotId of selected) {
            for (const lp of group.linkedPlannings) {
              lotFilter.push({ targetPlanningId: lp.planningId, sourceLotId: lotId });
            }
          }
          const structResult = await syncPlanningGroupStructure({
            groupId: group.groupId,
            planningId: currentPlanningId,
            lotFilter,
          });
          createdElements = structResult.totalCreated;
        }

        let totalPhases = 0;
        let totalMilestones = 0;
        let totalNoNameMatch = 0;

        for (const lotId of selected) {
          const r = await bulkLinkLot({
            sourceLotId: lotId,
            planningGroupId: group.groupId,
            planningId: currentPlanningId,
          });
          totalPhases += r.linkedPhases;
          totalMilestones += r.linkedMilestones;
          totalNoNameMatch += r.lotNoNameMatch ?? 0;
        }

        setResult({ createdElements, linkedPhases: totalPhases, linkedMilestones: totalMilestones, lotsNoNameMatch: totalNoNameMatch });

        if (createdElements > 0 || totalPhases > 0 || totalMilestones > 0) {
          router.refresh();
          onSuccess();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la synchronisation.");
      }
    });
  }

  const allSelected = selected.size === currentLots.length && currentLots.length > 0;
  const someSelected = selected.size > 0 && selected.size < currentLots.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Synchroniser des lots"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,39,70,0.38)",
        zIndex: 999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff",
        borderRadius: 12,
        width: "min(540px, 100%)",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        overflow: "hidden",
      }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid var(--klint-line)",
          display: "flex", flexDirection: "column", gap: 4,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F2746" }}>
                ⇄ Synchroniser des lots
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748B" }}>
                Groupe&nbsp;: <strong>{group.groupName}</strong>
                {" — "}lié à&nbsp;{group.linkedPlannings.map((lp) => lp.name).join(", ")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 18, color: "#94A3B8", lineHeight: 1,
                padding: "0 0 0 12px", flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
            Les lots manquants dans les plannings liés seront créés.
            Les phases et jalons de même libellé seront liés automatiquement.
          </p>
        </div>

        {/* ── Body (scrollable) ───────────────────────────────────── */}
        <div style={{
          flex: "1 1 0",
          overflowY: "auto",
          padding: "12px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}>
          {domainOrder.map((domKey) => {
            const domLots = byDomain.get(domKey) ?? [];
            const allDomIn = domLots.every((l) => selected.has(l.id));
            const someDomIn = domLots.some((l) => selected.has(l.id));

            return (
              <div key={domKey}>
                {/* Domain header — compact, gap-based (no space-between) */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "3px 0 6px",
                  borderBottom: "1px solid var(--klint-line)",
                  marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#475569",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                  }}>
                    {domainNameFor(domKey)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleDomain(domKey)}
                    style={{
                      fontSize: 10, fontWeight: 600,
                      padding: "2px 8px", borderRadius: 4, cursor: "pointer",
                      background: allDomIn ? "#FEE2E2" : "#EFF6FF",
                      color: allDomIn ? "#DC2626" : "#2563EB",
                      border: `1px solid ${allDomIn ? "#FECACA" : "#BFDBFE"}`,
                      lineHeight: 1.5,
                    }}
                  >
                    {allDomIn ? "Désélectionner" : someDomIn ? "Tout" : "Tout"}
                  </button>
                </div>

                {/* Lots */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 4 }}>
                  {domLots.map((l) => (
                    <label
                      key={l.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        fontSize: 13, cursor: "pointer",
                        padding: "5px 8px", borderRadius: 6,
                        background: selected.has(l.id) ? "#EFF6FF" : "transparent",
                        border: `1px solid ${selected.has(l.id) ? "#BFDBFE" : "transparent"}`,
                        transition: "background 0.1s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggleLot(l.id)}
                        style={{ width: 14, height: 14, accentColor: "#2563EB", flexShrink: 0, cursor: "pointer" }}
                      />
                      <span style={{ color: "#374151" }}>{l.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {currentLots.length === 0 && (
            <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "24px 0" }}>
              Aucun lot dans ce planning.
            </p>
          )}
        </div>

        {/* ── Feedback ────────────────────────────────────────────── */}
        {(error || result) && (
          <div style={{
            padding: "8px 20px",
            borderTop: "1px solid var(--klint-line)",
            display: "flex", flexDirection: "column", gap: 3,
            background: "#FAFBFF", flexShrink: 0,
          }}>
            {error && (
              <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>{error}</p>
            )}
            {result && result.createdElements > 0 && (
              <p style={{ fontSize: 12, color: "#2563EB", margin: 0 }}>
                ✓ {result.createdElements} élément{result.createdElements !== 1 ? "s" : ""} créé{result.createdElements !== 1 ? "s" : ""} dans les plannings liés.
              </p>
            )}
            {result && (result.linkedPhases > 0 || result.linkedMilestones > 0) && (
              <p style={{ fontSize: 12, color: "#16A34A", margin: 0 }}>
                ✓ {result.linkedPhases} phase{result.linkedPhases !== 1 ? "s" : ""} et {result.linkedMilestones} jalon{result.linkedMilestones !== 1 ? "s" : ""} lié{result.linkedMilestones !== 1 ? "s" : ""} par libellé.
              </p>
            )}
            {result && result.createdElements === 0 && result.linkedPhases === 0 && result.linkedMilestones === 0 && (
              <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
                Tous les éléments de ces lots sont déjà synchronisés.
              </p>
            )}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--klint-line)",
          display: "flex", alignItems: "center", gap: 10,
          background: "#fff", flexShrink: 0,
        }}>
          {/* Select-all — right here next to the action button */}
          <label style={{
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 13, cursor: "pointer", userSelect: "none",
            color: "#374151",
          }}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleAll}
              style={{ width: 14, height: 14, accentColor: "#2563EB", cursor: "pointer" }}
            />
            Tout
            <span style={{ fontSize: 12, color: "#64748B" }}>
              ({selected.size}/{currentLots.length})
            </span>
          </label>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 13, padding: "7px 14px",
              background: "none", border: "1px solid var(--klint-line)",
              borderRadius: 7, cursor: "pointer", color: "#374151",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isPending || selected.size === 0}
            style={{
              fontSize: 13, padding: "7px 18px", borderRadius: 7,
              fontWeight: 600, border: "none", cursor: selected.size === 0 ? "default" : "pointer",
              background: selected.size === 0 ? "#E5E7EB" : "#2563EB",
              color: selected.size === 0 ? "#9CA3AF" : "#fff",
              transition: "background 0.15s",
            }}
          >
            {isPending
              ? "Synchronisation…"
              : selected.size > 0
                ? `Synchroniser (${selected.size})`
                : "Synchroniser"}
          </button>
        </div>

      </div>
    </div>
  );
}
