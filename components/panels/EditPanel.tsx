"use client";
/**
 * EditPanel — panneau flottant 420px, mode phase complet.
 * Champs : Type, Libellé, Début, Fin, Statut, Avancement, Couleur, Assignés, Note.
 */
import { useTransition, useState } from "react";
import { useGanttStore } from "@/store/ganttStore";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { StatusCode } from "@/components/ui/StatusPill";
import type { GanttData } from "@/lib/db/queries";
import {
  updatePhaseStatus, updatePhaseProgress, updatePhaseNote,
  updatePhaseDates, updatePhaseColor, updateMilestone,
} from "@/lib/actions/planning";
import { useOptimisticPhase } from "@/lib/queries/usePlanning";
import styles from "./EditPanel.module.css";

const STATUS_OPTIONS: { value: StatusCode; label: string; color: string; bg: string }[] = [
  { value: "planned",     label: "Planifiée",  color: "#94A3B8", bg: "#F1F5F9" },
  { value: "in_progress", label: "En cours",   color: "#3B82F6", bg: "#E0EBFE" },
  { value: "review",      label: "En revue",   color: "#EAB308", bg: "#FEF3C7" },
  { value: "done",        label: "Terminée",   color: "#16A34A", bg: "#DCFCE7" },
  { value: "risk",        label: "À risque",   color: "#F59E0B", bg: "#FEF3C7" },
  { value: "late",        label: "En retard",  color: "#DC2626", bg: "#FEE2E2" },
];

const PHASE_TYPE_LABELS: Record<string, string> = {
  cadrage: "Cadrage", dev: "Développement", recette: "Recette",
  formation: "Formation", custom: "Personnalisé",
};

const PALETTE = [
  "#E8568A", "#6B7280", "#3B82F6", "#F59E0B",
  "#16A34A", "#9069E0", "#0D9488",
];

interface EditPanelProps {
  planningId: string;
  data: GanttData;
}

