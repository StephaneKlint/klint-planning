"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./Parametres.module.css";
import type { GanttData } from "@/lib/db/queries";
import type { AppSettings } from "@/lib/actions/appSettings";
import {
  addPhaseType, deletePhaseType, updatePhaseType,
  addMilestoneType, deleteMilestoneType, updateMilestoneType,
  updateDomainCadence, updatePlanningSettings,
} from "@/lib/actions/settings";
import { saveAppLogo, saveAppFavicon } from "@/lib/actions/appSettings";
import { seedHolidays, createClosurePeriod, updateClosurePeriod, deleteClosurePeriod } from "@/lib/actions/closurePeriods";
import { changePassword } from "@/lib/actions/authActions";
import { setTemplateFlag } from "@/lib/actions/plannings";
import type { ClosurePeriodRow, ExistingUserRow, ActivityEntry, ConnectionLogRow } from "@/lib/db/queries";
import { RessourcesClient } from "@/app/(app)/ressources/RessourcesClient";

type Tab = "general" | "cadence" | "phases" | "jalons" | "statuts" | "apparence" | "calendrier" | "securite" | "ressources" | "historique";

const TABS: { id: Tab; label: string }[] = [
  { id: "general",    label: "Général" },
  { id: "cadence",    label: "Cadence" },
  { id: "phases",     label: "Types de phases" },
  { id: "jalons",     label: "Types de jalons" },
  { id: "statuts",    label: "Statuts" },
  { id: "ressources", label: "Ressources" },
  { id: "historique", label: "Historique" },
  { id: "apparence",  label: "Apparence" },
  { id: "calendrier", label: "Calendrier" },
  { id: "securite",   label: "Sécurité" },
];

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
  existingUsers?: ExistingUserRow[];
  activityEntries?: ActivityEntry[];
  connLogs?: ConnectionLogRow[];
}

export function ParametresTabs({ data, appCfg, existingUsers = [], activityEntries = [], connLogs = [] }: ParametresTabsProps) {
  const router = useRouter();
  const [active, setActive] = useState<Tab>("general");
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
        {TABS.map((t) => (
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

      {/* ── Ressources ──────────────────────────────────────────────────── */}
      {active === "ressources" && (
        <div className={styles.tabPanel} style={{ padding: 0 }}>
          <RessourcesClient data={data} existingUsers={existingUsers} />
        </div>
      )}

      {/* ── Historique ──────────────────────────────────────────────────── */}
      {active === "historique" && (
        <HistoriquePanel activityEntries={activityEntries} connLogs={connLogs} />
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
