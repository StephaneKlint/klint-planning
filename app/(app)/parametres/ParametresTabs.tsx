"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./Parametres.module.css";
import type { GanttData, UserRole } from "@/lib/db/queries";
import type { AppSettings, PermissionMatrix } from "@/lib/actions/appSettings";
import { savePermissions } from "@/lib/actions/appSettings";
import {
  addPhaseType, deletePhaseType, updatePhaseType,
  addMilestoneType, deleteMilestoneType, updateMilestoneType,
  updateDomainCadence, updatePlanningSettings,
} from "@/lib/actions/settings";
import { saveAppLogo, saveAppFavicon } from "@/lib/actions/appSettings";
import { seedHolidays, createClosurePeriod, updateClosurePeriod, deleteClosurePeriod } from "@/lib/actions/closurePeriods";
import { changePassword } from "@/lib/actions/authActions";
import { setTemplateFlag } from "@/lib/actions/plannings";
import type { ClosurePeriodRow, ExistingUserRow, ActivityEntry, ConnectionLogRow, DirectoryContact } from "@/lib/db/queries";
import { addMember, removeMember, disableContact, enableContact, assignExistingContactToPlanning, updateContact, deleteContact } from "@/lib/actions/members";
import { generateInvitationLink } from "@/lib/actions/invitations";

type Tab = "general" | "cadence" | "phases" | "jalons" | "statuts" | "apparence" | "calendrier" | "securite" | "répertoire" | "historique" | "droits";

const ALL_TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: "general",    label: "Général" },
  { id: "cadence",    label: "Cadence" },
  { id: "phases",     label: "Types de phases" },
  { id: "jalons",     label: "Types de jalons" },
  { id: "statuts",    label: "Statuts" },
  { id: "répertoire", label: "Répertoire" },
  { id: "historique", label: "Historique" },
  { id: "apparence",  label: "Apparence" },
  { id: "calendrier", label: "Calendrier" },
  { id: "securite",   label: "Sécurité" },
  { id: "droits",     label: "Rôles & droits", adminOnly: true },
];

function buildVisibleTabs(userRole: UserRole, permissions: PermissionMatrix) {
  if (userRole === "admin") return ALL_TABS;
  return ALL_TABS.filter((t) => {
    if (t.adminOnly) return false;
    const key = `tab_${t.id}` as keyof PermissionMatrix["user"];
    return permissions.user[key] ?? false;
  });
}

const VERB_LABELS: Record<string, string> = {
  status_changed:      "Statut modifié",
  progress_updated:    "Avancement mis à jour",
  moved:               "Déplacé",
  bulk_status_changed: "Statut modifié (masse)",
  created:             "Créé",
  deleted:             "Supprimé",
  restored:            "Restauré",
  archived:            "Archivé",
  imported:            "Importé",
  updated:             "Modifié",
};

