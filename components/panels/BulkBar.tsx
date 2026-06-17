"use client";
/**
 * BulkBar — appears at the bottom when phases and/or milestones are selected.
 * - Ctrl+click phases → selectedPhaseIds
 * - Ctrl+click milestones → selectedMilestoneIds
 * - Status change section: only when phases are selected
 * - Duplicate section: always, picks a target lot
 */
import { useState, useTransition } from "react";
import { useGanttStore } from "@/store/ganttStore";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { StatusCode } from "@/components/ui/StatusPill";
import type { LotRow } from "@/lib/db/queries";
import { bulkUpdatePhaseStatus, duplicatePhase, duplicateMilestone } from "@/lib/actions/planning";
import styles from "./BulkBar.module.css";

const STATUS_OPTIONS: { value: StatusCode; label: string }[] = [
  { value: "planned",     label: "Planifié"   },
  { value: "in_progress", label: "En cours"   },
  { value: "review",      label: "En revue"   },
  { value: "done",        label: "Terminé"    },
  { value: "risk",        label: "À risque"   },
  { value: "late",        label: "En retard"  },
];

interface BulkBarProps {
  planningId: string;
  lots: LotRow[];
}

export function BulkBar({ planningId, lots }: BulkBarProps) {
  const { selectedPhaseIds, selectedMilestoneIds, clearSelection } = useGanttStore();
  const [isPending, startTransition] = useTransition();
  const [dupLotId, setDupLotId] = useState("");

  const phaseCount = selectedPhaseIds.size;
  const msCount    = selectedMilestoneIds.size;

  if (phaseCount === 0 && msCount === 0) return null;

  const countLabel = phaseCount > 0 && msCount > 0
    ? `${phaseCount} phase${phaseCount > 1 ? "s" : ""} + ${msCount} jalon${msCount > 1 ? "s" : ""}`
    : phaseCount > 0
      ? `${phaseCount} phase${phaseCount > 1 ? "s" : ""} sélectionnée${phaseCount > 1 ? "s" : ""}`
      : `${msCount} jalon${msCount > 1 ? "s" : ""} sélectionné${msCount > 1 ? "s" : ""}`;

  const handleDuplicate = () => {
    if (!dupLotId) return;
    startTransition(async () => {
      await Promise.all([
        ...Array.from(selectedPhaseIds).map((phaseId) =>
          duplicatePhase({ phaseId, targetLotId: dupLotId, planningId })
        ),
        ...Array.from(selectedMilestoneIds).map((milestoneId) =>
          duplicateMilestone({ milestoneId, targetLotId: dupLotId, planningId })
        ),
      ]);
      clearSelection();
      setDupLotId("");
    });
  };

  return (
    <div className={styles.bar} role="toolbar" aria-label="Actions sur la sélection">
      <div className={styles.left}>
        <Icon name="layers" size={14} />
        <span className={styles.count}><strong>{countLabel}</strong></span>
      </div>

      {/* Status change — phases only */}
      {phaseCount > 0 && (
        <div className={styles.actions}>
          <span className={styles.label}>Statut :</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={styles.statusBtn}
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await bulkUpdatePhaseStatus({
                    phaseIds: Array.from(selectedPhaseIds),
                    planningId,
                    status: opt.value,
                  });
                  clearSelection();
                });
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Duplicate section */}
      <div className={styles.dupSection}>
        <span className={styles.label}>Dupliquer vers :</span>
        <select
          className={styles.dupSelect}
          value={dupLotId}
          onChange={(e) => setDupLotId(e.target.value)}
          disabled={isPending}
        >
          <option value="">— choisir un lot —</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>{lot.name}</option>
          ))}
        </select>
        <button
          className={styles.dupConfirm}
          disabled={isPending || !dupLotId}
          onClick={handleDuplicate}
        >
          Confirmer
        </button>
      </div>

      <Button variant="ghost" size="sm" onClick={clearSelection}>
        <Icon name="close" size={12} />
        Désélectionner
      </Button>
    </div>
  );
}

export default BulkBar;
