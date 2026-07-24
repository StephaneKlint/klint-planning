"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlanningLink, removePlanningFromSyncGroup, bulkLinkLot } from "@/lib/actions/planning-groups";
import type { PlanningGroupRow } from "@/lib/db/queries";
import { SyncStructureModal } from "./SyncStructureModal";
import styles from "./Parametres.module.css";

interface LotWithDomain {
  id: string;
  name: string;
  domainId: string | null;
  domainName: string;
}

interface SyncSectionProps {
  currentPlanningId: string;
  planningGroups: PlanningGroupRow[];
  allPlannings: Array<{ id: string; name: string }>;
  currentLots?: LotWithDomain[];
}

export function SyncSection({ currentPlanningId, planningGroups, allPlannings, currentLots = [] }: SyncSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Full structure sync modal
  const [structureSyncGroupId, setStructureSyncGroupId] = useState<string | null>(null);

  // Bulk link state — one picker per group (keyed by groupId)
  const [bulkGroupId, setBulkGroupId] = useState<string | null>(null);
  const [bulkSelectedLotIds, setBulkSelectedLotIds] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<{
    linkedPhases: number;
    linkedMilestones: number;
    lotsNoNameMatch: number;
  } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Group lots by domain for the picker
  const lotsByDomain = currentLots.reduce<Record<string, LotWithDomain[]>>((acc, l) => {
    const key = l.domainId ?? "__none__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {});
  const domainOrder = Array.from(new Set(currentLots.map((l) => l.domainId ?? "__none__")));
  const domainNameFor = (key: string) =>
    key === "__none__" ? "Sans domaine" : (currentLots.find((l) => l.domainId === key)?.domainName ?? key);

  // Plannings not yet linked to this one
  const linkedIds = new Set(
    planningGroups.flatMap((g) => g.linkedPlannings.map((lp) => lp.planningId)),
  );
  const available = allPlannings.filter(
    (p) => p.id !== currentPlanningId && !linkedIds.has(p.id),
  );

  async function handleAdd() {
    if (!targetId || !groupName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createPlanningLink({
          sourcePlanningId: currentPlanningId,
          targetPlanningId: targetId,
          groupName: groupName.trim(),
        });
        setShowForm(false);
        setTargetId("");
        setGroupName("");
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur lors de la création du lien.");
      }
    });
  }

  async function handleRemove(groupId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removePlanningFromSyncGroup({ groupId, planningId: currentPlanningId });
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur lors de la suppression du lien.");
      }
    });
  }

  function handleOpenBulkPicker(groupId: string) {
    setBulkGroupId(groupId);
    setBulkSelectedLotIds(new Set());
    setBulkResult(null);
    setBulkError(null);
  }

  function toggleBulkLot(lotId: string) {
    setBulkSelectedLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
    setBulkResult(null);
  }

  function toggleAllLots() {
    setBulkSelectedLotIds((prev) =>
      prev.size === currentLots.length ? new Set() : new Set(currentLots.map((l) => l.id)),
    );
    setBulkResult(null);
  }

  function toggleDomainLots(domainKey: string) {
    const domainLotIds = (lotsByDomain[domainKey] ?? []).map((l) => l.id);
    setBulkSelectedLotIds((prev) => {
      const next = new Set(prev);
      const allSelected = domainLotIds.every((id) => next.has(id));
      if (allSelected) domainLotIds.forEach((id) => next.delete(id));
      else domainLotIds.forEach((id) => next.add(id));
      return next;
    });
    setBulkResult(null);
  }

  async function handleBulkLink(groupId: string) {
    if (bulkSelectedLotIds.size === 0) return;
    setBulkError(null);
    setBulkResult(null);
    startTransition(async () => {
      try {
        let totalPhases = 0;
        let totalMilestones = 0;
        let totalNoNameMatch = 0;
        for (const lotId of bulkSelectedLotIds) {
          const result = await bulkLinkLot({
            sourceLotId: lotId,
            planningGroupId: groupId,
            planningId: currentPlanningId,
          });
          totalPhases += result.linkedPhases;
          totalMilestones += result.linkedMilestones;
          totalNoNameMatch += result.lotNoNameMatch ?? 0;
        }
        setBulkResult({ linkedPhases: totalPhases, linkedMilestones: totalMilestones, lotsNoNameMatch: totalNoNameMatch });
        if (totalPhases > 0 || totalMilestones > 0) {
          router.refresh();
        }
      } catch (e: unknown) {
        setBulkError(e instanceof Error ? e.message : "Erreur lors de la synchronisation.");
      }
    });
  }

  return (
    <div className={styles.settingsBlock} style={{ marginTop: 16 }}>
      <p className={styles.blockTitle} style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
        Plannings liés (synchronisation)
      </p>
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 12 }}>
        Les phases et jalons partagés entre plannings liés se synchronisent automatiquement.
        Utilisez &quot;Lier&quot; sur chaque phase dans le Gantt pour activer la synchro.
      </p>

      {planningGroups.length === 0 && !showForm && (
        <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 8 }}>
          Aucun planning lié pour le moment.
        </p>
      )}

      {/* Existing groups */}
      {planningGroups.map((group) => (
        <div
          key={group.groupId}
          className={styles.settingRow}
          style={{ alignItems: "flex-start", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: "1px solid var(--klint-line)" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--klint-navy)" }}>
              {group.groupName}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setStructureSyncGroupId(group.groupId)}
                disabled={isPending}
                style={{
                  fontSize: 11, color: "#0F2746", background: "none",
                  border: "1px solid #CBD5E1", cursor: "pointer",
                  padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                }}
                title="Créer les éléments manquants dans tous les plannings du groupe"
              >
                ⇄ Sync. structure
              </button>
              {currentLots.length > 0 && (
                <button
                  type="button"
                  onClick={() => bulkGroupId === group.groupId ? setBulkGroupId(null) : handleOpenBulkPicker(group.groupId)}
                  disabled={isPending}
                  style={{
                    fontSize: 11, color: "#2563EB", background: "none",
                    border: "1px solid #BFDBFE", cursor: "pointer",
                    padding: "2px 8px", borderRadius: 4,
                  }}
                >
                  ⇄ Synchroniser un lot
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(group.groupId)}
                disabled={isPending}
                style={{
                  fontSize: 12, color: "#DC2626", background: "none",
                  border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4,
                }}
              >
                Supprimer le lien
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#64748B" }}>
            ⇄ {group.linkedPlannings.map((lp) => lp.name).join(", ")}
          </div>

          {/* Bulk link picker — grouped by domain */}
          {bulkGroupId === group.groupId && (
            <div style={{ background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: 12, width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <p style={{ fontSize: 12, color: "#1E40AF", margin: 0, fontWeight: 600 }}>
                Synchroniser par libellé identique
              </p>
              <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>
                Phases et jalons de même libellé seront liés automatiquement. Les lots doivent porter le même nom dans les deux plannings — sinon utilisez <strong>⇄ Sync. structure</strong> pour créer les lots manquants.
              </p>

              {/* Select all */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", padding: "4px 0", borderBottom: "1px solid #BFDBFE", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={bulkSelectedLotIds.size === currentLots.length && currentLots.length > 0}
                  ref={(el) => {
                    if (el) el.indeterminate = bulkSelectedLotIds.size > 0 && bulkSelectedLotIds.size < currentLots.length;
                  }}
                  onChange={toggleAllLots}
                  style={{ width: 14, height: 14, accentColor: "#2563EB", cursor: "pointer" }}
                />
                Tout sélectionner ({currentLots.length} lot{currentLots.length !== 1 ? "s" : ""})
              </label>

              {/* Lots grouped by domain */}
              <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {domainOrder.map((domKey) => {
                  const domLots = lotsByDomain[domKey] ?? [];
                  const allChecked = domLots.every((l) => bulkSelectedLotIds.has(l.id));
                  const someChecked = domLots.some((l) => bulkSelectedLotIds.has(l.id));
                  return (
                    <div key={domKey}>
                      {/* Domain header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 4px 3px 0", marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {domainNameFor(domKey)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleDomainLots(domKey)}
                          style={{ fontSize: 10, color: allChecked ? "#DC2626" : "#2563EB", background: "none", border: "none", cursor: "pointer", padding: "1px 4px" }}
                        >
                          {allChecked ? "Désélectionner" : someChecked ? "Tout sélectionner" : "Tout sélectionner"}
                        </button>
                      </div>
                      {/* Lots in this domain */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 8 }}>
                        {domLots.map((l) => (
                          <label
                            key={l.id}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                              cursor: "pointer", padding: "4px 6px", borderRadius: 5,
                              background: bulkSelectedLotIds.has(l.id) ? "#EFF6FF" : "transparent",
                              border: bulkSelectedLotIds.has(l.id) ? "1px solid #BFDBFE" : "1px solid transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={bulkSelectedLotIds.has(l.id)}
                              onChange={() => toggleBulkLot(l.id)}
                              style={{ width: 14, height: 14, accentColor: "#2563EB", cursor: "pointer", flexShrink: 0 }}
                            />
                            {l.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {bulkSelectedLotIds.size > 0 && (
                <p style={{ fontSize: 11, color: "#2563EB", margin: 0 }}>
                  {bulkSelectedLotIds.size} lot{bulkSelectedLotIds.size !== 1 ? "s" : ""} sélectionné{bulkSelectedLotIds.size !== 1 ? "s" : ""}
                </p>
              )}
              {bulkError && <p style={{ fontSize: 11, color: "#DC2626", margin: 0 }}>{bulkError}</p>}
              {bulkResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {(bulkResult.linkedPhases > 0 || bulkResult.linkedMilestones > 0) && (
                    <p style={{ fontSize: 11, color: "#16A34A", margin: 0 }}>
                      ✓ {bulkResult.linkedPhases} phase{bulkResult.linkedPhases !== 1 ? "s" : ""} et {bulkResult.linkedMilestones} jalon{bulkResult.linkedMilestones !== 1 ? "s" : ""} synchronisé{bulkResult.linkedMilestones !== 1 ? "s" : ""}.
                    </p>
                  )}
                  {bulkResult.lotsNoNameMatch > 0 && (
                    <p style={{ fontSize: 11, color: "#92400E", margin: 0 }}>
                      ⚠ {bulkResult.lotsNoNameMatch} lot{bulkResult.lotsNoNameMatch !== 1 ? "s" : ""} sans correspondance de nom dans les plannings liés. Utilisez <strong>⇄ Sync. structure</strong> pour créer les lots manquants.
                    </p>
                  )}
                  {bulkResult.linkedPhases === 0 && bulkResult.linkedMilestones === 0 && bulkResult.lotsNoNameMatch === 0 && (
                    <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>
                      Toutes les phases de ces lots sont déjà synchronisées.
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => handleBulkLink(group.groupId)}
                  disabled={isPending || bulkSelectedLotIds.size === 0}
                  style={{
                    fontSize: 12, padding: "5px 14px",
                    background: bulkSelectedLotIds.size === 0 ? "#E5E7EB" : "#2563EB",
                    color: bulkSelectedLotIds.size === 0 ? "#9CA3AF" : "#fff",
                    border: "none", borderRadius: 5,
                    cursor: bulkSelectedLotIds.size === 0 ? "default" : "pointer",
                  }}
                >
                  {isPending ? "Synchronisation…" : `Synchroniser${bulkSelectedLotIds.size > 1 ? ` (${bulkSelectedLotIds.size})` : ""}`}
                </button>
                <button
                  type="button"
                  onClick={() => { setBulkGroupId(null); setBulkResult(null); setBulkError(null); setBulkSelectedLotIds(new Set()); }}
                  style={{ fontSize: 12, padding: "5px 10px", background: "none", border: "1px solid #E5E7EB", borderRadius: 5, cursor: "pointer" }}
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add link form */}
      {/* Structure sync modal */}
      {structureSyncGroupId && (() => {
        const group = planningGroups.find((g) => g.groupId === structureSyncGroupId);
        if (!group) return null;
        return (
          <SyncStructureModal
            group={group}
            currentPlanningId={currentPlanningId}
            onClose={() => setStructureSyncGroupId(null)}
            onSuccess={() => { setStructureSyncGroupId(null); router.refresh(); }}
          />
        );
      })()}

      {showForm ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className={styles.settingRow}>
            <label className={styles.settingLabel} style={{ minWidth: 120 }}>Planning à lier</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--klint-line)" }}
            >
              <option value="">— Choisir un planning —</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.settingRow}>
            <label className={styles.settingLabel} style={{ minWidth: 120 }}>Nom du groupe</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ex. : Projet Atlantique"
              style={{ flex: 1, fontSize: 13, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--klint-line)" }}
            />
          </div>
          {error && <p style={{ fontSize: 12, color: "#DC2626" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !targetId || !groupName.trim()}
              className={styles.saveBtn}
              style={{ fontSize: 12, padding: "6px 16px" }}
            >
              {isPending ? "En cours…" : "Créer le lien"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); setTargetId(""); setGroupName(""); }}
              style={{ fontSize: 12, padding: "6px 12px", background: "none", border: "1px solid var(--klint-line)", borderRadius: 4, cursor: "pointer" }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={available.length === 0}
          className={styles.addBtn}
          style={{ marginTop: 8, fontSize: 12 }}
          title={available.length === 0 ? "Tous les plannings sont déjà liés" : undefined}
        >
          + Lier un planning
        </button>
      )}
    </div>
  );
}