function fmtDatetime(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "";
  const cp1 = code.toUpperCase().charCodeAt(0) - 65 + 0x1F1E6;
  const cp2 = code.toUpperCase().charCodeAt(1) - 65 + 0x1F1E6;
  return String.fromCodePoint(cp1) + String.fromCodePoint(cp2);
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const PRESET_COLORS = [
  "#1E3A8A","#312E81","#65A30D","#0D9488","#7C3AED",
  "#DC2626","#EA580C","#0369A1","#374151","#BE185D",
];


interface ParametresTabsProps {
  data: GanttData;
  appCfg: AppSettings;
  userRole?: UserRole;
  permissions?: PermissionMatrix;
  existingUsers?: ExistingUserRow[];
  activityEntries?: ActivityEntry[];
  connLogs?: ConnectionLogRow[];
  directoryContacts?: DirectoryContact[];
}

export function ParametresTabs({ data, appCfg, userRole = "admin", permissions = { user: { tab_general: true, tab_cadence: true, tab_phases: true, tab_jalons: true, tab_statuts: true, "tab_répertoire": true, tab_historique: true, tab_apparence: true, tab_calendrier: true, tab_securite: true, create_planning: true, export: true, share: true } }, existingUsers = [], activityEntries = [], connLogs = [], directoryContacts = [] }: ParametresTabsProps) {
  const router = useRouter();
  const visibleTabs = buildVisibleTabs(userRole, permissions);
  const [active, setActive] = useState<Tab>(() => visibleTabs[0]?.id ?? "general");
  const [isPending, startTransition] = useTransition();
  const { planning, settings, domains, phaseTypes, milestoneTypes, statuses } = data;

  // ── Calendrier state ────────────────────────────────────────────────────
  const [calPeriods, setCalPeriods] = useState<ClosurePeriodRow[]>(data.closurePeriods ?? []);
  const [calLabel, setCalLabel] = useState("");
  const [calStart, setCalStart] = useState("");
  const [calEnd, setCalEnd] = useState("");
  const [calColor, setCalColor] = useState("#FED7AA");
  const [calSeedMsg, setCalSeedMsg] = useState<string | null>(null);

  const CLOSURE_COLORS = [
    { hex: "#FEF3C7", label: "Jaune pâle" },
    { hex: "#FED7AA", label: "Orange pâle" },
    { hex: "#FECACA", label: "Rose pâle" },
    { hex: "#D1FAE5", label: "Vert pâle" },
    { hex: "#DBEAFE", label: "Bleu pâle" },
    { hex: "#EDE9FE", label: "Violet pâle" },
  ];

  // ── Logo upload state ──────────────────────────────────────────────────
  const logoInputRef    = useRef<HTMLInputElement>(null);
  const [logoPreview,   setLogoPreview]   = useState<string | null>(appCfg.logoDataUrl ?? null);
  const [logoAlt,       setLogoAlt]       = useState(appCfg.logoAlt || "Klint");
  const [logoUnsaved,   setLogoUnsaved]   = useState(false);   // fichier sélectionné mais pas encore enregistré
  const [logoSaving,    setLogoSaving]    = useState(false);
  const [logoMsg,       setLogoMsg]       = useState<string | null>(null);

  // ── Favicon upload state ─────────────────────────────────────────────
  const faviconInputRef   = useRef<HTMLInputElement>(null);
  const [faviconPreview,  setFaviconPreview]   = useState<string | null>(appCfg.faviconDataUrl ?? null);
  const [faviconUnsaved,  setFaviconUnsaved]   = useState(false);
  const [faviconSaving,   setFaviconSaving]    = useState(false);
  const [faviconMsg,      setFaviconMsg]       = useState<string | null>(null);

  // ── Template flag ─────────────────────────────────────────────────────
  const [isTemplateLocal, setIsTemplateLocal] = useState(data.planning.isTemplate ?? false);

  // ── Sécurité — changement de mot de passe ─────────────────────────────
  const [secCurrent, setSecCurrent]     = useState("");
  const [secNew, setSecNew]             = useState("");
  const [secConfirm, setSecConfirm]     = useState("");
  const [secMsg, setSecMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const [secPending, setSecPending]     = useState(false);

  // Phase type form state
  const [newPTCode, setNewPTCode] = useState("");
  const [newPTLabel, setNewPTLabel] = useState("");
  const [editingPTId, setEditingPTId] = useState<string | null>(null);
  const [editingPTLabel, setEditingPTLabel] = useState("");

  // Milestone type form state
  const [newMTCode, setNewMTCode] = useState("");
  const [newMTLabel, setNewMTLabel] = useState("");
  const [newMTColor, setNewMTColor] = useState(PRESET_COLORS[4]);
  const [editingMTId, setEditingMTId] = useState<string | null>(null);
  const [editingMTLabel, setEditingMTLabel] = useState("");
  const [editingMTColor, setEditingMTColor] = useState("");

  return (
    <div className={styles.tabs}>
      <div className={styles.tabBar} role="tablist">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            className={`${styles.tabBtn} ${active === t.id ? styles.tabBtnActive : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Général ─────────────────────────────────────────────────── */}
      {active === "general" && (
        <div className={styles.tabPanel}>
          <form
            className={styles.settingsForm}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                await updatePlanningSettings({
                  planningId: planning.id,
                  autoLate: fd.get("autoLate") === "on",
                  autoCloseAfterMepDays: Number(fd.get("autoCloseAfterMepDays")),
                  notifyOnLate: fd.get("notifyOnLate") === "on",
                });
                router.refresh();
              });
            }}
          >
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Nom du planning</span>
                <span className={styles.fieldValue}>{planning.name}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Année</span>
                <span className={styles.fieldValue}>{planning.year}</span>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Période</span>
                <span className={styles.fieldValue}>
                  {fmtDate(planning.viewStart)} → {fmtDate(planning.viewEnd)}
                </span>
              </div>
            </div>

            {settings && (
              <div className={styles.settingsBlock}>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input type="checkbox" name="autoLate" defaultChecked={settings.autoLate} />
                    Passer en retard automatiquement
                  </label>
                </div>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    <input type="checkbox" name="notifyOnLate" defaultChecked={settings.notifyOnLate} />
                    Notifier en cas de retard
                  </label>
                </div>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    Clôture auto après MEP (jours)
                  </label>
                  <input
                    type="number"
                    name="autoCloseAfterMepDays"
                    defaultValue={settings.autoCloseAfterMepDays}
                    min={0}
                    max={365}
                    className={styles.numInput}
                  />
                </div>
                <button type="submit" className={styles.saveBtn} disabled={isPending}>
                  {isPending ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            )}

            {/* ── Modèle de planning ─────────────────────────────────── */}
            <div className={styles.settingsBlock} style={{ marginTop: 16 }}>
              <p className={styles.blockTitle} style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                Bibliothèque de modèles
              </p>
              <div className={styles.settingRow}>
                <label className={styles.settingLabel}>
                  <input
                    type="checkbox"
                    checked={isTemplateLocal}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setIsTemplateLocal(val);
                      startTransition(async () => {
                        await setTemplateFlag(planning.id, val);
                        router.refresh();
                      });
                    }}
                  />
                  Utiliser ce planning comme modèle
                </label>
              </div>
              <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0 22px" }}>
                Les modèles apparaissent dans &quot;Nouveau planning → Depuis un modèle&quot; avec recalage automatique des dates.
              </p>
            </div>
          </form>
        </div>
      )}

      {/* ── Cadence ─────────────────────────────────────────────────── */}
      {active === "cadence" && (
        <div className={styles.tabPanel}>
          <p className={styles.tabDesc}>
            Jours ouvrés entre la livraison et chaque jalon automatique, par domaine.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Domaine</th>
                <th>Livraison</th>
                <th>Pré-MEP</th>
                <th>CAB</th>
                <th>MEP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <CadenceRow
                  key={d.id}
                  domain={d}
                  planningId={planning.id}
                  isPending={isPending}
                  startTransition={startTransition}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Types de phases ─────────────────────────────────────────── */}
      {active === "phases" && (
        <div className={styles.tabPanel}>
          <table className={styles.table}>
            <thead>
              <tr><th>#</th><th>Code</th><th>Libellé</th><th></th></tr>
            </thead>
            <tbody>
              {phaseTypes.map((pt, i) => (
                <tr key={pt.id}>
                  <td className={styles.tdMuted}>{i + 1}</td>
                  <td><code className={styles.codeChip}>{pt.code}</code></td>
                  <td>
                    {editingPTId === pt.id ? (
                      <input
                        className={styles.addInput}
                        value={editingPTLabel}
                        autoFocus
                        onChange={(e) => setEditingPTLabel(e.target.value)}
                        onBlur={() => {
                          if (editingPTLabel.trim() && editingPTLabel !== pt.label) {
                            startTransition(async () => {
                              await updatePhaseType({ id: pt.id, planningId: planning.id, label: editingPTLabel.trim() });
                              router.refresh();
                            });
                          }
                          setEditingPTId(null);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingPTId(null); }}
                      />
                    ) : pt.label}
                  </td>
                  <td style={{ display: "flex", gap: 4 }}>
                    <button
                      className={styles.editRowBtn}
                      title="Modifier"
                      disabled={isPending}
                      onClick={() => { setEditingPTId(pt.id); setEditingPTLabel(pt.label); }}
                    >
                      ✎
                    </button>
                    <button
                      className={styles.deleteRowBtn}
                      title="Supprimer"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm(`Supprimer le type "${pt.label}" ?`)) {
                          startTransition(async () => {
                            await deletePhaseType(pt.id, planning.id);
                            router.refresh();
                          });
                        }
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPTCode.trim() || !newPTLabel.trim()) return;
              startTransition(async () => {
                await addPhaseType({ planningId: planning.id, code: newPTCode.trim(), label: newPTLabel.trim() });
                setNewPTCode("");
                setNewPTLabel("");
                router.refresh();
              });
            }}
          >
            <input
              className={styles.addInput}
              placeholder="code (ex. formation)"
              value={newPTCode}
              onChange={(e) => setNewPTCode(e.target.value)}
              maxLength={40}
            />
            <input
              className={styles.addInput}
              placeholder="Libellé"
              value={newPTLabel}
              onChange={(e) => setNewPTLabel(e.target.value)}
              maxLength={80}
            />
            <button type="submit" className={styles.addBtn} disabled={isPending || !newPTCode || !newPTLabel}>
              + Ajouter
            </button>
          </form>
        </div>
      )}

      {/* ── Types de jalons ─────────────────────────────────────────── */}
      {active === "jalons" && (
        <div className={styles.tabPanel}>
          <table className={styles.table}>
            <thead>
              <tr><th>#</th><th>Code</th><th>Libellé</th><th>Couleur</th><th></th></tr>
            </thead>
            <tbody>
              {milestoneTypes.map((mt, i) => (
                <tr key={mt.id}>
                  <td className={styles.tdMuted}>{i + 1}</td>
                  <td><code className={styles.codeChip}>{mt.code}</code></td>
                  <td>
                    {editingMTId === mt.id ? (
                      <input
                        className={styles.addInput}
                        value={editingMTLabel}
                        autoFocus
                        onChange={(e) => setEditingMTLabel(e.target.value)}
                        onBlur={() => {
                          if (editingMTLabel.trim()) {
                            startTransition(async () => {
                              await updateMilestoneType({ id: mt.id, planningId: planning.id, label: editingMTLabel.trim(), color: editingMTColor });
                              router.refresh();
                            });
                          }
                          setEditingMTId(null);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingMTId(null); }}
                      />
                    ) : mt.label}
                  </td>
                  <td>
                    {editingMTId === mt.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="color"
                          value={editingMTColor}
                          style={{ width: 28, height: 24, borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer", padding: 1 }}
                          onChange={(e) => setEditingMTColor(e.target.value)}
                        />
                        <span className={styles.tdMuted} style={{ fontSize: 11 }}>{editingMTColor}</span>
                      </div>
                    ) : (
                      <>
                        <span className={styles.colorSwatch} style={{ background: mt.color }} />
                        <span className={styles.tdMuted}>{mt.color}</span>
                      </>
                    )}
                  </td>
                  <td style={{ display: "flex", gap: 4 }}>
                    <button
                      className={styles.editRowBtn}
                      title="Modifier"
                      disabled={isPending}
                      onClick={() => { setEditingMTId(mt.id); setEditingMTLabel(mt.label); setEditingMTColor(mt.color); }}
                    >
                      ✎
                    </button>
                    <button
                      className={styles.deleteRowBtn}
                      title="Supprimer"
                      disabled={isPending}
                      onClick={() => {
                        if (confirm(`Supprimer le type jalon "${mt.label}" ?`)) {
                          startTransition(async () => {
                            await deleteMilestoneType(mt.id, planning.id);
                            router.refresh();
                          });
                        }
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newMTCode.trim() || !newMTLabel.trim()) return;
              startTransition(async () => {
                await addMilestoneType({ planningId: planning.id, code: newMTCode.trim(), label: newMTLabel.trim(), color: newMTColor });
                setNewMTCode("");
                setNewMTLabel("");
                router.refresh();
              });
            }}
          >
            <input
              className={styles.addInput}
              placeholder="code"
              value={newMTCode}
              onChange={(e) => setNewMTCode(e.target.value)}
              maxLength={40}
            />
            <input
              className={styles.addInput}
              placeholder="Libellé"
              value={newMTLabel}
              onChange={(e) => setNewMTLabel(e.target.value)}
              maxLength={80}
            />
            <div className={styles.colorPresets}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.presetDot} ${newMTColor === c ? styles.presetDotActive : ""}`}
                  style={{ background: c }}
                  onClick={() => setNewMTColor(c)}
                />
              ))}
            </div>
            <button type="submit" className={styles.addBtn} disabled={isPending || !newMTCode || !newMTLabel}>
              + Ajouter
            </button>
          </form>
        </div>
      )}

      {/* ── Statuts ─────────────────────────────────────────────────── */}
      {active === "statuts" && (
        <div className={styles.tabPanel}>
          <table className={styles.table}>
            <thead>
              <tr><th>#</th><th>Code</th><th>Libellé</th><th>Aperçu</th></tr>
            </thead>
            <tbody>
              {statuses.map((s, i) => (
                <tr key={s.id}>
                  <td className={styles.tdMuted}>{i + 1}</td>
                  <td><code className={styles.codeChip}>{s.code}</code></td>
                  <td>{s.label}</td>
                  <td>
                    <span className={styles.statusPreview} style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.tabDesc} style={{ marginTop: 12 }}>
            Les statuts sont synchronisés avec le système. L&apos;édition libre arrive dans une prochaine version.
          </p>
        </div>
      )}

      {/* ── Apparence (Logo + Favicon) ────────────────────────────── */}
      {active === "apparence" && (
        <div className={styles.tabPanel}>

          {/* ─── Logo ─────────────────────────────────────────────────── */}
          <p className={styles.tabDesc}>
            <strong>Logo dans la barre de navigation.</strong> Format recommandé&nbsp;: PNG ou SVG carré,
            fond transparent. Taille max&nbsp;: 200&nbsp;Ko.
          </p>

          <div className={styles.logoSection}>
            {/* Prévisualisation */}
            <div className={styles.logoPreviewBox}>
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt={logoAlt} className={styles.logoPreviewImg} />
              ) : (
                <div className={styles.logoKlintFallback}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: "#5CD696" }}>K</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>LINT</span>
                </div>
              )}
            </div>

            {/* Contrôles logo */}
            <div className={styles.logoControls}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Texte alternatif</span>
                <input
                  type="text"
                  className={styles.addInput}
                  value={logoAlt}
                  onChange={(e) => { setLogoAlt(e.target.value); setLogoUnsaved(true); }}
                  placeholder="ex. Mon Entreprise"
                  maxLength={100}
                />
              </div>

              <div className={styles.logoButtonRow}>
                {/*
                  ⚠️  On utilise <label> au lieu de button + fileRef.click() :
                  la technique label/htmlFor est la seule garantie cross-browser
                  (Chrome, Safari iOS, Firefox, Edge) pour déclencher le file picker.
                */}
                <label
                  htmlFor="logo-file-input"
                  className={`${styles.addBtn} ${styles.uploadLabel} ${logoSaving ? styles.uploadLabelDisabled : ""}`}
                  aria-disabled={logoSaving}
                >
                  {logoPreview ? "Changer le logo" : "Choisir un logo…"}
                </label>

                {/* Enregistrer — visible dès qu'il y a un logo (sélectionné ou déjà sauvé) */}
                {(logoPreview || logoUnsaved) && (
                  <button
                    className={styles.saveBtn}
                    onClick={async () => {
                      if (!logoPreview) return;
                      setLogoSaving(true);
                      await saveAppLogo(logoPreview, logoAlt || "Klint");
                      setLogoMsg("Logo enregistré ✓");
                      setLogoUnsaved(false);
                      setLogoSaving(false);
                      router.refresh();
                      setTimeout(() => setLogoMsg(null), 3000);
                    }}
                    disabled={logoSaving || !logoPreview}
                  >
                    {logoSaving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                )}

                {/* Réinitialiser — visible quand un logo custom est présent */}
                {logoPreview && (
                  <button
                    className={`${styles.deleteRowBtn} ${styles.logoResetBtn}`}
                    onClick={async () => {
                      setLogoSaving(true);
                      await saveAppLogo(null, "Klint");
                      setLogoPreview(null);
                      setLogoAlt("Klint");
                      setLogoUnsaved(false);
                      setLogoMsg("Logo réinitialisé.");
                      setLogoSaving(false);
                      router.refresh();
                      setTimeout(() => setLogoMsg(null), 3000);
                    }}
                    disabled={logoSaving}
                  >
                    Réinitialiser
                  </button>
                )}
              </div>

              {logoUnsaved && !logoMsg && (
                <p className={styles.unsavedHint}>Fichier chargé — cliquez sur Enregistrer pour appliquer.</p>
              )}
              {logoMsg && <p className={styles.savedMsg}>{logoMsg}</p>}
            </div>
          </div>

          {/*
            Input file logo — caché via display:none.
            Avec l'approche label/htmlFor, display:none fonctionne dans tous les navigateurs :
            le label reçoit le clic utilisateur et le délègue nativement à l'input.
          */}
          <input
            id="logo-file-input"
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 200 * 1024) {
                alert("Fichier trop lourd (max 200 Ko). Utilisez un SVG ou un PNG optimisé.");
                e.target.value = "";
                return;
              }
              const reader = new FileReader();
              reader.onload = (ev) => {
                const result = ev.target?.result;
                if (typeof result === "string") {
                  setLogoPreview(result);
                  setLogoUnsaved(true);
                }
                // Réinitialiser APRÈS la lecture pour pouvoir re-sélectionner le même fichier
                e.target.value = "";
              };
              reader.onerror = () => {
                alert("Impossible de lire ce fichier. Essayez un autre format.");
                e.target.value = "";
              };
              reader.readAsDataURL(file);
            }}
          />

          {/* ─── Séparateur ───────────────────────────────────────────── */}
          <hr style={{ border: "none", borderTop: "1px solid var(--klint-line)", margin: "24px 0" }} />

          {/* ─── Favicon ─────────────────────────────────────────────── */}
          <p className={styles.tabDesc}>
            <strong>Favicon (onglet du navigateur).</strong> Format recommandé&nbsp;: PNG ou SVG carré,
            32×32 px minimum. Taille max&nbsp;: 100&nbsp;Ko. Visible après rechargement de la page.
          </p>

          <div className={styles.logoSection}>
            {/* Prévisualisation favicon */}
            <div className={styles.faviconPreviewBox}>
              {faviconPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={faviconPreview} alt="Favicon" className={styles.faviconPreviewImg} />
              ) : (
                <div className={styles.logoKlintFallback} style={{ transform: "scale(0.65)" }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: "#5CD696" }}>K</span>
                </div>
              )}
              <span className={styles.faviconLabel}>32px</span>
            </div>

            {/* Contrôles favicon */}
            <div className={styles.logoControls}>
              <div className={styles.logoButtonRow}>
                <label
                  htmlFor="favicon-file-input"
                  className={`${styles.addBtn} ${styles.uploadLabel} ${faviconSaving ? styles.uploadLabelDisabled : ""}`}
                  aria-disabled={faviconSaving}
                >
                  {faviconPreview ? "Changer le favicon" : "Choisir un favicon…"}
                </label>

                {(faviconPreview || faviconUnsaved) && (
                  <button
                    className={styles.saveBtn}
                    onClick={async () => {
                      if (!faviconPreview) return;
                      setFaviconSaving(true);
                      await saveAppFavicon(faviconPreview);
                      setFaviconMsg("Favicon enregistré ✓ (rechargez la page pour voir l'effet)");
                      setFaviconUnsaved(false);
                      setFaviconSaving(false);
                      setTimeout(() => setFaviconMsg(null), 5000);
                    }}
                    disabled={faviconSaving || !faviconPreview}
                  >
                    {faviconSaving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                )}

                {faviconPreview && (
                  <button
                    className={`${styles.deleteRowBtn} ${styles.logoResetBtn}`}
                    onClick={async () => {
                      setFaviconSaving(true);
                      await saveAppFavicon(null);
                      setFaviconPreview(null);
                      setFaviconUnsaved(false);
                      setFaviconMsg("Favicon réinitialisé.");
                      setFaviconSaving(false);
                      setTimeout(() => setFaviconMsg(null), 3000);
                    }}
                    disabled={faviconSaving}
                  >
                    Réinitialiser
                  </button>
                )}
              </div>

              {faviconUnsaved && !faviconMsg && (
                <p className={styles.unsavedHint}>Fichier chargé — cliquez sur Enregistrer pour appliquer.</p>
              )}
              {faviconMsg && <p className={styles.savedMsg}>{faviconMsg}</p>}
            </div>
          </div>

          {/* Input file favicon */}
          <input
            id="favicon-file-input"
            ref={faviconInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 100 * 1024) {
                alert("Fichier trop lourd (max 100 Ko). Utilisez un SVG ou un PNG 32×32.");
                e.target.value = "";
                return;
              }
              const reader = new FileReader();
              reader.onload = (ev) => {
                const result = ev.target?.result;
                if (typeof result === "string") {
                  setFaviconPreview(result);
                  setFaviconUnsaved(true);
                }
                e.target.value = "";
              };
              reader.onerror = () => {
                alert("Impossible de lire ce fichier.");
                e.target.value = "";
              };
              reader.readAsDataURL(file);
            }}
          />
        </div>
      )}

      {/* ── Calendrier (jours fériés + fermetures) ───────────────────── */}
      {active === "calendrier" && (
        <div className={styles.tabPanel}>

          {/* ─ Jours fériés ─ */}
          <p className={styles.tabDesc} style={{ marginBottom: 12 }}>
            <strong>Jours fériés français.</strong> Chargez automatiquement les jours fériés pour une année, ou ajoutez-les manuellement en-dessous.
          </p>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
            {[2025, 2026].map((yr) => (
              <button
                key={yr}
                className={styles.addBtn}
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await seedHolidays(planning.id, yr);
                    setCalSeedMsg(`${res.inserted} jour(s) férié(s) ajouté(s) pour ${yr}.`);
                    setCalPeriods((prev) => [...prev]); // trigger re-render via router.refresh
                    router.refresh();
                    setTimeout(() => setCalSeedMsg(null), 4000);
                  });
                }}
              >
                Charger jours fériés {yr}
              </button>
            ))}
            {calSeedMsg && <span className={styles.savedMsg}>{calSeedMsg}</span>}
          </div>

          {/* Liste des jours fériés existants */}
          {calPeriods.filter((cp) => cp.type === "holiday").length > 0 && (
            <table className={styles.table} style={{ marginBottom: 24 }}>
              <thead>
                <tr><th>Libellé</th><th>Date</th><th>Actif</th><th></th></tr>
              </thead>
              <tbody>
                {calPeriods.filter((cp) => cp.type === "holiday").map((cp) => (
                  <tr key={cp.id}>
                    <td>{cp.label}</td>
                    <td className={styles.tdMuted}>{fmtDate(cp.startDate)}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={cp.active}
                        disabled={isPending}
                        onChange={(e) => {
                          const next = calPeriods.map((p) => p.id === cp.id ? { ...p, active: e.target.checked } : p);
                          setCalPeriods(next);
                          startTransition(async () => {
                            await updateClosurePeriod(cp.id, { active: e.target.checked });
                            router.refresh();
                          });
                        }}
                      />
                    </td>
                    <td>
                      <button
                        className={styles.deleteRowBtn}
                        disabled={isPending}
                        onClick={() => {
                          if (!confirm(`Supprimer "${cp.label}" ?`)) return;
                          setCalPeriods((prev) => prev.filter((p) => p.id !== cp.id));
                          startTransition(async () => {
                            await deleteClosurePeriod(cp.id, planning.id);
                            router.refresh();
                          });
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <hr style={{ border: "none", borderTop: "1px solid var(--klint-line)", margin: "8px 0 20px" }} />

          {/* ─ Périodes de fermeture ─ */}
          <p className={styles.tabDesc} style={{ marginBottom: 12 }}>
            <strong>Périodes de fermeture / Gel DSI.</strong> Définissez des périodes personnalisées (congés, gel, indisponibilité) affichées comme des bandes colorées sur le Gantt.
          </p>

          {calPeriods.filter((cp) => cp.type === "custom").length > 0 && (
            <table className={styles.table} style={{ marginBottom: 16 }}>
              <thead>
                <tr><th>Libellé</th><th>Début</th><th>Fin</th><th>Couleur</th><th>Actif</th><th></th></tr>
              </thead>
              <tbody>
                {calPeriods.filter((cp) => cp.type === "custom").map((cp) => (
                  <tr key={cp.id}>
                    <td>{cp.label}</td>
                    <td className={styles.tdMuted}>{fmtDate(cp.startDate)}</td>
                    <td className={styles.tdMuted}>{fmtDate(cp.endDate)}</td>
                    <td>
                      <span
                        className={styles.colorSwatch}
                        style={{ background: cp.color, border: "1px solid #e5e7eb" }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={cp.active}
                        disabled={isPending}
                        onChange={(e) => {
                          const next = calPeriods.map((p) => p.id === cp.id ? { ...p, active: e.target.checked } : p);
                          setCalPeriods(next);
                          startTransition(async () => {
                            await updateClosurePeriod(cp.id, { active: e.target.checked });
                            router.refresh();
                          });
                        }}
                      />
                    </td>
                    <td>
                      <button
                        className={styles.deleteRowBtn}
                        disabled={isPending}
                        onClick={() => {
                          if (!confirm(`Supprimer "${cp.label}" ?`)) return;
                          setCalPeriods((prev) => prev.filter((p) => p.id !== cp.id));
                          startTransition(async () => {
                            await deleteClosurePeriod(cp.id, planning.id);
                            router.refresh();
                          });
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Formulaire ajout période de fermeture */}
          <form
            className={styles.addRow}
            style={{ flexWrap: "wrap", gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!calLabel.trim() || !calStart || !calEnd) return;
              if (calEnd < calStart) { alert("La date de fin doit être après la date de début."); return; }
              startTransition(async () => {
                await createClosurePeriod({
                  planningId: planning.id,
                  label: calLabel.trim(),
                  startDate: calStart,
                  endDate: calEnd,
                  color: calColor,
                  type: "custom",
                });
                setCalLabel("");
                setCalStart("");
                setCalEnd("");
                router.refresh();
              });
            }}
          >
            <input
              className={styles.addInput}
              placeholder="Libellé (ex. Gel DSI Q4)"
              value={calLabel}
              onChange={(e) => setCalLabel(e.target.value)}
              maxLength={100}
              style={{ flex: "1 1 160px" }}
            />
            <input
              type="date"
              className={styles.addInput}
              value={calStart}
              onChange={(e) => setCalStart(e.target.value)}
              title="Date de début"
              style={{ flex: "0 0 140px" }}
            />
            <input
              type="date"
              className={styles.addInput}
              value={calEnd}
              onChange={(e) => setCalEnd(e.target.value)}
              title="Date de fin"
              style={{ flex: "0 0 140px" }}
            />
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {CLOSURE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: c.hex,
                    border: calColor === c.hex ? "2px solid #374151" : "1px solid #d1d5db",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  onClick={() => setCalColor(c.hex)}
                />
              ))}
            </div>
            <button
              type="submit"
              className={styles.addBtn}
              disabled={isPending || !calLabel || !calStart || !calEnd}
            >
              + Ajouter période
            </button>
          </form>
        </div>
      )}

      {/* ── Sécurité ─────────────────────────────────────────────────── */}
      {active === "securite" && (
        <div className={styles.tabPanel}>
          <p className={styles.tabDesc}>
            Changez votre mot de passe de connexion à Klint Planning. Le nouveau mot de passe doit contenir au moins 8 caractères.
          </p>

          <form
            className={styles.settingsForm}
            style={{ maxWidth: 400 }}
            onSubmit={async (e) => {
              e.preventDefault();
              setSecMsg(null);
              if (secNew !== secConfirm) {
                setSecMsg({ ok: false, text: "Les deux nouveaux mots de passe ne correspondent pas." });
                return;
              }
              if (secNew.length < 8) {
                setSecMsg({ ok: false, text: "Le mot de passe doit contenir au moins 8 caractères." });
                return;
              }
              setSecPending(true);
              const result = await changePassword({ currentPassword: secCurrent, newPassword: secNew });
              setSecPending(false);
              if (result.success) {
                setSecMsg({ ok: true, text: "Mot de passe mis à jour avec succès." });
                setSecCurrent(""); setSecNew(""); setSecConfirm("");
              } else {
                setSecMsg({ ok: false, text: result.error ?? "Erreur lors du changement de mot de passe." });
              }
            }}
          >
            <div className={styles.field} style={{ marginBottom: 14 }}>
              <label className={styles.fieldLabel} htmlFor="secCurrent">
                Mot de passe actuel
              </label>
              <input
                id="secCurrent"
                type="password"
                autoComplete="current-password"
                value={secCurrent}
                onChange={(e) => setSecCurrent(e.target.value)}
                required
                disabled={secPending}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13,
                  border: "1.5px solid var(--klint-line)", borderRadius: 8,
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div className={styles.field} style={{ marginBottom: 14 }}>
              <label className={styles.fieldLabel} htmlFor="secNew">
                Nouveau mot de passe
              </label>
              <input
                id="secNew"
                type="password"
                autoComplete="new-password"
                value={secNew}
                onChange={(e) => setSecNew(e.target.value)}
                required
                disabled={secPending}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13,
                  border: "1.5px solid var(--klint-line)", borderRadius: 8,
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div className={styles.field} style={{ marginBottom: 20 }}>
              <label className={styles.fieldLabel} htmlFor="secConfirm">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="secConfirm"
                type="password"
                autoComplete="new-password"
                value={secConfirm}
                onChange={(e) => setSecConfirm(e.target.value)}
                required
                disabled={secPending}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13,
                  border: "1.5px solid var(--klint-line)", borderRadius: 8,
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {secMsg && (
              <p style={{
                fontSize: 13, margin: "0 0 14px",
                color: secMsg.ok ? "#16A34A" : "#DC2626",
                background: secMsg.ok ? "#DCFCE7" : "#FEE2E2",
                borderRadius: 6, padding: "8px 12px",
              }}>
                {secMsg.text}
              </p>
            )}

            <button
              type="submit"
              className={styles.addBtn}
              disabled={secPending || !secCurrent || !secNew || !secConfirm}
            >
              {secPending ? "Mise à jour…" : "Mettre à jour le mot de passe"}
            </button>
          </form>

          <hr style={{ border: "none", borderTop: "1px solid var(--klint-line)", margin: "28px 0 20px" }} />

          <div style={{ maxWidth: 400 }}>
            <p className={styles.fieldLabel} style={{ marginBottom: 6 }}>Politique de sécurité</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#6B7280", lineHeight: 1.7 }}>
              <li>Minimum 8 caractères</li>
              <li>Utilisez une combinaison de lettres, chiffres et symboles</li>
              <li>Ne réutilisez pas un mot de passe déjà utilisé</li>
              <li>En cas d&apos;oubli, contactez un administrateur</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Répertoire ──────────────────────────────────────────────────── */}
      {active === "répertoire" && (
        <div className={styles.tabPanel}>
          <RépertoireTab contacts={directoryContacts} planningId={planning.id} />
        </div>
      )}

      {/* ── Historique ──────────────────────────────────────────────────── */}
      {active === "historique" && (
        <HistoriquePanel activityEntries={activityEntries} connLogs={connLogs} />
      )}

      {active === "droits" && userRole === "admin" && (
        <div className={styles.tabPanel}>
          <DroitsTab permissions={permissions} />
        </div>
      )}
    </div>
  );
}

function HistoriquePanel({ activityEntries, connLogs }: { activityEntries: ActivityEntry[]; connLogs: ConnectionLogRow[] }) {
  const [histSub, setHistSub] = useState<"activite" | "connexions">("activite");
  return (
        <div className={styles.tabPanel}>
          <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
            {(["activite", "connexions"] as const).map((sub) => (
              <button
                key={sub}
                onClick={() => setHistSub(sub)}
                style={{
                  padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: "var(--font-display)",
                  background: histSub === sub ? "var(--klint-navy)" : "transparent",
                  color: histSub === sub ? "#fff" : "var(--klint-navy)",
                }}
              >
                {sub === "activite" ? "Activité" : "Connexions"}
              </button>
            ))}
          </div>

          {/* Activité */}
          {histSub === "activite" && (<>
          <p className={styles.tabDesc} style={{ marginBottom: 16 }}>
            Les 200 derniers événements sur ce planning.
          </p>
          {activityEntries.length === 0 ? (
            <p style={{ color: "#6B7280", fontSize: 13 }}>Aucun événement enregistré.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 520, overflowY: "auto" }}>
              {activityEntries.map((entry) => (
                <div key={entry.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: entry.actorColor ?? "#001D63",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#fff",
                  }}>
                    {entry.actorInitials ?? "?"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--klint-navy)" }}>
                        {VERB_LABELS[entry.verb] ?? entry.verb}
                      </span>
                      {entry.targetType && (
                        <span style={{ fontSize: 11, background: "#F1F5F9", borderRadius: 4, padding: "1px 6px", color: "#6B7280" }}>
                          {entry.targetType}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{entry.actorName ?? "Système"}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>{entry.summary}</p>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{fmtDatetime(entry.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          </>)}

          {/* Connexions */}
          {histSub === "connexions" && (
            connLogs.length === 0 ? (
              <p style={{ color: "#6B7280", fontSize: 13 }}>Aucune connexion enregistrée.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className={styles.table} style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>IP</th>
                      <th>Pays</th>
                      <th>Ville</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {connLogs.slice(0, 100).map((log) => (
                      <tr key={log.id} style={log.isAlert ? { background: "#FEF2F2" } : undefined}>
                        <td>{log.email}</td>
                        <td style={{ fontFamily: "monospace" }}>{log.ip ?? "—"}</td>
                        <td>{countryFlag(log.countryCode)} {log.country ?? "—"}</td>
                        <td>{log.city ?? "—"}</td>
                        <td>{fmtDatetime(log.createdAt)}</td>
                        <td>{log.isAlert && <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 11 }}>⚠ Alerte</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
  );
}

// ── CadenceRow — édition inline ────────────────────────────────────────────

type AnyDomain = GanttData["domains"][number];

function CadenceRow({
  domain,
  planningId,
  isPending,
  startTransition,
}: {
  domain: AnyDomain;
  planningId: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [cad, setCad] = useState(domain.cadence);
  const styles_table = ""; // unused, handled at table level

  const save = (next: typeof cad) => {
    setCad(next);
    startTransition(async () => {
      await updateDomainCadence({
        domainId: domain.id,
        planningId,
        livraison: next.livraison,
        pmep: next.pmep,
        cab: next.cab,
        mep: next.mep,
      });
    });
  };

  return (
    <tr>
      <td>
        <span
          style={{
            display: "inline-block",
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            background: `var(--d-${domain.code}-bg)`,
            color: `var(--d-${domain.code}-strong)`,
            marginRight: 6,
          }}
        >
          {domain.code.toUpperCase()}
        </span>
        {domain.name}
      </td>
      {(["livraison", "pmep", "cab", "mep"] as const).map((field) => (
        <td key={field}>
          <input
            type="number"
            min={0}
            max={60}
            value={cad[field]}
            disabled={isPending}
            onChange={(e) => save({ ...cad, [field]: Number(e.target.value) })}
            style={{
              width: 52,
              padding: "3px 6px",
              fontSize: 13,
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              textAlign: "center",
              fontFamily: "inherit",
            }}
          />
        </td>
      ))}
      <td></td>
    </tr>
  );
}

// ── Répertoire tab — CRUD contacts ───────────────────────────────────────────

function RépertoireTab({ contacts, planningId }: { contacts: DirectoryContact[]; planningId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editName, setEditName]         = useState("");
  const [editInitials, setEditInitials] = useState("");
  const [editColor, setEditColor]       = useState(PRESET_COLORS[0]);
  const [editRole, setEditRole]         = useState<"admin" | "user" | "contact">("contact");

  const [showNew, setShowNew]         = useState(false);
  const [newName, setNewName]         = useState("");
  const [newEmail, setNewEmail]       = useState("");
  const [newInitials, setNewInitials] = useState("");
  const [newColor, setNewColor]       = useState(PRESET_COLORS[0]);
  const [newRole, setNewRole]         = useState<"admin" | "user" | "contact">("contact");
  const [newError, setNewError]       = useState<string | null>(null);

  const [inviteLink, setInviteLink]       = useState<string | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied]   = useState(false);

  const refresh = () => router.refresh();

  const filtered = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.plannings.some((p) => p.name.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16, marginTop: 0 }}>
        Tous les contacts de la plateforme. Modifiez, désactivez ou attribuez-les à ce planning.
      </p>

      {/* ── Barre de recherche + nouveau ── */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <input
            type="text"
            placeholder="Rechercher par nom, email ou planning…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "8px 32px 8px 12px",
              fontFamily: "var(--font-display, system-ui)", fontSize: 13,
              color: "var(--klint-navy)", background: "#fff",
              border: "1.5px solid var(--klint-line, #E6E8EE)",
              borderRadius: 8, outline: "none", boxSizing: "border-box",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 16, padding: "2px 4px", lineHeight: 1 }}
            >×</button>
          )}
        </div>
        <button
          className={styles.addBtn}
          onClick={() => { setShowNew(!showNew); setNewName(""); setNewEmail(""); setNewInitials(""); setNewColor(PRESET_COLORS[0]); setNewRole("contact"); setNewError(null); }}
        >
          + Nouveau contact
        </button>
      </div>

      {/* ── Formulaire nouveau contact ── */}
      {showNew && (
        <div style={{ background: "#F8FBFF", border: "1.5px solid #3B82F6", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: "var(--klint-navy)", marginBottom: 12, marginTop: 0 }}>Nouveau contact</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 150px" }}>
              <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 3 }}>Nom</label>
              <input className={styles.addInput} placeholder="Prénom Nom" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={160} style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 3 }}>Email</label>
              <input className={styles.addInput} type="email" placeholder="email@exemple.fr" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} maxLength={255} style={{ width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: "0 0 72px" }}>
              <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 3 }}>Initiales</label>
              <input className={styles.addInput} placeholder="AB" value={newInitials} onChange={(e) => setNewInitials(e.target.value.toUpperCase())} maxLength={3} style={{ width: "100%", textTransform: "uppercase", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 5 }}>Couleur</label>
              <div style={{ display: "flex", gap: 3 }}>
                {PRESET_COLORS.map((pc) => (
                  <button key={pc} type="button"
                    style={{ width: 18, height: 18, borderRadius: "50%", background: pc, border: newColor === pc ? "2px solid #374151" : "1px solid #d1d5db", cursor: "pointer", padding: 0, flexShrink: 0 }}
                    onClick={() => setNewColor(pc)}
                  />
                ))}
              </div>
            </div>
            <div style={{ flex: "0 0 120px" }}>
              <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 3 }}>Rôle</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "user" | "contact")}
                className={styles.addInput}
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="contact">Contact</option>
                <option value="user">Utilisateur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {newError && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 8, marginBottom: 0 }}>{newError}</p>}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button
              className={styles.saveBtn}
              disabled={isPending || !newName.trim() || !newEmail.trim() || !newInitials.trim()}
              onClick={() => {
                setNewError(null);
                startTransition(async () => {
                  try {
                    await addMember({ planningId, name: newName.trim(), email: newEmail.trim(), initials: newInitials.trim(), color: newColor, role: newRole });
                    setShowNew(false);
                    refresh();
                  } catch (e: unknown) {
                    setNewError(e instanceof Error ? e.message : "Erreur lors de la création.");
                  }
                });
              }}
            >
              {isPending ? "Création…" : "Créer et ajouter au planning"}
            </button>
            <button className={styles.deleteRowBtn} onClick={() => setShowNew(false)}>Annuler</button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 16 }}>
        {filtered.length} contact{filtered.length !== 1 ? "s" : ""}{search ? ` pour « ${search} »` : ""}
      </p>

      {/* ── Grille de contacts ── */}
      {filtered.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 13, padding: "24px 0" }}>Aucun résultat.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {filtered.map((c) => {
            const memberEntry = c.plannings.find((p) => p.id === planningId);
            const memberId    = memberEntry?.memberId ?? null;
            const inCurrent   = memberId !== null;
            const disabled    = c.disabledAt !== null;
            const initials    = (c.initials ?? (c.name ?? c.email).slice(0, 2)).toUpperCase();
            const color       = c.color ?? "#001D63";
            const isEditing   = editingId === c.userId;

            return (
              <div key={c.userId} style={{
                background: disabled ? "#F9FAFB" : "#fff",
                border: `1.5px solid ${isEditing ? "#3B82F6" : "var(--klint-line, #E6E8EE)"}`,
                borderRadius: 10, padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: 8,
                opacity: disabled ? 0.8 : 1,
              }}>
                {isEditing ? (
                  /* ── Formulaire d'édition inline ── */
                  <>
                    <p style={{ fontWeight: 600, fontSize: 12, margin: 0, color: "var(--klint-navy)" }}>
                      Modifier {c.name ?? c.email}
                    </p>
                    <div>
                      <label style={{ fontSize: 11, color: "#6B7280" }}>Nom</label>
                      <input className={styles.addInput} value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginTop: 3 }} maxLength={160} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ flex: "0 0 80px" }}>
                        <label style={{ fontSize: 11, color: "#6B7280" }}>Initiales</label>
                        <input className={styles.addInput} value={editInitials} onChange={(e) => setEditInitials(e.target.value.toUpperCase())} style={{ width: "100%", textTransform: "uppercase", boxSizing: "border-box", marginTop: 3 }} maxLength={3} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, color: "#6B7280" }}>Couleur</label>
                        <div style={{ display: "flex", gap: 3, marginTop: 7, flexWrap: "wrap" }}>
                          {PRESET_COLORS.map((pc) => (
                            <button key={pc} type="button"
                              style={{ width: 18, height: 18, borderRadius: "50%", background: pc, border: editColor === pc ? "2px solid #374151" : "1px solid #d1d5db", cursor: "pointer", padding: 0, flexShrink: 0 }}
                              onClick={() => setEditColor(pc)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#6B7280" }}>Rôle</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as "admin" | "user" | "contact")}
                        className={styles.addInput}
                        style={{ width: "100%", boxSizing: "border-box", marginTop: 3 }}
                      >
                        <option value="contact">Contact</option>
                        <option value="user">Utilisateur</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className={styles.saveBtn}
                        disabled={isPending || !editName.trim() || !editInitials.trim()}
                        onClick={() => {
                          startTransition(async () => {
                            await updateContact({ userId: c.userId, name: editName.trim(), initials: editInitials.trim(), color: editColor, role: editRole });
                            setEditingId(null);
                            refresh();
                          });
                        }}
                      >
                        {isPending ? "…" : "Enregistrer"}
                      </button>
                      <button className={styles.deleteRowBtn} onClick={() => setEditingId(null)}>Annuler</button>
                    </div>
                  </>
                ) : (
                  /* ── Carte affichage ── */
                  <>
                    {/* En-tête avatar + nom */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: color, color: "#fff",
                        fontWeight: 700, fontSize: 13,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, letterSpacing: 0.5,
                        filter: disabled ? "grayscale(0.4)" : "none",
                      }}>
                        {initials}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.name ?? "—"}
                          </span>
                          {c.role === "admin" && (
                            <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: "#001036", color: "#fff", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                              Admin
                            </span>
                          )}
                          {c.role === "user" && (
                            <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                              Utilisateur
                            </span>
                          )}
                          {c.role === "contact" && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "#F3F4F6", color: "#6B7280", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                              Contact
                            </span>
                          )}
                          {disabled && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "#FEF3C7", color: "#92400E", whiteSpace: "nowrap", flexShrink: 0 }}>
                              Désactivé
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.email}
                        </div>
                      </div>
                    </div>

                    {/* Badges plannings */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {c.plannings.length === 0 ? (
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Aucun planning</span>
                      ) : c.plannings.map((p) => (
                        <span key={p.id} style={{
                          fontSize: 10, fontWeight: 600,
                          padding: "2px 7px", borderRadius: 999,
                          background: p.id === planningId ? "#DCFCE7" : "var(--klint-paper, #F6F7FB)",
                          border: `1px solid ${p.id === planningId ? "#86EFAC" : "var(--klint-line, #E6E8EE)"}`,
                          color: p.id === planningId ? "#16A34A" : "var(--klint-navy)",
                          whiteSpace: "nowrap",
                        }}>
                          {p.id === planningId ? "✓ " : ""}{p.name}
                        </span>
                      ))}
                    </div>

                    {/* Barre d'actions — icônes uniquement */}
                    <div style={{ display: "flex", gap: 4, alignItems: "center", borderTop: "1px solid var(--klint-line, #E6E8EE)", paddingTop: 8 }}>
                      {/* Modifier */}
                      <button
                        className={styles.dirIconBtn}
                        disabled={isPending}
                        title="Modifier"
                        onClick={() => { setEditingId(c.userId); setEditName(c.name ?? ""); setEditInitials(c.initials ?? ""); setEditColor(c.color ?? PRESET_COLORS[0]); setEditRole(c.role); }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4z"/>
                        </svg>
                      </button>

                      {/* Retirer / Ajouter au planning */}
                      {inCurrent ? (
                        <button
                          className={styles.dirIconDangerBtn}
                          disabled={isPending}
                          title="Retirer de ce planning"
                          onClick={() => {
                            if (!confirm(`Retirer ${c.name ?? c.email} de ce planning ?`)) return;
                            startTransition(async () => { await removeMember(memberId!, planningId); refresh(); });
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 3h5v5"/><path d="M21 3 9 15"/><path d="M9 3H4v5"/><path d="m3 9 12 12"/><path d="M3 21h5v-5"/>
                          </svg>
                        </button>
                      ) : (
                        <button
                          className={styles.dirIconBtn}
                          disabled={isPending}
                          title="Ajouter à ce planning"
                          onClick={() => { startTransition(async () => { await assignExistingContactToPlanning(c.userId, planningId); refresh(); }); }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14"/><path d="M5 12h14"/>
                          </svg>
                        </button>
                      )}

                      {/* Désactiver / Réactiver */}
                      {disabled ? (
                        <button
                          className={styles.dirIconSuccessBtn}
                          disabled={isPending}
                          title="Réactiver le compte"
                          onClick={() => { startTransition(async () => { await enableContact(c.userId); refresh(); }); }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m20 6-11 11-5-5"/>
                          </svg>
                        </button>
                      ) : (
                        <button
                          className={styles.dirIconDangerBtn}
                          disabled={isPending}
                          title="Désactiver le compte"
                          onClick={() => {
                            if (!confirm(`Désactiver ${c.name ?? c.email} ?`)) return;
                            startTransition(async () => { await disableContact(c.userId); refresh(); });
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>
                          </svg>
                        </button>
                      )}

                      {/* Inviter (user/admin seulement) */}
                      {(c.role === "user" || c.role === "admin") && (
                        <button
                          className={styles.dirIconBtn}
                          disabled={isPending}
                          title="Générer un lien d'invitation"
                          onClick={() => {
                            startTransition(async () => {
                              const link = await generateInvitationLink(c.userId);
                              setInviteLink(link);
                              setInvitingUserId(c.userId);
                              setInviteCopied(false);
                            });
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </button>
                      )}

                      {/* Supprimer définitivement */}
                      <button
                        title="Supprimer définitivement"
                        className={styles.deleteRowBtn}
                        disabled={isPending}
                        style={{ marginLeft: "auto" }}
                        onClick={() => {
                          if (!confirm(`Supprimer définitivement ${c.name ?? c.email} ?\nCette action est irréversible et retire le contact de tous les plannings.`)) return;
                          startTransition(async () => { await deleteContact(c.userId); refresh(); });
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Panneau lien d'invitation (scopé à ce contact) */}
                    {inviteLink && invitingUserId === c.userId && editingId === null && (
                      <div style={{ marginTop: 8, background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column" as const, gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#0369A1" }}>Lien d&apos;invitation (7 jours)</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            readOnly
                            value={inviteLink}
                            style={{ flex: 1, fontSize: 10, padding: "4px 8px", border: "1px solid #BAE6FD", borderRadius: 6, background: "#fff", color: "#0C4A6E", fontFamily: "monospace", minWidth: 0 }}
                          />
                          <button
                            className={styles.dirTextBtn}
                            onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2500); }}
                          >
                            {inviteCopied ? "✓ Copié" : "Copier"}
                          </button>
                        </div>
                        <button style={{ background: "none", border: "none", fontSize: 10, color: "#64748B", cursor: "pointer", alignSelf: "flex-end" as const, padding: 0 }} onClick={() => setInviteLink(null)}>
                          Fermer
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Droits & Rôles tab ────────────────────────────────────────────────────────

const PERMISSION_FEATURES: { key: keyof PermissionMatrix["user"]; label: string; group: string }[] = [
  { key: "tab_general",      label: "Onglet Général",           group: "Paramètres" },
  { key: "tab_cadence",      label: "Onglet Cadence",           group: "Paramètres" },
  { key: "tab_phases",       label: "Onglet Types de phases",   group: "Paramètres" },
  { key: "tab_jalons",       label: "Onglet Types de jalons",   group: "Paramètres" },
  { key: "tab_statuts",      label: "Onglet Statuts",           group: "Paramètres" },
  { key: "tab_calendrier",   label: "Onglet Calendrier",        group: "Paramètres" },
  { key: "tab_apparence",    label: "Onglet Apparence",         group: "Paramètres" },
  { key: "tab_répertoire",   label: "Onglet Répertoire",        group: "Paramètres" },
  { key: "tab_historique",   label: "Onglet Historique",        group: "Paramètres" },
  { key: "tab_securite",     label: "Onglet Sécurité",          group: "Paramètres" },
  { key: "create_planning",  label: "Créer un planning",        group: "Actions" },
  { key: "export",           label: "Exporter (Excel, PDF, PNG)", group: "Actions" },
  { key: "share",            label: "Partager un planning",     group: "Actions" },
];

function DroitsTab({ permissions }: { permissions: PermissionMatrix }) {
  const [local, setLocal] = useState<PermissionMatrix>(permissions);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof PermissionMatrix["user"]) => {
    setLocal((prev) => ({ ...prev, user: { ...prev.user, [key]: !prev.user[key] } }));
    setSaved(false);
  };

  const groups = [...new Set(PERMISSION_FEATURES.map((f) => f.group))];

  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, marginTop: 0, lineHeight: 1.6 }}>
        Configurez quelles fonctionnalités sont accessibles par rôle.
        Les <strong>Admins</strong> ont toujours accès à tout. Les <strong>Contacts</strong> n&apos;ont pas accès à l&apos;application.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                Fonctionnalité
              </th>
              <th style={{ textAlign: "center", width: 90, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                Admin
              </th>
              <th style={{ textAlign: "center", width: 110, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                Utilisateur
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <>
                <tr key={`grp-${group}`}>
                  <td colSpan={3} style={{ padding: "12px 12px 4px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", background: "var(--klint-paper, #F6F7FB)" }}>
                    {group}
                  </td>
                </tr>
                {PERMISSION_FEATURES.filter((f) => f.group === group).map((f) => (
                  <tr key={f.key} style={{ borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--klint-navy)" }}>{f.label}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>
                      <span style={{ color: "#16A34A", fontWeight: 700, fontSize: 15 }}>✓</span>
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>
                      <button
                        type="button"
                        onClick={() => toggle(f.key)}
                        style={{
                          width: 36, height: 20, borderRadius: 999,
                          background: local.user[f.key] ? "#001036" : "#E5E7EB",
                          border: "none", cursor: "pointer", position: "relative",
                          transition: "background 150ms", flexShrink: 0,
                          display: "inline-flex", alignItems: "center",
                        }}
                        aria-checked={local.user[f.key]}
                        role="switch"
                        title={local.user[f.key] ? "Désactiver" : "Activer"}
                      >
                        <span style={{
                          position: "absolute", width: 14, height: 14, borderRadius: "50%",
                          background: "#fff", top: 3,
                          left: local.user[f.key] ? 19 : 3,
                          transition: "left 150ms",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <button
          className={styles.saveBtn}
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await savePermissions(local);
              setSaved(true);
              setTimeout(() => setSaved(false), 3000);
            });
          }}
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span style={{ fontSize: 13, color: "#16A34A", fontWeight: 600 }}>✓ Droits mis à jour</span>}
      </div>
    </div>
  );
}