export function EditPanel({ planningId, data }: EditPanelProps) {
  const { editTarget, closeEdit } = useGanttStore();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const patchPhase = useOptimisticPhase();

  if (!editTarget) return null;

  // ──────────────────────────── MODE PHASE ────────────────────────────
  if (editTarget.kind === "phase") {
    const phase = data.phases.find((p) => p.id === editTarget.id);
    if (!phase) return null;
    const lot = data.lots.find((l) => l.id === phase.lotId);
    const domain = data.domains.find((d) => lot && d.id === lot.domainId);
    const currentStatus = (phase.status ?? "planned") as StatusCode;

    const save = <T,>(fn: () => Promise<T>) => {
      startTransition(async () => {
        await fn();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      });
    };

    return (
      <div className={styles.panel} role="dialog" aria-label="Éditer la phase">
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {domain && (
              <span className={styles.domainChip}
                style={{ background: domain.bg, color: domain.strong }}>
                {domain.name}
              </span>
            )}
            {lot?.subtitle && (
              <span className={styles.headerSub} title={lot.subtitle}>
                {lot.subtitle.length > 35 ? lot.subtitle.slice(0, 35) + "…" : lot.subtitle}
              </span>
            )}
          </div>
          <button className={styles.closeBtn} onClick={closeEdit} aria-label="Fermer">
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* ── Title ── */}
        <div className={styles.titleRow}>
          <h2 className={styles.title}>
            {lot?.name} · {phase.label ?? PHASE_TYPE_LABELS[phase.type] ?? phase.type}
          </h2>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>
          {/* Type */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Type</span>
            <select
              className={styles.select}
              defaultValue={phase.type}
              onChange={(e) => {
                // Note : updatePhaseType pas encore implémenté — Jalon 5
                console.log("type change:", e.target.value);
              }}
            >
              {Object.entries(PHASE_TYPE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          {/* Libellé */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Libellé</span>
            <input
              type="text"
              className={styles.input}
              defaultValue={phase.label ?? PHASE_TYPE_LABELS[phase.type] ?? phase.type}
              placeholder="Libellé de la phase…"
              onBlur={(e) => {
                const val = e.target.value.trim();
                patchPhase(planningId, phase.id, { label: val || null });
                save(() => updatePhaseNote({ phaseId: phase.id, planningId, note: phase.note ?? null }));
              }}
            />
          </div>

          {/* Début / Fin */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Début</span>
            <input
              type="date"
              className={styles.dateInput}
              defaultValue={phase.startDate}
              onBlur={(e) => {
                save(() => updatePhaseDates({
                  phaseId: phase.id, planningId,
                  startDate: e.target.value, endDate: phase.endDate,
                }));
              }}
            />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Fin</span>
            <input
              type="date"
              className={styles.dateInput}
              defaultValue={phase.endDate}
              onBlur={(e) => {
                save(() => updatePhaseDates({
                  phaseId: phase.id, planningId,
                  startDate: phase.startDate, endDate: e.target.value,
                }));
              }}
            />
          </div>

          {/* Statut */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Statut</span>
            <div className={styles.statusGrid}>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.statusBtn} ${currentStatus === opt.value ? styles.statusBtnActive : ""}`}
                  style={{
                    background: currentStatus === opt.value ? opt.bg : undefined,
                    borderColor: currentStatus === opt.value ? opt.color : undefined,
                    color: opt.color,
                  }}
                  onClick={() => {
                    const next = currentStatus === opt.value ? null : opt.value;
                    patchPhase(planningId, phase.id, { status: next });
                    save(() => updatePhaseStatus({ phaseId: phase.id, planningId, status: next }));
                  }}
                  disabled={isPending}
                >
                  <span className={styles.statusDot} style={{ background: opt.color }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Avancement */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Avancement</span>
            <div className={styles.progressRow}>
              <input
                type="range" min={0} max={100} step={5}
                value={phase.progress}
                className={styles.slider}
                onChange={(e) => {
                  patchPhase(planningId, phase.id, { progress: Number(e.target.value) });
                }}
                onMouseUp={(e) => {
                  const val = Number((e.target as HTMLInputElement).value);
                  save(() => updatePhaseProgress({ phaseId: phase.id, planningId, progress: val }));
                }}
              />
              <div className={styles.progressInput}>
                <input
                  type="number" min={0} max={100}
                  value={phase.progress}
                  className={styles.progressNum}
                  onChange={(e) => {
                    const val = Math.min(100, Math.max(0, Number(e.target.value)));
                    patchPhase(planningId, phase.id, { progress: val });
                  }}
                  onBlur={(e) => {
                    const val = Math.min(100, Math.max(0, Number(e.target.value)));
                    save(() => updatePhaseProgress({ phaseId: phase.id, planningId, progress: val }));
                  }}
                />
                <span className={styles.progressPct}>%</span>
              </div>
            </div>
          </div>

          {/* Couleur */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Couleur</span>
            <div className={styles.palette}>
              {PALETTE.map((col) => (
                <button
                  key={col}
                  className={`${styles.swatch} ${(phase.color ?? domain?.phaseColor) === col ? styles.swatchActive : ""}`}
                  style={{ background: col }}
                  aria-label={col}
                  onClick={() => {
                    patchPhase(planningId, phase.id, { color: col });
                    save(() => updatePhaseColor({ phaseId: phase.id, planningId, color: col }));
                  }}
                />
              ))}
              {/* Reset to domain color */}
              {phase.color && (
                <button
                  className={styles.swatchReset}
                  title="Couleur du domaine"
                  onClick={() => {
                    patchPhase(planningId, phase.id, { color: null });
                    save(() => updatePhaseColor({ phaseId: phase.id, planningId, color: null }));
                  }}
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* Assignés */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Assigné·es</span>
            <div className={styles.assignees}>
              {data.members.map((m) => (
                <button
                  key={m.id}
                  className={styles.memberChip}
                  title={m.userName}
                  style={{ background: m.color ?? "#001D63" }}
                >
                  {m.initials ?? "?"}
                  <span className={styles.memberName}>{m.userName.split(" ")[0]}</span>
                </button>
              ))}
              <button className={styles.addMember} aria-label="Ajouter un assigné">
                <Icon name="plus" size={12} />
              </button>
            </div>
          </div>

          {/* Note */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Note</span>
            <textarea
              className={styles.textarea}
              defaultValue={phase.note ?? ""}
              placeholder="Ajouter une note libre…"
              rows={3}
              onBlur={(e) => {
                const note = e.target.value.trim() || null;
                save(() => updatePhaseNote({ phaseId: phase.id, planningId, note }));
              }}
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <span className={`${styles.savedIndicator} ${saved ? styles.savedVisible : ""}`}>
            <span className={styles.savedDot} />
            Enregistré
          </span>
          <Button variant="ghost" size="sm" onClick={closeEdit}>
            <Icon name="close" size={12} />
            Annuler
          </Button>
          <Button variant="ghost" size="sm">
            <Icon name="link" size={12} />
            Dépendances
          </Button>
          <button className={styles.deleteBtn} aria-label="Supprimer la phase">
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────── MODE LOT ────────────────────────────
  if (editTarget.kind === "lot") {
    const lot = data.lots.find((l) => l.id === editTarget.id);
    const domain = lot ? data.domains.find((d) => d.id === lot.domainId) : null;
    const lotPhases = data.phases.filter((p) => p.lotId === editTarget.id);
    const lotMilestones = data.milestones.filter((m) => m.lotId === editTarget.id);
    if (!lot) return null;

    return (
      <div className={styles.panel} role="dialog" aria-label="Projet">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {domain && (
              <span className={styles.domainChip} style={{ background: domain.bg, color: domain.strong }}>
                {domain.name}
              </span>
            )}
          </div>
          <button className={styles.closeBtn} onClick={closeEdit}><Icon name="close" size={14} /></button>
        </div>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{lot.name}</h2>
          {lot.subtitle && <p className={styles.lotSubtitle}>{lot.subtitle}</p>}
        </div>
        <div className={styles.body}>
          <div className={styles.statsRow}>
            <span className={styles.stat}><strong>{lotPhases.length}</strong> phases</span>
            <span className={styles.stat}><strong>{lotMilestones.length}</strong> jalons</span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Phases</span>
            <div className={styles.phaseList}>
              {lotPhases.map((p) => (
                <div key={p.id} className={styles.phaseListItem}>
                  <span className={styles.phaseTypeBadge}>
                    {PHASE_TYPE_LABELS[p.type] ?? p.type}
                  </span>
                  <span className={styles.phaseDates}>{p.startDate} → {p.endDate}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Jalons</span>
            <div className={styles.phaseList}>
              {lotMilestones.map((m) => (
                <div key={m.id} className={styles.phaseListItem}>
                  <span className={styles.phaseTypeBadge}>{m.type}</span>
                  <span className={styles.phaseDates}>{m.label} — {m.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={closeEdit}>Fermer</Button>
        </div>
      </div>
    );
  }

  // ──────────────────────────── MODE JALON ────────────────────────────
  if (editTarget.kind === "milestone") {
    const ms = data.milestones.find((m) => m.id === editTarget.id);
    if (!ms) return null;

    return (
      <div className={styles.panel} role="dialog" aria-label="Jalon">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.modeTag}>Jalon</span>
          </div>
          <button className={styles.closeBtn} onClick={closeEdit}><Icon name="close" size={14} /></button>
        </div>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{ms.label}</h2>
        </div>
        <div className={styles.body}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Date</span>
            <input
              type="date"
              className={styles.dateInput}
              defaultValue={ms.date}
              onBlur={(e) => {
                startTransition(async () => {
                  await updateMilestone({ milestoneId: ms.id, planningId, date: e.target.value });
                });
              }}
            />
          </div>
          {ms.note && (
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Note</span>
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>{ms.note}</p>
            </div>
          )}
        </div>
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={closeEdit}>Fermer</Button>
        </div>
      </div>
    );
  }

  return null;
}

export default EditPanel;
