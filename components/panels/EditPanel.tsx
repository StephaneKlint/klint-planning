"use client";
/**
 * EditPanel — panneau flottant 420px, mode phase complet.
 * Champs : Type, Libellé, Début, Fin, Statut, Avancement, Couleur, Assignés, Note.
 */
import { useTransition, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGanttStore } from "@/store/ganttStore";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { StatusCode } from "@/components/ui/StatusPill";
import type { GanttData } from "@/lib/db/queries";
import {
  updatePhaseStatus, updatePhaseProgress, updatePhaseNote,
  updatePhaseDates, updatePhaseColor, updatePhaseLabel,
  updateMilestone, togglePhaseAssignee,
  createLot, createPhase,
} from "@/lib/actions/planning";
import { useOptimisticPhase, planningQueryKey } from "@/lib/queries/usePlanning";
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
  const { editTarget, closeEdit, pushUndo } = useGanttStore();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const patchPhase = useOptimisticPhase();
  const qc = useQueryClient();
  const router = useRouter();

  // Assignées dropdown state
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const assigneeWrapperRef = useRef<HTMLDivElement>(null);

  // Create mode form state
  const [createName, setCreateName] = useState("");
  const [createSubtitle, setCreateSubtitle] = useState("");
  const [createPhaseType, setCreatePhaseType] = useState("cadrage");
  const [createPhaseLabel, setCreatePhaseLabel] = useState("");
  const [createPhaseStart, setCreatePhaseStart] = useState("");
  const [createPhaseEnd, setCreatePhaseEnd] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showAssigneeDropdown) return;
    const handler = (e: MouseEvent) => {
      if (assigneeWrapperRef.current && !assigneeWrapperRef.current.contains(e.target as Node)) {
        setShowAssigneeDropdown(false);
        setAssigneeSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssigneeDropdown]);

  // Reset all transient state when switching edit target
  useEffect(() => {
    setShowAssigneeDropdown(false);
    setAssigneeSearch("");
    setCreateName("");
    setCreateSubtitle("");
    setCreatePhaseType("cadrage");
    setCreatePhaseLabel("");
    setCreatePhaseStart("");
    setCreatePhaseEnd("");
    setCreateError(null);
  }, [editTarget]);

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
                const val = e.target.value.trim() || null;
                const prev = phase.label ?? null;
                patchPhase(planningId, phase.id, { label: val });
                save(() => updatePhaseLabel({ phaseId: phase.id, planningId, label: val }));
                pushUndo({ type: "phase-label", phaseId: phase.id, planningId, prev });
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
                const prevStart = phase.startDate;
                const prevEnd   = phase.endDate;
                save(() => updatePhaseDates({
                  phaseId: phase.id, planningId,
                  startDate: e.target.value, endDate: phase.endDate,
                }));
                pushUndo({ type: "phase-dates", phaseId: phase.id, planningId, prevStart, prevEnd });
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
                const prevStart = phase.startDate;
                const prevEnd   = phase.endDate;
                save(() => updatePhaseDates({
                  phaseId: phase.id, planningId,
                  startDate: phase.startDate, endDate: e.target.value,
                }));
                pushUndo({ type: "phase-dates", phaseId: phase.id, planningId, prevStart, prevEnd });
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
                    const prev = phase.status ?? null;
                    const next = currentStatus === opt.value ? null : opt.value;
                    patchPhase(planningId, phase.id, { status: next });
                    save(() => updatePhaseStatus({ phaseId: phase.id, planningId, status: next }));
                    pushUndo({ type: "phase-status", phaseId: phase.id, planningId, prev });
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
                  const prev = phase.progress;
                  const val = Number((e.target as HTMLInputElement).value);
                  save(() => updatePhaseProgress({ phaseId: phase.id, planningId, progress: val }));
                  pushUndo({ type: "phase-progress", phaseId: phase.id, planningId, prev });
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
                    const prev = phase.progress;
                    const val = Math.min(100, Math.max(0, Number(e.target.value)));
                    save(() => updatePhaseProgress({ phaseId: phase.id, planningId, progress: val }));
                    pushUndo({ type: "phase-progress", phaseId: phase.id, planningId, prev });
                  }}
                />
                <span className={styles.progressPct}>%</span>
              </div>
            </div>
          </div>

          {/* Couleur */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Couleur</span>
            <div>
              <div className={styles.palette}>
                {PALETTE.map((col) => (
                  <button
                    key={col}
                    className={`${styles.swatch} ${(phase.color ?? domain?.phaseColor) === col ? styles.swatchActive : ""}`}
                    style={{ background: col }}
                    aria-label={col}
                    onClick={() => {
                      const prev = phase.color ?? null;
                      patchPhase(planningId, phase.id, { color: col });
                      save(() => updatePhaseColor({ phaseId: phase.id, planningId, color: col }));
                      pushUndo({ type: "phase-color", phaseId: phase.id, planningId, prev });
                    }}
                  />
                ))}
                {phase.color && (
                  <button
                    className={styles.swatchReset}
                    title="Couleur du domaine"
                    onClick={() => {
                      const prev = phase.color ?? null;
                      patchPhase(planningId, phase.id, { color: null });
                      save(() => updatePhaseColor({ phaseId: phase.id, planningId, color: null }));
                      pushUndo({ type: "phase-color", phaseId: phase.id, planningId, prev });
                    }}
                  >
                    ↺
                  </button>
                )}
              </div>
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={phase.color ?? domain?.phaseColor ?? "#6B7280"}
                  onChange={(e) => {
                    patchPhase(planningId, phase.id, { color: e.target.value });
                    save(() => updatePhaseColor({ phaseId: phase.id, planningId, color: e.target.value }));
                  }}
                  onBlur={() => {
                    const prev = phase.color ?? null;
                    pushUndo({ type: "phase-color", phaseId: phase.id, planningId, prev });
                  }}
                  title="Choisir une couleur"
                />
                <input
                  type="text"
                  className={styles.hexInput}
                  value={phase.color ?? domain?.phaseColor ?? "#6B7280"}
                  placeholder="#000000"
                  maxLength={7}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                      const prev = phase.color ?? null;
                      patchPhase(planningId, phase.id, { color: v });
                      save(() => updatePhaseColor({ phaseId: phase.id, planningId, color: v }));
                      pushUndo({ type: "phase-color", phaseId: phase.id, planningId, prev });
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Assigné·es — chips des assignés + dropdown de recherche */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Assigné·es</span>
            <div ref={assigneeWrapperRef} className={styles.assigneesWrapper}>
              {/* Chips des membres assignés + bouton + */}
              <div className={styles.assigneesChips}>
                {data.members
                  .filter((m) => data.phaseAssignees.some((a) => a.phaseId === phase.id && a.memberId === m.id))
                  .map((m) => (
                    <div key={m.id} className={styles.memberChipAssigned}>
                      <span className={styles.memberChipAvatar} style={{ background: m.color ?? "#001D63" }}>
                        {m.initials ?? "?"}
                      </span>
                      <span className={styles.memberChipNameText}>{m.userName.split(" ")[0]}</span>
                      <button
                        className={styles.memberChipRemoveBtn}
                        onClick={() => save(() => togglePhaseAssignee({ phaseId: phase.id, memberId: m.id, planningId }))}
                        title={`Désassigner ${m.userName}`}
                        disabled={isPending}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                <button
                  className={styles.addMemberBtn}
                  onClick={() => { setShowAssigneeDropdown((v) => !v); setAssigneeSearch(""); }}
                  title="Ajouter un assigné"
                >
                  +
                </button>
              </div>

              {/* Dropdown de recherche */}
              {showAssigneeDropdown && (
                <div className={styles.assigneeDropdown}>
                  <input
                    type="text"
                    className={styles.assigneeSearchInput}
                    placeholder="Rechercher un membre…"
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    autoFocus
                  />
                  <div className={styles.assigneeDropdownList}>
                    {(() => {
                      const unassigned = data.members.filter(
                        (m) => !data.phaseAssignees.some((a) => a.phaseId === phase.id && a.memberId === m.id)
                      );
                      const filtered = unassigned.filter((m) =>
                        m.userName.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                        (m.initials ?? "").toLowerCase().includes(assigneeSearch.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return (
                          <div className={styles.assigneeDropdownEmpty}>
                            {unassigned.length === 0 ? "Tous assignés" : "Aucun résultat"}
                          </div>
                        );
                      }
                      return filtered.map((m) => (
                        <button
                          key={m.id}
                          className={styles.assigneeDropdownRow}
                          disabled={isPending}
                          onClick={() => {
                            save(() => togglePhaseAssignee({ phaseId: phase.id, memberId: m.id, planningId }));
                            setShowAssigneeDropdown(false);
                            setAssigneeSearch("");
                          }}
                        >
                          <span className={styles.assigneeDropdownAvatar} style={{ background: m.color ?? "#001D63" }}>
                            {m.initials ?? "?"}
                          </span>
                          <span>{m.userName}</span>
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}
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
                const prev = phase.note ?? null;
                save(() => updatePhaseNote({ phaseId: phase.id, planningId, note }));
                pushUndo({ type: "phase-note", phaseId: phase.id, planningId, prev });
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
          <Button variant="ghost" size="sm" style={{ opacity: 0.45, cursor: "not-allowed" }} title="Dépendances — disponible au Jalon 6">
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

    const lot = data.lots.find((l) => l.id === ms.lotId);
    const msTypeColor = data.milestoneTypes.find((t) => t.code === ms.type)?.color ?? "#7C3AED";
    const displayColor = ms.color ?? msTypeColor;

    // Optimistic patch for milestones — updates cache immediately, no 10s wait
    const patchMilestone = (patch: Partial<typeof ms>) => {
      qc.setQueryData<GanttData>(planningQueryKey(planningId), (old) => {
        if (!old) return old;
        return { ...old, milestones: old.milestones.map((m) => m.id === ms.id ? { ...m, ...patch } : m) };
      });
    };

    const MS_COLORS = [
      "#1E3A8A", "#312E81", "#65A30D", "#0D9488",
      "#7C3AED", "#DC2626", "#EA580C", "#0369A1",
    ];

    const LABEL_POS_OPTIONS: { value: "auto" | "above" | "below"; label: string }[] = [
      { value: "auto",  label: "Auto"    },
      { value: "above", label: "Dessus"  },
      { value: "below", label: "Dessous" },
    ];

    return (
      <div className={styles.panel} role="dialog" aria-label="Édition jalon">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.modeTag} style={{ background: displayColor + "22", color: displayColor }}>
              Jalon
            </span>
            {lot && <span className={styles.headerSub}>{lot.name}</span>}
          </div>
          <button className={styles.closeBtn} onClick={closeEdit} aria-label="Fermer">
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Label éditable */}
        <div className={styles.titleRow}>
          <input
            key={ms.id + "-label"}
            className={styles.title}
            style={{ border: "none", background: "none", width: "100%", outline: "none", padding: 0, fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit" }}
            defaultValue={ms.label}
            placeholder="Libellé du jalon"
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && val !== ms.label) {
                const prevLabel = ms.label;
                patchMilestone({ label: val });
                startTransition(async () => {
                  await updateMilestone({ milestoneId: ms.id, planningId, label: val });
                });
                pushUndo({ type: "milestone-update", milestoneId: ms.id, planningId, prev: { label: prevLabel } });
              }
            }}
          />
        </div>

        <div className={styles.body}>
          {/* Type */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Type</span>
            <select
              key={ms.id + "-type"}
              className={styles.select}
              defaultValue={ms.type}
              onChange={(e) => {
                startTransition(async () => {
                  await updateMilestone({ milestoneId: ms.id, planningId, type: e.target.value });
                });
              }}
            >
              {data.milestoneTypes.map((t) => (
                <option key={t.id} value={t.code}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Date</span>
            <input
              key={ms.id + "-date"}
              type="date"
              className={styles.dateInput}
              defaultValue={ms.date}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== ms.date) {
                  const prevDate = ms.date;
                  startTransition(async () => {
                    await updateMilestone({ milestoneId: ms.id, planningId, date: e.target.value });
                  });
                  pushUndo({ type: "milestone-update", milestoneId: ms.id, planningId, prev: { date: prevDate } });
                }
              }}
            />
          </div>

          {/* Position étiquette */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Étiquette</span>
            <div style={{ display: "flex", gap: 4 }}>
              {LABEL_POS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={styles.statusBtn}
                  style={ms.labelPos === opt.value
                    ? { background: displayColor + "22", color: displayColor, fontWeight: 700, borderColor: displayColor + "44" }
                    : {}}
                  onClick={() => {
                    patchMilestone({ labelPos: opt.value });
                    startTransition(async () => {
                      await updateMilestone({ milestoneId: ms.id, planningId, labelPos: opt.value });
                    });
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Couleur */}
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Couleur</span>
            <div>
              <div className={styles.palette}>
                {MS_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`${styles.swatch} ${displayColor === c ? styles.swatchActive : ""}`}
                    style={{ background: c }}
                    title={c}
                    onClick={() => {
                      const prevColor = ms.color ?? null;
                      startTransition(async () => {
                        await updateMilestone({ milestoneId: ms.id, planningId, color: c });
                      });
                      pushUndo({ type: "milestone-update", milestoneId: ms.id, planningId, prev: { color: prevColor } });
                    }}
                  />
                ))}
                <button
                  className={`${styles.swatchReset} ${!ms.color ? styles.swatchActive : ""}`}
                  title="Couleur du type"
                  onClick={() => {
                    const prevColor = ms.color ?? null;
                    startTransition(async () => {
                      await updateMilestone({ milestoneId: ms.id, planningId, color: null });
                    });
                    pushUndo({ type: "milestone-update", milestoneId: ms.id, planningId, prev: { color: prevColor } });
                  }}
                >
                  auto
                </button>
              </div>
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={displayColor}
                  onChange={(e) => {
                    startTransition(async () => {
                      await updateMilestone({ milestoneId: ms.id, planningId, color: e.target.value });
                    });
                  }}
                  onBlur={() => {
                    pushUndo({ type: "milestone-update", milestoneId: ms.id, planningId, prev: { color: ms.color ?? null } });
                  }}
                  title="Choisir une couleur"
                />
                <input
                  type="text"
                  className={styles.hexInput}
                  value={displayColor}
                  placeholder="#000000"
                  maxLength={7}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                      const prevColor = ms.color ?? null;
                      startTransition(async () => {
                        await updateMilestone({ milestoneId: ms.id, planningId, color: v });
                      });
                      pushUndo({ type: "milestone-update", milestoneId: ms.id, planningId, prev: { color: prevColor } });
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div className={styles.fieldRow} style={{ flexDirection: "column", gap: 4 }}>
            <span className={styles.fieldLabel}>Note</span>
            <textarea
              key={ms.id + "-note"}
              className={styles.textarea}
              defaultValue={ms.note ?? ""}
              placeholder="Note optionnelle…"
              rows={3}
              onBlur={(e) => {
                const val = e.target.value || null;
                const prevNote = ms.note ?? null;
                startTransition(async () => {
                  await updateMilestone({ milestoneId: ms.id, planningId, note: val });
                });
                pushUndo({ type: "milestone-update", milestoneId: ms.id, planningId, prev: { note: prevNote } });
              }}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={closeEdit}>Fermer</Button>
        </div>
      </div>
    );
  }

  // ──────────────────────────── MODE CREATE-LOT ────────────────────────────
  if (editTarget.kind === "create-lot") {
    const domain = data.domains.find((d) => d.id === editTarget.domainId);

    const handleCreate = () => {
      if (!createName.trim()) { setCreateError("Le nom du projet est requis."); return; }
      setCreateError(null);
      startTransition(async () => {
        try {
          await createLot({
            planningId,
            domainId: editTarget.domainId,
            name: createName.trim(),
            subtitle: createSubtitle.trim() || undefined,
          });
          closeEdit();
          router.refresh();
        } catch (e) {
          setCreateError(e instanceof Error ? e.message : "Erreur lors de la création.");
        }
      });
    };

    return (
      <div className={styles.panel} role="dialog" aria-label="Nouveau projet">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.modeTag} style={{ background: "#F0FDF4", color: "#16A34A" }}>+ Projet</span>
            {domain && (
              <span className={styles.domainChip} style={{ background: domain.bg, color: domain.strong }}>
                {domain.name}
              </span>
            )}
          </div>
          <button className={styles.closeBtn} onClick={closeEdit}><Icon name="close" size={14} /></button>
        </div>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Nouveau projet</h2>
        </div>
        <div className={styles.body}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Nom *</span>
            <input
              type="text"
              className={styles.input}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Nom du projet…"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Description</span>
            <input
              type="text"
              className={styles.input}
              value={createSubtitle}
              onChange={(e) => setCreateSubtitle(e.target.value)}
              placeholder="Sous-titre optionnel…"
            />
          </div>
          {createError && (
            <p style={{ color: "#DC2626", fontSize: 12, margin: 0 }}>{createError}</p>
          )}
        </div>
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={closeEdit}>Annuler</Button>
          <button
            className={styles.createSubmitBtn}
            onClick={handleCreate}
            disabled={isPending || !createName.trim()}
          >
            {isPending ? "Création…" : "Créer le projet"}
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────── MODE CREATE-PHASE ────────────────────────────
  if (editTarget.kind === "create-phase") {
    const lot = data.lots.find((l) => l.id === editTarget.lotId);
    const domain = lot ? data.domains.find((d) => d.id === lot.domainId) : null;

    const handleCreate = () => {
      if (!createPhaseStart || !createPhaseEnd) {
        setCreateError("Les dates de début et de fin sont requises."); return;
      }
      if (createPhaseStart > createPhaseEnd) {
        setCreateError("La date de début doit précéder la date de fin."); return;
      }
      setCreateError(null);
      startTransition(async () => {
        try {
          await createPhase({
            planningId,
            lotId: editTarget.lotId,
            type: createPhaseType,
            label: createPhaseLabel.trim() || undefined,
            startDate: createPhaseStart,
            endDate: createPhaseEnd,
          });
          closeEdit();
          router.refresh();
        } catch (e) {
          setCreateError(e instanceof Error ? e.message : "Erreur lors de la création.");
        }
      });
    };

    return (
      <div className={styles.panel} role="dialog" aria-label="Nouvelle phase">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.modeTag} style={{ background: "#EEF2FF", color: "#4338CA" }}>+ Phase</span>
            {domain && (
              <span className={styles.domainChip} style={{ background: domain.bg, color: domain.strong }}>
                {domain.name}
              </span>
            )}
          </div>
          <button className={styles.closeBtn} onClick={closeEdit}><Icon name="close" size={14} /></button>
        </div>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{lot?.name ?? "Nouvelle phase"}</h2>
          {lot?.subtitle && <p className={styles.lotSubtitle}>{lot.subtitle}</p>}
        </div>
        <div className={styles.body}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Type</span>
            <select
              className={styles.select}
              value={createPhaseType}
              onChange={(e) => setCreatePhaseType(e.target.value)}
            >
              {Object.entries(PHASE_TYPE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Libellé</span>
            <input
              type="text"
              className={styles.input}
              value={createPhaseLabel}
              onChange={(e) => setCreatePhaseLabel(e.target.value)}
              placeholder="Libellé optionnel…"
            />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Début *</span>
            <input
              type="date"
              className={styles.dateInput}
              value={createPhaseStart}
              onChange={(e) => setCreatePhaseStart(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Fin *</span>
            <input
              type="date"
              className={styles.dateInput}
              value={createPhaseEnd}
              onChange={(e) => setCreatePhaseEnd(e.target.value)}
            />
          </div>
          {createError && (
            <p style={{ color: "#DC2626", fontSize: 12, margin: 0 }}>{createError}</p>
          )}
        </div>
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={closeEdit}>Annuler</Button>
          <button
            className={styles.createSubmitBtn}
            onClick={handleCreate}
            disabled={isPending || !createPhaseStart || !createPhaseEnd}
          >
            {isPending ? "Création…" : "Créer la phase"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default EditPanel;
