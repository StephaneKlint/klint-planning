"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlanningLink, removePlanningFromSyncGroup, bulkLinkLot } from "@/lib/actions/planning-groups";
import type { PlanningGroupRow } from "@/lib/db/queries";
import styles from "./Parametres.module.css";

interface SyncSectionProps {
  currentPlanningId: string;
  planningGroups: PlanningGroupRow[];
  allPlannings: Array<{ id: string; name: string }>;
  currentLots?: Array<{ id: string; name: string }>;
}

export function SyncSection({ currentPlanningId, planningGroups, allPlannings, currentLots = [] }: SyncSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Bulk link state — one picker per group (keyed by groupId)
  const [bulkGroupId, setBulkGroupId] = useState<string | null>(null);
  const [bulkSourceLotId, setBulkSourceLotId] = useState("");
  const [bulkResult, setBulkResult] = useState<{ linkedPhases: number; linkedMilestones: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

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
    setBulkSourceLotId("");
    setBulkResult(null);
    setBulkError(null);
  }

  async function handleBulkLink(groupId: string) {
    if (!bulkSourceLotId) return;
    setBulkError(null);
    setBulkResult(null);
    startTransition(async () => {
      try {
        const result = await bulkLinkLot({
          sourceLotId: bulkSourceLotId,
          planningGroupId: groupId,
          planningId: currentPlanningId,
        });
        setBulkResult(result);
        if (result.linkedPhases > 0 || result.linkedMilestones > 0) {
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

          {/* Bulk link picker */}
          {bulkGroupId === group.groupId && (
            <div style={{ background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: 10, width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <p style={{ fontSize: 12, color: "#1E40AF", margin: 0, fontWeight: 600 }}>
                Synchroniser par libellé identique
              </p>
              <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>
                Choisissez un projet source — toutes ses phases et jalons seront liés automatiquement aux éléments de même libellé dans {group.linkedPlannings.map((lp) => lp.name).join(", ")}.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 12, whiteSpace: "nowrap" }}>Projet source :</label>
                <select
                  value={bulkSourceLotId}
                  onChange={(e) => { setBulkSourceLotId(e.target.value); setBulkResult(null); }}
                  style={{ flex: 1, fontSize: 12, padding: "4px 8px", borderRadius: 4, border: "1px solid #BFDBFE" }}
                >
                  <option value="">— Choisir un projet —</option>
                  {currentLots.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              {bulkError && <p style={{ fontSize: 11, color: "#DC2626", margin: 0 }}>{bulkError}</p>}
              {bulkResult && (
                <p style={{ fontSize: 11, color: "#16A34A", margin: 0 }}>
                  ✓ {bulkResult.linkedPhases} phase{bulkResult.linkedPhases !== 1 ? "s" : ""} et {bulkResult.linkedMilestones} jalon{bulkResult.linkedMilestones !== 1 ? "s" : ""} synchronisé{bulkResult.linkedMilestones !== 1 ? "s" : ""}.
                  {bulkResult.linkedPhases === 0 && bulkResult.linkedMilestones === 0 && " Aucune correspondance de libellé trouvée."}
                </p>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => handleBulkLink(group.groupId)}
                  disabled={isPending || !bulkSourceLotId}
                  style={{
                    fontSize: 12, padding: "5px 14px",
                    background: !bulkSourceLotId ? "#E5E7EB" : "#2563EB",
                    color: !bulkSourceLotId ? "#9CA3AF" : "#fff",
                    border: "none", borderRadius: 5, cursor: !bulkSourceLotId ? "default" : "pointer",
                  }}
                >
                  {isPending ? "Synchronisation…" : "Synchroniser"}
                </button>
                <button
                  type="button"
                  onClick={() => { setBulkGroupId(null); setBulkResult(null); setBulkError(null); }}
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
