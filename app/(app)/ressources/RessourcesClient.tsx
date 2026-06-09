"use client";

import { useState, useTransition } from "react";
import type { GanttData } from "@/lib/db/queries";
import { togglePhaseAssignee } from "@/lib/actions/planning";
import styles from "./Ressources.module.css";

interface Props {
  data: GanttData;
}

const PHASE_TYPE_LABELS: Record<string, string> = {
  cadrage: "Cadrage",
  dev: "Dév.",
  recette: "Rec.",
  formation: "For.",
  custom: "Custom",
};

function fmt(d: string) {
  const parts = d.split("-");
  return `${parts[2]}/${parts[1]}`;
}

export function RessourcesClient({ data }: Props) {
  const { planning, domains, lots, phases, members } = data;

  // Local copy of assignees for optimistic updates
  const [localAssignees, setLocalAssignees] = useState<{ phaseId: string; memberId: string }[]>(
    () => [...data.phaseAssignees]
  );

  // Which member attribution modal is open
  const [modalMemberId, setModalMemberId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── Toggle a single phase for a member ────────────────────────────
  const handleTogglePhase = (phaseId: string, memberId: string) => {
    const isAssigned = localAssignees.some((a) => a.phaseId === phaseId && a.memberId === memberId);
    // Optimistic update
    if (isAssigned) {
      setLocalAssignees((prev) => prev.filter((a) => !(a.phaseId === phaseId && a.memberId === memberId)));
    } else {
      setLocalAssignees((prev) => [...prev, { phaseId, memberId }]);
    }
    // Server action
    startTransition(async () => {
      await togglePhaseAssignee({ phaseId, memberId, planningId: planning.id });
    });
  };

  // ── Toggle all phases in a lot for a member ────────────────────────
  const handleToggleLot = (lotId: string, memberId: string) => {
    const lotPhases = phases.filter((p) => p.lotId === lotId);
    const allAssigned = lotPhases.every((p) =>
      localAssignees.some((a) => a.phaseId === p.id && a.memberId === memberId)
    );

    if (allAssigned) {
      // Unassign all phases of this lot
      setLocalAssignees((prev) =>
        prev.filter((a) => !(a.memberId === memberId && lotPhases.some((p) => p.id === a.phaseId)))
      );
      startTransition(async () => {
        for (const p of lotPhases) {
          await togglePhaseAssignee({ phaseId: p.id, memberId, planningId: planning.id });
        }
      });
    } else {
      // Assign missing phases
      const missing = lotPhases.filter(
        (p) => !localAssignees.some((a) => a.phaseId === p.id && a.memberId === memberId)
      );
      setLocalAssignees((prev) => [...prev, ...missing.map((p) => ({ phaseId: p.id, memberId }))]);
      startTransition(async () => {
        for (const p of missing) {
          await togglePhaseAssignee({ phaseId: p.id, memberId, planningId: planning.id });
        }
      });
    }
  };

  // ── Compute member rows from localAssignees ────────────────────────
  const memberRows = members.map((member) => {
    const assignedPhaseIds = new Set(
      localAssignees.filter((a) => a.memberId === member.id).map((a) => a.phaseId)
    );
    const assigned = phases.filter((p) => assignedPhaseIds.has(p.id));

    const byDomain = domains
      .map((domain) => {
        const domLotIds = new Set(lots.filter((l) => l.domainId === domain.id).map((l) => l.id));
        const domPhases = assigned
          .filter((p) => domLotIds.has(p.lotId))
          .map((p) => {
            const lot = lots.find((l) => l.id === p.lotId)!;
            return { phase: p, lot };
          });
        return { domain, phases: domPhases };
      })
      .filter((d) => d.phases.length > 0);

    return { member, total: assigned.length, byDomain };
  });

  const sorted = [...memberRows].sort((a, b) => b.total - a.total);

  const assignedPhaseIds = new Set(localAssignees.map((a) => a.phaseId));
  const unassigned = phases.filter((p) => !assignedPhaseIds.has(p.id));

  const modalMember = modalMemberId ? members.find((m) => m.id === modalMemberId) : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Ressources</h1>
        <span className={styles.subtitle}>
          {planning.name} · {members.length} membre{members.length > 1 ? "s" : ""}
        </span>
      </header>

      {/* Member cards */}
      <div className={styles.memberGrid}>
        {sorted.map(({ member, total, byDomain }) => (
          <div key={member.id} className={styles.memberCard}>
            {/* Member header */}
            <div className={styles.memberHeader}>
              <div
                className={styles.avatar}
                style={{ background: member.color ?? "#001D63" }}
              >
                {(member.initials ?? member.userName.slice(0, 2)).toUpperCase()}
              </div>
              <div className={styles.memberInfo}>
                <span className={styles.memberName}>{member.userName}</span>
                <span className={styles.memberEmail}>{member.userEmail}</span>
              </div>
              <div className={styles.memberStats}>
                <span className={styles.memberCount}>{total}</span>
                <span className={styles.memberCountLabel}>phases</span>
              </div>
              <button
                className={styles.attributeBtn}
                onClick={() => setModalMemberId(member.id)}
                title={`Attribuer des phases à ${member.userName}`}
              >
                Attribuer
              </button>
            </div>

            {/* Phases by domain */}
            {byDomain.length > 0 ? (
              <div className={styles.domainGroups}>
                {byDomain.map(({ domain, phases: dPhases }) => (
                  <div key={domain.id} className={styles.domainGroup}>
                    <div
                      className={styles.domainGroupHeader}
                      style={{
                        background: `var(--d-${domain.code}-bg)`,
                        color: `var(--d-${domain.code}-strong)`,
                      }}
                    >
                      {domain.code.toUpperCase()} — {domain.name}
                      <span className={styles.domainGroupCount}>{dPhases.length}</span>
                    </div>
                    <div className={styles.phaseList}>
                      {dPhases.map(({ phase, lot }) => (
                        <div key={phase.id} className={styles.phaseRow}>
                          <span
                            className={styles.phaseTypePill}
                            style={{ background: phase.color ?? `var(--d-${domain.code}-phase)` }}
                          >
                            {PHASE_TYPE_LABELS[phase.type] ?? phase.type}
                          </span>
                          <span className={styles.phaseLotName}>{lot.name}</span>
                          <span className={styles.phaseDates}>
                            {fmt(phase.startDate)} → {fmt(phase.endDate)}
                          </span>
                          {phase.status && (
                            <span
                              className={styles.phaseStatus}
                              style={{
                                background: `var(--st-${phase.status}-bg)`,
                                color: `var(--st-${phase.status}-c)`,
                              }}
                            >
                              {phase.status}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noAssign}>Aucune phase assignée.</p>
            )}
          </div>
        ))}
      </div>

      {/* Unassigned phases summary */}
      {unassigned.length > 0 && (
        <section className={styles.unassignedSection}>
          <h2 className={styles.unassignedTitle}>
            Phases non assignées
            <span className={styles.unassignedBadge}>{unassigned.length}</span>
          </h2>
          <div className={styles.unassignedGrid}>
            {unassigned.map((phase) => {
              const lot = lots.find((l) => l.id === phase.lotId);
              const domain = lot ? domains.find((d) => d.id === lot.domainId) : null;
              return (
                <div key={phase.id} className={styles.unassignedRow}>
                  {domain && (
                    <span
                      className={styles.itemDomainChip}
                      style={{
                        background: `var(--d-${domain.code}-bg)`,
                        color: `var(--d-${domain.code}-strong)`,
                      }}
                    >
                      {domain.code.toUpperCase()}
                    </span>
                  )}
                  <span className={styles.unassignedLot}>{lot?.name ?? "—"}</span>
                  <span className={styles.unassignedPhase}>{phase.label ?? phase.type}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Attribution modal */}
      {modalMember && (
        <div className={styles.modalOverlay} onClick={() => setModalMemberId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className={styles.modalHeader}>
              <div
                className={styles.modalAvatar}
                style={{ background: modalMember.color ?? "#001D63" }}
              >
                {(modalMember.initials ?? modalMember.userName.slice(0, 2)).toUpperCase()}
              </div>
              <div className={styles.modalHeaderInfo}>
                <span className={styles.modalHeaderName}>{modalMember.userName}</span>
                <span className={styles.modalHeaderSub}>Attribution des phases</span>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setModalMemberId(null)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className={styles.modalBody}>
              {domains.map((domain) => {
                const domainLots = lots.filter((l) => l.domainId === domain.id);
                const domainPhases = phases.filter((p) =>
                  domainLots.some((l) => l.id === p.lotId)
                );
                if (domainPhases.length === 0) return null;

                return (
                  <div key={domain.id} className={styles.modalDomain}>
                    <div
                      className={styles.modalDomainHeader}
                      style={{
                        background: `var(--d-${domain.code}-bg)`,
                        color: `var(--d-${domain.code}-strong)`,
                      }}
                    >
                      {domain.code.toUpperCase()} — {domain.name}
                    </div>

                    {domainLots.map((lot) => {
                      const lotPhases = phases.filter((p) => p.lotId === lot.id);
                      if (lotPhases.length === 0) return null;

                      const allLotAssigned = lotPhases.every((p) =>
                        localAssignees.some((a) => a.phaseId === p.id && a.memberId === modalMember.id)
                      );
                      const someLotAssigned = lotPhases.some((p) =>
                        localAssignees.some((a) => a.phaseId === p.id && a.memberId === modalMember.id)
                      );

                      return (
                        <div key={lot.id} className={styles.modalLot}>
                          <div className={styles.modalLotHeader}>
                            <span className={styles.modalLotName}>{lot.name}</span>
                            <span className={styles.modalLotCount}>{lotPhases.length} phase{lotPhases.length > 1 ? "s" : ""}</span>
                            <button
                              className={`${styles.assignLotBtn} ${allLotAssigned ? styles.assignLotBtnActive : someLotAssigned ? styles.assignLotBtnPartial : ""}`}
                              onClick={() => handleToggleLot(lot.id, modalMember.id)}
                            >
                              {allLotAssigned ? "Tout retirer" : "Tout le lot"}
                            </button>
                          </div>

                          <div className={styles.modalPhaseList}>
                            {lotPhases.map((phase) => {
                              const isAssigned = localAssignees.some(
                                (a) => a.phaseId === phase.id && a.memberId === modalMember.id
                              );
                              return (
                                <label key={phase.id} className={`${styles.modalPhaseRow} ${isAssigned ? styles.modalPhaseRowAssigned : ""}`}>
                                  <input
                                    type="checkbox"
                                    className={styles.modalCheckbox}
                                    checked={isAssigned}
                                    onChange={() => handleTogglePhase(phase.id, modalMember.id)}
                                  />
                                  <span
                                    className={styles.modalPhaseTypePill}
                                    style={{ background: phase.color ?? `var(--d-${domain.code}-phase, #6B7280)` }}
                                  >
                                    {PHASE_TYPE_LABELS[phase.type] ?? phase.type}
                                  </span>
                                  <span className={styles.modalPhaseName}>{phase.label ?? PHASE_TYPE_LABELS[phase.type] ?? phase.type}</span>
                                  <span className={styles.modalPhaseDates}>
                                    {fmt(phase.startDate)} → {fmt(phase.endDate)}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Modal footer */}
            <div className={styles.modalFooter}>
              <span className={styles.modalCount}>
                {localAssignees.filter((a) => a.memberId === modalMember.id).length} phase{localAssignees.filter((a) => a.memberId === modalMember.id).length > 1 ? "s" : ""} assignée{localAssignees.filter((a) => a.memberId === modalMember.id).length > 1 ? "s" : ""}
              </span>
              <button className={styles.modalCloseFooterBtn} onClick={() => setModalMemberId(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
