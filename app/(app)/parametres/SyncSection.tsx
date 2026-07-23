"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlanningLink, removePlanningFromSyncGroup } from "@/lib/actions/planning-groups";
import type { PlanningGroupRow } from "@/lib/db/queries";
import styles from "./Parametres.module.css";

interface SyncSectionProps {
  currentPlanningId: string;
  planningGroups: PlanningGroupRow[];
  allPlannings: Array<{ id: string; name: string }>;
}

export function SyncSection({ currentPlanningId, planningGroups, allPlannings }: SyncSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);

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
            <button
              type="button"
              onClick={() => handleRemove(group.groupId)}
              disabled={isPending}
              style={{
                fontSize: 12,
                color: "#DC2626",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              Supprimer le lien
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#64748B" }}>
            {group.linkedPlannings.map((lp) => lp.name).join(", ")}
          </div>
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
