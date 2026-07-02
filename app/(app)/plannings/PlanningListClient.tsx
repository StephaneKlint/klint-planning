"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  duplicatePlanning, archivePlanning, deletePlanning, updatePlanningMeta,
  importPlanningFromJSON, updatePlanningFromJSON,
  disablePlanning, enablePlanning, unarchivePlanning,
  restorePlanning, permanentlyDeletePlanning,
} from "@/lib/actions/plannings";
import styles from "./Plannings.module.css";

type PlanningRow = {
  id: string;
  name: string;
  year: number;
  type: string;
  archived: boolean;
  disabled: boolean;
  deletedAt: Date | null;
  viewStart: string;
  viewEnd: string;
  createdAt: Date;
  projectName: string | null;
  domainCount: number;
};

interface Props {
  active: PlanningRow[];
  archived: PlanningRow[];
  disabled: PlanningRow[];
  trashed: PlanningRow[];
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const TYPE_LABELS: Record<string, string> = {
  multi: "Multi",
  mono:  "Mono",
};

// ── Rename modal ─────────────────────────────────────────────────────────────
interface RenameModalProps {
  planning: PlanningRow;
  allProjects: string[];
  onClose: () => void;
  onSaved: () => void;
}

function RenameModal({ planning, allProjects, onClose, onSaved }: RenameModalProps) {
  const [name, setName]               = useState(planning.name);
  const [year, setYear]               = useState(String(planning.year));
  const [viewStart, setViewStart]     = useState(planning.viewStart);
  const [viewEnd, setViewEnd]         = useState(planning.viewEnd);
  const [projectName, setProjectName] = useState(planning.projectName ?? "");
  const [isPending, startT]           = useTransition();
  const [error, setError]             = useState<string | null>(null);

  const handleSave = () => {
    if (!name.trim()) { setError("Le nom est requis."); return; }
    setError(null);
    startT(async () => {
      try {
        await updatePlanningMeta({
          planningId: planning.id,
          name: name.trim(),
          year: Number(year),
          viewStart,
          viewEnd,
          projectName: projectName.trim() || null,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde.");
      }
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Modifier le planning</h2>
          <button className={styles.modalClose} onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Nom *</label>
            <input
              type="text"
              className={styles.modalInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={200}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>Projet (dossier)</label>
            <input
              type="text"
              className={styles.modalInput}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              list="project-suggestions"
              placeholder="Ex : B2B EDU, CRM Interne…"
              maxLength={100}
            />
            {allProjects.length > 0 && (
              <datalist id="project-suggestions">
                {allProjects.map((p) => <option key={p} value={p} />)}
              </datalist>
            )}
          </div>
          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Année</label>
              <input
                type="number"
                className={styles.modalInput}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min={2020} max={2040}
              />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Début</label>
              <input
                type="date"
                className={styles.modalInput}
                value={viewStart}
                onChange={(e) => setViewStart(e.target.value)}
              />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Fin</label>
              <input
                type="date"
                className={styles.modalInput}
                value={viewEnd}
                onChange={(e) => setViewEnd(e.target.value)}
              />
            </div>
          </div>
          {error && <p className={styles.modalError}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.modalCancelBtn} onClick={onClose}>Annuler</button>
          <button className={styles.modalConfirmBtn} onClick={handleSave} disabled={isPending}>
            {isPending ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Planning card ─────────────────────────────────────────────────────────────
type TabName = "active" | "archived" | "disabled" | "trashed";

interface CardProps {
  p: PlanningRow;
  tab: TabName;
  loadingId: string | null;
  loadingAction: string | null;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onRename: (p: PlanningRow) => void;
  onDuplicate: (p: PlanningRow) => void;
  onDelete: (p: PlanningRow) => void;
  onArchive?: (p: PlanningRow) => void;
  onDisable?: (p: PlanningRow) => void;
  onEnable?: (p: PlanningRow) => void;
  onUnarchive?: (p: PlanningRow) => void;
  onRestore?: (p: PlanningRow) => void;
  onPermanentDelete?: (p: PlanningRow) => void;
  isPending: boolean;
}

function PlanningCard({
  p, tab, loadingId, loadingAction,
  selected = false, onSelect,
  onRename, onDuplicate, onDelete,
  onArchive, onDisable, onEnable, onUnarchive,
  onRestore, onPermanentDelete,
  isPending,
}: CardProps) {
  const isThis = loadingId === p.id;

  return (
    <div className={`${styles.card} ${selected ? styles.cardSelected : ""}`} style={{ position: "relative" }}>
      {/* Checkbox — only for active tab */}
      {tab === "active" && onSelect && (
        <div
          className={`${styles.cardCheckbox} ${selected ? styles.cardCheckboxChecked : ""}`}
          role="checkbox"
          aria-checked={selected}
          aria-label={`Sélectionner ${p.name}`}
          tabIndex={0}
          onClick={() => onSelect(p.id)}
          onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onSelect(p.id)}
        >
          {selected && "✓"}
        </div>
      )}

      <div className={styles.cardHead}>
        <span className={styles.cardType}>{TYPE_LABELS[p.type] ?? p.type}</span>
        <span className={styles.cardYear}>{p.year}</span>
      </div>

      <div className={styles.cardTitleRow}>
        <Link href={`/p/${p.id}`} className={styles.cardTitle}>{p.name}</Link>
      </div>

      <p className={styles.cardMeta}>{fmtDate(p.viewStart)} → {fmtDate(p.viewEnd)}</p>

      {/* Icon actions bar */}
      <div className={styles.cardIconActions}>
        {/* Primary open button — masqué en corbeille */}
        {tab !== "trashed" && (
          <>
            <Link href={`/p/${p.id}`} className={styles.openBtn} style={{ fontSize: 12, padding: "5px 12px" }}>
              Ouvrir →
            </Link>
            <div className={styles.cardIconSep} />
          </>
        )}

        {/* Duplicate / JSON / Rename — masqués en corbeille */}
        {tab !== "trashed" && (
          <>
            <button
              className={styles.cardIconBtn}
              title="Dupliquer"
              aria-label="Dupliquer"
              onClick={() => onDuplicate(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "dup"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="layers" size={14} aria-hidden />}
            </button>

            <a
              href={`/api/export/${p.id}`}
              className={styles.cardIconBtn}
              title="Exporter JSON"
              aria-label="Exporter JSON"
              download
            >
              <Icon name="download" size={14} aria-hidden />
            </a>

            <div style={{ marginLeft: "auto" }} />

            <button
              className={styles.cardIconBtn}
              title="Renommer / Modifier"
              aria-label="Renommer"
              onClick={() => onRename(p)}
            >
              <Icon name="edit" size={14} aria-hidden />
            </button>

            <div className={styles.cardIconSep} />
          </>
        )}

        {/* Spacer pour la corbeille */}
        {tab === "trashed" && <div style={{ marginLeft: "auto" }} />}

        {/* Tab-specific actions */}
        {tab === "active" && (
          <>
            <button
              className={`${styles.cardIconBtn} ${styles.cardIconBtnWarning}`}
              title="Archiver"
              aria-label="Archiver"
              onClick={() => onArchive?.(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "archive"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="archive" size={14} aria-hidden />}
            </button>
            <button
              className={`${styles.cardIconBtn} ${styles.cardIconBtnWarning}`}
              title="Désactiver"
              aria-label="Désactiver"
              onClick={() => onDisable?.(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "disable"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="eyeOff" size={14} aria-hidden />}
            </button>
            <button
              className={`${styles.cardIconBtn} ${styles.cardIconBtnDanger}`}
              title="Supprimer définitivement"
              aria-label="Supprimer"
              onClick={() => onDelete(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "delete"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="trash" size={14} aria-hidden />}
            </button>
          </>
        )}

        {tab === "archived" && (
          <>
            <button
              className={styles.cardIconBtn}
              title="Restaurer (dés-archiver)"
              aria-label="Restaurer"
              onClick={() => onUnarchive?.(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "unarchive"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="undo" size={14} aria-hidden />}
            </button>
            <button
              className={`${styles.cardIconBtn} ${styles.cardIconBtnDanger}`}
              title="Supprimer définitivement"
              aria-label="Supprimer"
              onClick={() => onDelete(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "delete"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="trash" size={14} aria-hidden />}
            </button>
          </>
        )}

        {tab === "trashed" && (
          <>
            <button
              className={styles.cardIconBtn}
              title="Restaurer depuis la corbeille"
              aria-label="Restaurer"
              onClick={() => onRestore?.(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "restore"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="undo" size={14} aria-hidden />}
            </button>
            <button
              className={`${styles.cardIconBtn} ${styles.cardIconBtnDanger}`}
              title="Supprimer définitivement (irréversible)"
              aria-label="Supprimer définitivement"
              onClick={() => onPermanentDelete?.(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "perm-delete"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="trash" size={14} aria-hidden />}
            </button>
          </>
        )}

        {tab === "disabled" && (
          <>
            <button
              className={styles.cardIconBtn}
              title="Réactiver"
              aria-label="Réactiver"
              onClick={() => onEnable?.(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "enable"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="play" size={14} aria-hidden />}
            </button>
            <button
              className={`${styles.cardIconBtn} ${styles.cardIconBtnDanger}`}
              title="Supprimer définitivement"
              aria-label="Supprimer"
              onClick={() => onDelete(p)}
              disabled={isPending}
            >
              {isThis && loadingAction === "delete"
                ? <span style={{ fontSize: 11 }}>…</span>
                : <Icon name="trash" size={14} aria-hidden />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main client component ────────────────────────────────────────────────────

export function PlanningListClient({ active, archived, disabled, trashed }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId]   = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Tabs
  const [tab, setTab] = useState<TabName>("active");

  // Multi-select (active tab only)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Collapsible project sections (active tab only)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Rename modal
  const [renamePlanning, setRenamePlanning] = useState<PlanningRow | null>(null);

  // Import JSON
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending]   = useState(false);
  const [importError, setImportError]       = useState<string | null>(null);
  const [importModalText, setImportModalText] = useState<string | null>(null);
  const [importMode, setImportMode]         = useState<"create" | "update">("create");
  const [importTargetId, setImportTargetId] = useState<string>("");

  const busy = (id: string, act: string) => { setLoadingId(id); setLoadingAction(act); };
  const notBusy = () => { setLoadingId(null); setLoadingAction(null); };

  const handleTabChange = (t: TabName) => {
    setTab(t);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // ── Single actions ──

  const handleDuplicate = (p: PlanningRow) => {
    if (isPending) return;
    busy(p.id, "dup");
    startTransition(async () => {
      const newId = await duplicatePlanning(p.id);
      router.push(`/p/${newId}`);
    });
  };

  const handleDelete = (p: PlanningRow) => {
    if (!confirm(`Supprimer définitivement "${p.name}" ?\n\nTous les domaines, projets, phases et jalons seront effacés. Cette action est irréversible.`)) return;
    if (isPending) return;
    busy(p.id, "delete");
    startTransition(async () => {
      await deletePlanning(p.id);
      notBusy();
      router.refresh();
    });
  };

  const handleArchive = (p: PlanningRow) => {
    if (!confirm(`Archiver "${p.name}" ?`)) return;
    if (isPending) return;
    busy(p.id, "archive");
    startTransition(async () => {
      await archivePlanning(p.id);
      notBusy();
      router.refresh();
    });
  };

  const handleDisable = (p: PlanningRow) => {
    if (!confirm(`Désactiver "${p.name}" ?`)) return;
    if (isPending) return;
    busy(p.id, "disable");
    startTransition(async () => {
      await disablePlanning(p.id);
      notBusy();
      router.refresh();
    });
  };

  const handleEnable = (p: PlanningRow) => {
    if (isPending) return;
    busy(p.id, "enable");
    startTransition(async () => {
      await enablePlanning(p.id);
      notBusy();
      router.refresh();
    });
  };

  const handleUnarchive = (p: PlanningRow) => {
    if (isPending) return;
    busy(p.id, "unarchive");
    startTransition(async () => {
      await unarchivePlanning(p.id);
      notBusy();
      router.refresh();
    });
  };

  const handleRestore = (p: PlanningRow) => {
    if (isPending) return;
    busy(p.id, "restore");
    startTransition(async () => {
      await restorePlanning(p.id);
      notBusy();
      router.refresh();
    });
  };

  const handlePermanentDelete = (p: PlanningRow) => {
    if (!confirm(`Supprimer définitivement "${p.name}" ?\n\nCette action est irréversible — toutes les données seront effacées.`)) return;
    if (isPending) return;
    busy(p.id, "perm-delete");
    startTransition(async () => {
      await permanentlyDeletePlanning(p.id);
      notBusy();
      router.refresh();
    });
  };

  // ── Bulk actions ──

  const handleBulkArchive = () => {
    if (!confirm(`Archiver ${selected.size} planning(s) ?`)) return;
    startTransition(async () => {
      await Promise.all([...selected].map((id) => archivePlanning(id)));
      clearSelection();
      router.refresh();
    });
  };

  const handleBulkDisable = () => {
    if (!confirm(`Désactiver ${selected.size} planning(s) ?`)) return;
    startTransition(async () => {
      await Promise.all([...selected].map((id) => disablePlanning(id)));
      clearSelection();
      router.refresh();
    });
  };

  const handleBulkDelete = () => {
    if (!confirm(`Supprimer définitivement ${selected.size} planning(s) ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      await Promise.all([...selected].map((id) => deletePlanning(id)));
      clearSelection();
      router.refresh();
    });
  };

  // ── Import ──

  const handleImportClick = () => {
    setImportError(null);
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportError(null);
    let text: string;
    try {
      text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.klintPlanningExport) throw new Error("Ce fichier n'est pas un export Klint Planning valide.");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Fichier JSON invalide.");
      return;
    }
    setImportModalText(text);
    setImportMode("create");
    setImportTargetId(active[0]?.id ?? "");
  };

  const handleImportConfirm = async () => {
    if (!importModalText) return;
    setImportPending(true);
    setImportError(null);
    setImportModalText(null);
    try {
      if (importMode === "create") {
        const newId = await importPlanningFromJSON(importModalText);
        router.push(`/p/${newId}`);
      } else {
        if (!importTargetId) throw new Error("Veuillez sélectionner un planning à mettre à jour.");
        await updatePlanningFromJSON(importTargetId, importModalText);
        router.push(`/p/${importTargetId}`);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erreur lors de l'import.");
      setImportPending(false);
    }
  };

  // ── Current list ──
  const currentList = tab === "active" ? active : tab === "archived" ? archived : tab === "disabled" ? disabled : trashed;

  // Groupement par projet (onglet Actifs uniquement)
  const allProjects = [...new Set(active.map((p) => p.projectName).filter(Boolean) as string[])].sort();

  type ProjectGroup = { key: string; label: string; items: PlanningRow[] };
  const activeGroups: ProjectGroup[] = (() => {
    const byProject = new Map<string, PlanningRow[]>();
    const noProject: PlanningRow[] = [];
    for (const p of active) {
      if (p.projectName) {
        if (!byProject.has(p.projectName)) byProject.set(p.projectName, []);
        byProject.get(p.projectName)!.push(p);
      } else {
        noProject.push(p);
      }
    }
    const groups: ProjectGroup[] = [];
    for (const [name, items] of byProject) {
      groups.push({ key: name, label: name, items });
    }
    groups.sort((a, b) => a.label.localeCompare(b.label, "fr"));
    if (noProject.length > 0) {
      groups.push({ key: "__none__", label: "Sans projet", items: noProject });
    }
    return groups;
  })();

  const sharedCardProps = {
    loadingId,
    loadingAction,
    isPending,
    onRename: setRenamePlanning,
    onDuplicate: handleDuplicate,
    onDelete: handleDelete,
  };

  return (
    <>
      <input ref={importInputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleImportFile} />

      {/* Top bar with import */}
      <div className={styles.listTopBar}>
        <button className={styles.importBtn} onClick={handleImportClick} disabled={importPending}>
          {importPending ? "Import en cours…" : "⬆ Importer JSON"}
        </button>
        {importError && <span className={styles.importError}>{importError}</span>}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "active" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("active")}
        >
          Actifs ({active.length})
        </button>
        <button
          className={`${styles.tab} ${tab === "archived" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("archived")}
        >
          Archivés ({archived.length})
        </button>
        <button
          className={`${styles.tab} ${tab === "disabled" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("disabled")}
        >
          Désactivés ({disabled.length})
        </button>
        {trashed.length > 0 && (
          <button
            className={`${styles.tab} ${tab === "trashed" ? styles.tabActive : ""}`}
            onClick={() => handleTabChange("trashed")}
            style={tab !== "trashed" ? { color: "#DC2626" } : undefined}
          >
            🗑 Corbeille ({trashed.length})
          </button>
        )}
      </div>

      {/* Grid — Actifs groupés par projet, autres onglets = grille plate */}
      {currentList.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {tab === "active" ? "Aucun planning actif" : tab === "archived" ? "Aucun planning archivé" : tab === "disabled" ? "Aucun planning désactivé" : "La corbeille est vide"}
          </p>
          {tab === "active" && (
            <>
              <p className={styles.emptyDesc}>Créez votre premier planning pour démarrer ou importez un fichier JSON.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <a href="/plannings/nouveau" className={styles.emptyBtn}>+ Nouveau planning</a>
                <button className={styles.importBtn} onClick={handleImportClick} disabled={importPending}>
                  {importPending ? "Import en cours…" : "⬆ Importer JSON"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : tab === "active" ? (
        // ── Groupement par projet ─────────────────────────────────────────
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {activeGroups.map((group) => {
            const isCollapsed = collapsedSections.has(group.key);
            return (
              <div key={group.key} className={styles.sectionBlock}>
                <div
                  className={styles.sectionHeader}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleSection(group.key)}
                  onKeyDown={(e) => (e.key === " " || e.key === "Enter") && toggleSection(group.key)}
                >
                  <span className={`${styles.sectionChevron} ${isCollapsed ? styles.sectionChevronClosed : styles.sectionChevronOpen}`}>▼</span>
                  <span className={styles.sectionTitle}>
                    {group.key === "__none__" ? "Sans projet" : group.label}
                  </span>
                  <span className={styles.sectionCount}>{group.items.length}</span>
                </div>
                {!isCollapsed && (
                  <div className={styles.sectionGrid}>
                    {group.items.map((p) => (
                      <PlanningCard
                        key={p.id}
                        p={p}
                        tab="active"
                        {...sharedCardProps}
                        selected={selected.has(p.id)}
                        onSelect={toggleSelect}
                        onArchive={handleArchive}
                        onDisable={handleDisable}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // ── Grille plate (archived / disabled / trashed) ──────────────────
        <div className={styles.grid}>
          {currentList.map((p) => (
            <PlanningCard
              key={p.id}
              p={p}
              tab={tab}
              {...sharedCardProps}
              selected={false}
              onSelect={undefined}
              onArchive={handleArchive}
              onDisable={handleDisable}
              onEnable={handleEnable}
              onUnarchive={handleUnarchive}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
            />
          ))}
        </div>
      )}

      {/* Rename modal */}
      {renamePlanning && (
        <RenameModal
          planning={renamePlanning}
          allProjects={allProjects}
          onClose={() => setRenamePlanning(null)}
          onSaved={() => { setRenamePlanning(null); router.refresh(); }}
        />
      )}

      {/* Import mode modal */}
      <ImportModeModal
        open={!!importModalText}
        mode={importMode}
        onModeChange={setImportMode}
        plannings={active}
        targetId={importTargetId}
        onTargetChange={setImportTargetId}
        onConfirm={handleImportConfirm}
        onCancel={() => setImportModalText(null)}
      />

      {/* Bulk action bar */}
      {tab === "active" && selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <span>—</span>
          <button className={styles.bulkBtn} onClick={handleBulkArchive} disabled={isPending}>
            Archiver
          </button>
          <button className={styles.bulkBtn} onClick={handleBulkDisable} disabled={isPending}>
            Désactiver
          </button>
          <button className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`} onClick={handleBulkDelete} disabled={isPending}>
            Supprimer
          </button>
          <button className={styles.bulkCancelBtn} onClick={clearSelection}>
            Annuler
          </button>
        </div>
      )}
    </>
  );
}

// ── Import mode modal ────────────────────────────────────────────────────────
interface ImportModeModalProps {
  open: boolean;
  mode: "create" | "update";
  onModeChange: (m: "create" | "update") => void;
  plannings: PlanningRow[];
  targetId: string;
  onTargetChange: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function ImportModeModal({ open, mode, onModeChange, plannings, targetId, onTargetChange, onConfirm, onCancel }: ImportModeModalProps) {
  if (!open) return null;
  return (
    <div className={styles.importModalOverlay} onClick={onCancel}>
      <div className={styles.importModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.importModalHeader}>
          <h2 className={styles.importModalTitle}>Importer un planning JSON</h2>
          <button className={styles.importModalClose} onClick={onCancel} aria-label="Annuler">×</button>
        </div>
        <div className={styles.importModalBody}>
          <p className={styles.importModalHint}>Que souhaitez-vous faire avec ce fichier ?</p>
          <label className={`${styles.importModeOption} ${mode === "create" ? styles.importModeOptionActive : ""}`}>
            <input type="radio" name="importMode" value="create" checked={mode === "create"} onChange={() => onModeChange("create")} className={styles.importModeRadio} />
            <div className={styles.importModeOptionContent}>
              <span className={styles.importModeTitle}>Créer un nouveau planning</span>
              <span className={styles.importModeDesc}>Importe le fichier comme un planning indépendant.</span>
            </div>
          </label>
          <label className={`${styles.importModeOption} ${mode === "update" ? styles.importModeOptionActive : ""}`}>
            <input type="radio" name="importMode" value="update" checked={mode === "update"} onChange={() => onModeChange("update")} className={styles.importModeRadio} />
            <div className={styles.importModeOptionContent}>
              <span className={styles.importModeTitle}>Mettre à jour un planning existant</span>
              <span className={styles.importModeDesc}>Met à jour les dates, statuts et notes. Les éléments non trouvés sont ajoutés. Aucune suppression.</span>
            </div>
          </label>
          {mode === "update" && plannings.length > 0 && (
            <div className={styles.importTargetRow}>
              <label className={styles.importTargetLabel}>Planning à mettre à jour</label>
              <select className={styles.importTargetSelect} value={targetId} onChange={(e) => onTargetChange(e.target.value)}>
                {plannings.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.year})</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className={styles.importModalFooter}>
          <button className={styles.importModalCancelBtn} onClick={onCancel}>Annuler</button>
          <button className={styles.importModalConfirmBtn} onClick={onConfirm}>
            {mode === "create" ? "Importer comme nouveau" : "Mettre à jour"}
          </button>
        </div>
      </div>
    </div>
  );
}
