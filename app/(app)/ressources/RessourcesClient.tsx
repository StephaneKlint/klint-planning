"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GanttData, MemberRow, ExistingUserRow } from "@/lib/db/queries";
import { togglePhaseAssignee } from "@/lib/actions/planning";
import { addMember, updateMember, removeMember } from "@/lib/actions/members";
import { updateMemberPermission } from "@/lib/actions/settings";
import { useGanttStore } from "@/store/ganttStore";
import styles from "./Ressources.module.css";

interface Props {
  data: GanttData;
  existingUsers: ExistingUserRow[];
}

const PHASE_TYPE_LABELS: Record<string, string> = {
  cadrage: "Cadrage",
  dev: "Dév.",
  recette: "Rec.",
  formation: "For.",
  custom: "Custom",
};

const MEMBER_COLORS = [
  "#001D63", "#3B82F6", "#16A34A", "#DC2626",
  "#9069E0", "#EA580C", "#0D9488", "#E8568A",
];

function fmt(d: string) {
  const parts = d.split("-");
  return `${parts[2]}/${parts[1]}`;
}

export function RessourcesClient({ data, existingUsers }: Props) {
  const { planning, domains, lots, phases } = data;
  const router = useRouter();
  const { pushUndo } = useGanttStore();

  // Local copy of assignees for optimistic updates
  const [localAssignees, setLocalAssignees] = useState<{ phaseId: string; memberId: string }[]>(
    () => [...data.phaseAssignees]
  );

  // Track optimistically-deleted members
  const [deletedMemberIds, setDeletedMemberIds] = useState<Set<string>>(new Set());

  // Which member attribution modal is open
  const [modalMemberId, setModalMemberId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── Member CRUD modal state ────────────────────────────────────────────────
  const [memberModal, setMemberModal] = useState<{ type: "add" | "edit"; member?: MemberRow } | null>(null);
  const [memberFormFirstName, setMemberFormFirstName] = useState("");
  const [memberFormLastName, setMemberFormLastName] = useState("");
  const [memberFormName, setMemberFormName] = useState("");
  const [memberFormEmail, setMemberFormEmail] = useState("");
  const [memberFormInitials, setMemberFormInitials] = useState("");
  const [memberFormColor, setMemberFormColor] = useState("#001D63");
  const [memberFormError, setMemberFormError] = useState<string | null>(null);
  const [memberFormPending, setMemberFormPending] = useState(false);
  // Picker d'utilisateurs existants
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerMode, setPickerMode] = useState<"picker" | "new">("picker");

  // Effective members list (filters out optimistically deleted)
  const effectiveMembers = data.members.filter((m) => !deletedMemberIds.has(m.id));

  // ── Attribution toggles ────────────────────────────────────────────────────
  const handleTogglePhase = (phaseId: string, memberId: string) => {
    const isAssigned = localAssignees.some((a) => a.phaseId === phaseId && a.memberId === memberId);
    if (isAssigned) {
      setLocalAssignees((prev) => prev.filter((a) => !(a.phaseId === phaseId && a.memberId === memberId)));
    } else {
      setLocalAssignees((prev) => [...prev, { phaseId, memberId }]);
    }
    startTransition(async () => {
      await togglePhaseAssignee({ phaseId, memberId, planningId: planning.id });
    });
  };

  const handleToggleLot = (lotId: string, memberId: string) => {
    const lotPhases = phases.filter((p) => p.lotId === lotId);
    const allAssigned = lotPhases.every((p) =>
      localAssignees.some((a) => a.phaseId === p.id && a.memberId === memberId)
    );

    if (allAssigned) {
      setLocalAssignees((prev) =>
        prev.filter((a) => !(a.memberId === memberId && lotPhases.some((p) => p.id === a.phaseId)))
      );
      startTransition(async () => {
        for (const p of lotPhases) {
          await togglePhaseAssignee({ phaseId: p.id, memberId, planningId: planning.id });
        }
      });
    } else {
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

  // ── Member CRUD ────────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setMemberFormFirstName("");
    setMemberFormLastName("");
    setMemberFormName("");
    setMemberFormEmail("");
    setMemberFormInitials("");
    setMemberFormColor(MEMBER_COLORS[effectiveMembers.length % MEMBER_COLORS.length]);
    setMemberFormError(null);
    setPickerSearch("");
    setPickerMode(existingUsers.length > 0 ? "picker" : "new");
    setMemberModal({ type: "add" });
  };

  // Pré-remplit le formulaire depuis un utilisateur existant
  const handlePickExistingUser = (user: ExistingUserRow) => {
    const parts = (user.name ?? "").trim().split(" ");
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ");
    setMemberFormFirstName(firstName);
    setMemberFormLastName(lastName);
    setMemberFormName(user.name ?? "");
    setMemberFormEmail(user.email);
    const autoInitials = (firstName.slice(0, 1) + lastName.slice(0, 1)).toUpperCase() || user.email.slice(0, 2).toUpperCase();
    setMemberFormInitials(user.initials ?? autoInitials);
    setMemberFormColor(user.color ?? MEMBER_COLORS[effectiveMembers.length % MEMBER_COLORS.length]);
    setMemberFormError(null);
    setPickerMode("new"); // bascule sur le formulaire pré-rempli
  };

  const handleOpenEdit = (member: MemberRow) => {
    const parts = member.userName.trim().split(" ");
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ");
    setMemberFormFirstName(firstName);
    setMemberFormLastName(lastName);
    setMemberFormName(member.userName);
    setMemberFormEmail(member.userEmail);
    setMemberFormInitials(member.initials ?? "");
    setMemberFormColor(member.color ?? "#001D63");
    setMemberFormError(null);
    setMemberModal({ type: "edit", member });
  };

  const handleDelete = async (memberId: string) => {
    if (!window.confirm("Supprimer ce responsable du planning ? Ses attributions de phases seront supprimées.")) return;
    // Capture state for undo before removal
    const member = effectiveMembers.find((m) => m.id === memberId);
    const phaseIds = localAssignees.filter((a) => a.memberId === memberId).map((a) => a.phaseId);
    setDeletedMemberIds((prev) => new Set([...prev, memberId]));
    setLocalAssignees((prev) => prev.filter((a) => a.memberId !== memberId));
    try {
      await removeMember(memberId, planning.id);
      if (member) {
        pushUndo({
          type: "member-delete",
          userId: member.userId,
          planningId: planning.id,
          initials: member.initials,
          color: member.color,
          permission: member.permission,
          phaseIds,
        });
      }
      router.refresh();
    } catch {
      // Revert optimistic delete on error
      setDeletedMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
      router.refresh();
    }
  };

  const handleSaveMember = async () => {
    if (!memberFormName.trim()) {
      setMemberFormError("Le nom est requis."); return;
    }
    if (!memberFormInitials.trim()) {
      setMemberFormError("Les initiales sont requises."); return;
    }
    if (memberModal?.type === "add" && !memberFormEmail.trim()) {
      setMemberFormError("L'email est requis."); return;
    }
    setMemberFormPending(true);
    setMemberFormError(null);
    try {
      if (memberModal?.type === "add") {
        await addMember({
          planningId: planning.id,
          name: memberFormName.trim(),
          email: memberFormEmail.trim(),
          initials: memberFormInitials.trim().toUpperCase().slice(0, 3),
          color: memberFormColor,
        });
      } else if (memberModal?.type === "edit" && memberModal.member) {
        await updateMember({
          memberId: memberModal.member.id,
          planningId: planning.id,
          name: memberFormName.trim(),
          initials: memberFormInitials.trim().toUpperCase().slice(0, 3),
          color: memberFormColor,
        });
      }
      setMemberModal(null);
      router.refresh();
    } catch (e) {
      setMemberFormError(e instanceof Error ? e.message : "Une erreur s'est produite.");
    } finally {
      setMemberFormPending(false);
    }
  };

  // ── Compute member rows ────────────────────────────────────────────────────
  const memberRows = effectiveMembers.map((member) => {
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

  const modalMember = modalMemberId ? effectiveMembers.find((m) => m.id === modalMemberId) : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Ressources</h1>
        <span className={styles.subtitle}>
          {planning.name} · {effectiveMembers.length} membre{effectiveMembers.length > 1 ? "s" : ""}
        </span>
        <button className={styles.addMemberHeaderBtn} onClick={handleOpenAdd}>
          + Nouveau responsable
        </button>
      </header>

      {/* Member cards */}
      <div className={styles.memberGrid}>
        {sorted.map(({ member, total, byDomain }) => (
          <div key={member.id} className={styles.memberCard}>
            {/* Member header */}
            <div className={styles.memberHeader}>
              <div className={styles.avatar} style={{ background: member.color ?? "#001D63" }}>
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
              <div className={styles.memberActions}>
                {/* Droits d'accès */}
                <select
                  defaultValue={member.permission}
                  onChange={async (e) => {
                    await updateMemberPermission({
                      memberId: member.id,
                      planningId: planning.id,
                      permission: e.target.value as "owner" | "editor" | "viewer",
                    });
                  }}
                  title="Droit d'accès au planning"
                  style={{ fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--klint-line, #E6E8EE)", background: "var(--klint-paper, #F6F7FB)", color: "var(--klint-navy, #001036)", cursor: "pointer", fontFamily: "var(--font-display, system-ui)", fontWeight: 600 }}
                >
                  <option value="owner">Propriétaire</option>
                  <option value="editor">Éditeur</option>
                  <option value="viewer">Lecteur</option>
                </select>
                <button
                  className={styles.attributeBtn}
                  onClick={() => setModalMemberId(member.id)}
                  title={`Attribuer des phases à ${member.userName}`}
                >
                  Attribuer
                </button>
                <button
                  className={styles.memberEditBtn}
                  onClick={() => handleOpenEdit(member)}
                  title="Modifier ce responsable"
                >
                  ✎
                </button>
                <button
                  className={styles.memberDeleteBtn}
                  onClick={() => handleDelete(member.id)}
                  title="Supprimer ce responsable"
                >
                  ×
                </button>
              </div>
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

        {effectiveMembers.length === 0 && (
          <div className={styles.noMembersEmpty}>
            <p>Aucun responsable. Cliquez sur &quot;+ Nouveau responsable&quot; pour commencer.</p>
          </div>
        )}
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
            <div className={styles.modalHeader}>
              <div className={styles.modalAvatar} style={{ background: modalMember.color ?? "#001D63" }}>
                {(modalMember.initials ?? modalMember.userName.slice(0, 2)).toUpperCase()}
              </div>
              <div className={styles.modalHeaderInfo}>
                <span className={styles.modalHeaderName}>{modalMember.userName}</span>
                <span className={styles.modalHeaderSub}>Attribution des phases</span>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setModalMemberId(null)} aria-label="Fermer">×</button>
            </div>

            <div className={styles.modalBody}>
              {domains.map((domain) => {
                const domainLots = lots.filter((l) => l.domainId === domain.id);
                const domainPhases = phases.filter((p) => domainLots.some((l) => l.id === p.lotId));
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

            <div className={styles.modalFooter}>
              <span className={styles.modalCount}>
                {localAssignees.filter((a) => a.memberId === modalMember.id).length} phase{localAssignees.filter((a) => a.memberId === modalMember.id).length > 1 ? "s" : ""} assignée{localAssignees.filter((a) => a.memberId === modalMember.id).length > 1 ? "s" : ""}
              </span>
              <button className={styles.modalCloseFooterBtn} onClick={() => setModalMemberId(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Member add/edit modal */}
      {memberModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => !memberFormPending && setMemberModal(null)}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.modalHeader}>
              <div
                className={styles.modalAvatar}
                style={{ background: memberFormColor }}
              >
                {memberFormInitials.slice(0, 3).toUpperCase() || "?"}
              </div>
              <div className={styles.modalHeaderInfo}>
                <span className={styles.modalHeaderName}>
                  {memberModal.type === "add" ? "Nouveau responsable" : "Modifier le responsable"}
                </span>
                <span className={styles.modalHeaderSub}>{planning.name}</span>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => !memberFormPending && setMemberModal(null)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {/* ── Picker responsables existants (mode "add" seulement) ── */}
            {memberModal.type === "add" && existingUsers.length > 0 && (
              <div className={styles.pickerSection}>
                {/* Tabs : Picker / Nouveau */}
                <div className={styles.pickerTabs}>
                  <button
                    className={`${styles.pickerTab} ${pickerMode === "picker" ? styles.pickerTabActive : ""}`}
                    onClick={() => setPickerMode("picker")}
                    type="button"
                  >
                    Responsables existants
                    <span className={styles.pickerBadge}>{existingUsers.length}</span>
                  </button>
                  <button
                    className={`${styles.pickerTab} ${pickerMode === "new" ? styles.pickerTabActive : ""}`}
                    onClick={() => setPickerMode("new")}
                    type="button"
                  >
                    Nouveau
                  </button>
                </div>

                {pickerMode === "picker" && (
                  <div className={styles.pickerBody}>
                    <input
                      type="text"
                      className={styles.pickerSearch}
                      placeholder="Rechercher par nom ou email…"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      autoFocus
                    />
                    <div className={styles.pickerList}>
                      {existingUsers
                        .filter((u) => {
                          const q = pickerSearch.toLowerCase();
                          return !q ||
                            (u.name ?? "").toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q);
                        })
                        .map((u) => (
                          <button
                            key={u.id}
                            className={styles.pickerRow}
                            onClick={() => handlePickExistingUser(u)}
                            type="button"
                          >
                            <span
                              className={styles.pickerAvatar}
                              style={{ background: u.color ?? "#001D63" }}
                            >
                              {(u.initials ?? (u.name ?? u.email).slice(0, 2)).toUpperCase()}
                            </span>
                            <span className={styles.pickerInfo}>
                              <span className={styles.pickerName}>{u.name ?? "—"}</span>
                              <span className={styles.pickerEmail}>{u.email}</span>
                            </span>
                          </button>
                        ))}
                      {existingUsers.filter((u) => {
                        const q = pickerSearch.toLowerCase();
                        return !q || (u.name ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                      }).length === 0 && (
                        <p className={styles.pickerEmpty}>Aucun résultat pour « {pickerSearch} »</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form body */}
            {(memberModal.type === "edit" || pickerMode === "new") && (
            <div className={styles.memberFormBody}>
              {/* Prénom + Nom côte à côte */}
              <div className={styles.memberFormRow}>
                <label className={styles.memberFormLabel}>Prénom *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className={styles.memberFormInput}
                    value={memberFormFirstName}
                    onChange={(e) => {
                      const fn = e.target.value;
                      setMemberFormFirstName(fn);
                      setMemberFormName(`${fn.trim()} ${memberFormLastName.trim()}`.trim());
                    }}
                    placeholder="Prénom"
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    className={styles.memberFormInput}
                    value={memberFormLastName}
                    onChange={(e) => {
                      const ln = e.target.value;
                      setMemberFormLastName(ln);
                      setMemberFormName(`${memberFormFirstName.trim()} ${ln.trim()}`.trim());
                    }}
                    placeholder="Nom"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              {/* Nom complet calculé (lecture seule, pour info) */}
              {memberFormName && (
                <div className={styles.memberFormRow} style={{ marginTop: -4 }}>
                  <label className={styles.memberFormLabel}>Nom complet</label>
                  <span style={{ fontSize: "var(--text-13)", color: "var(--klint-navy)", fontWeight: "var(--weight-medium)" }}>
                    {memberFormName}
                  </span>
                </div>
              )}
              {memberModal.type === "add" ? (
                <div className={styles.memberFormRow}>
                  <label className={styles.memberFormLabel}>Email *</label>
                  <input
                    type="email"
                    className={styles.memberFormInput}
                    value={memberFormEmail}
                    onChange={(e) => setMemberFormEmail(e.target.value)}
                    placeholder="prenom.nom@exemple.com"
                  />
                </div>
              ) : (
                <div className={styles.memberFormRow}>
                  <label className={styles.memberFormLabel}>Email</label>
                  <input
                    type="email"
                    className={styles.memberFormInput}
                    value={memberFormEmail}
                    readOnly
                    style={{ background: "var(--klint-paper, #F8FAFC)", color: "#6b7280", cursor: "default" }}
                    title="L'email ne peut pas être modifié"
                  />
                </div>
              )}
              <div className={styles.memberFormRow}>
                <label className={styles.memberFormLabel}>Initiales *</label>
                <input
                  type="text"
                  className={styles.memberFormInput}
                  value={memberFormInitials}
                  onChange={(e) => setMemberFormInitials(e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="AB"
                  maxLength={3}
                  style={{ textTransform: "uppercase", maxWidth: 72 }}
                />
              </div>
              <div className={styles.memberFormRow}>
                <label className={styles.memberFormLabel}>Couleur</label>
                <div className={styles.memberFormColorRow}>
                  <input
                    type="color"
                    value={memberFormColor}
                    onChange={(e) => setMemberFormColor(e.target.value)}
                    style={{ width: 36, height: 36, borderRadius: 8, border: "2px solid var(--klint-line)", cursor: "pointer", padding: 2, background: "none" }}
                  />
                  <div className={styles.memberFormColorPalette}>
                    {MEMBER_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setMemberFormColor(c)}
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: c, border: memberFormColor === c ? "2px solid #001036" : "2px solid transparent",
                          cursor: "pointer", padding: 0, flexShrink: 0,
                        }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {memberFormError && (
                <p className={styles.memberFormError}>{memberFormError}</p>
              )}
            </div>
            )}

            {/* Footer */}
            <div className={styles.modalFooter}>
              <button
                className={styles.modalCloseFooterBtn}
                onClick={() => setMemberModal(null)}
                disabled={memberFormPending}
              >
                Annuler
              </button>
              <button
                className={styles.memberFormSaveBtn}
                onClick={handleSaveMember}
                disabled={memberFormPending}
              >
                {memberFormPending
                  ? "Enregistrement…"
                  : memberModal.type === "add" ? "Ajouter" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
