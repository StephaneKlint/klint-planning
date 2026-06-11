"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { duplicatePlanning, archivePlanning, importPlanningFromJSON, updatePlanningFromJSON } from "@/lib/actions/plannings";
import styles from "./Plannings.module.css";

type PlanningRow = {
  id: string;
  name: string;
  year: number;
  type: string;
  archived: boolean;
  viewStart: string;
  viewEnd: string;
  createdAt: Date;
};

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const TYPE_LABELS: Record<string, string> = {
  multi: "Multi-projets",
  mono:  "Mono-projet",
};

export function PlanningListClient({ plannings }: { plannings: PlanningRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [action, setAction] = useState<"dup" | "archive" | null>(null);

  // Import JSON
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Import mode modal
  const [importModalText, setImportModalText] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"create" | "update">("create");
  const [importTargetId, setImportTargetId] = useState<string>("");

  const handleDuplicate = (p: PlanningRow) => {
    if (isPending) return;
    setLoadingId(p.id);
    setAction("dup");
    startTransition(async () => {
      const newId = await duplicatePlanning(p.id);
      router.push(`/p/${newId}`);
    });
  };

  const handleArchive = (p: PlanningRow) => {
    if (!confirm(`Archiver "${p.name}" ? Il ne sera plus accessible depuis la liste.`)) return;
    if (isPending) return;
    setLoadingId(p.id);
    setAction("archive");
    startTransition(async () => {
      await archivePlanning(p.id);
      setLoadingId(null);
      setAction(null);
      router.refresh();
    });
  };

  const handleImportClick = () => {
    setImportError(null);
    importInputRef.current?.click();
  };

  // After file selection: validate JSON then open choice modal
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

    // Open modal
    setImportModalText(text);
    setImportMode("create");
    setImportTargetId(plannings[0]?.id ?? "");
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

  if (plannings.length === 0) {
    return (
      <>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Aucun planning actif</p>
          <p className={styles.emptyDesc}>Créez votre premier planning pour démarrer ou importez un fichier JSON.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/plannings/nouveau" className={styles.emptyBtn}>
              + Nouveau planning
            </Link>
            <button
              className={styles.importBtn}
              onClick={handleImportClick}
              disabled={importPending}
              style={{ marginTop: 8 }}
            >
              {importPending ? "Import en cours…" : "⬆ Importer JSON"}
            </button>
          </div>
          {importError && (
            <p style={{ color: "#DC2626", fontSize: "var(--text-13)", marginTop: 8 }}>{importError}</p>
          )}
        </div>
        <ImportModeModal
          open={!!importModalText}
          mode={importMode}
          onModeChange={setImportMode}
          plannings={plannings}
          targetId={importTargetId}
          onTargetChange={setImportTargetId}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportModalText(null)}
        />
      </>
    );
  }

  return (
    <>
      {/* Import input (hidden) */}
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleImportFile}
      />

      {/* Import button */}
      <div className={styles.listTopBar}>
        <button
          className={styles.importBtn}
          onClick={handleImportClick}
          disabled={importPending}
        >
          {importPending ? "Import en cours…" : "⬆ Importer JSON"}
        </button>
        {importError && (
          <span className={styles.importError}>{importError}</span>
        )}
      </div>

      <div className={styles.grid}>
        {plannings.map((p) => {
          const isThis = loadingId === p.id;
          return (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardType}>{TYPE_LABELS[p.type] ?? p.type}</span>
                <span className={styles.cardYear}>{p.year}</span>
              </div>
              <Link href={`/p/${p.id}`} className={styles.cardTitle}>
                {p.name}
              </Link>
              <p className={styles.cardMeta}>
                {fmtDate(p.viewStart)} → {fmtDate(p.viewEnd)}
              </p>
              <div className={styles.cardActions}>
                <Link href={`/p/${p.id}`} className={styles.openBtn}>
                  Ouvrir →
                </Link>
                <button
                  className={styles.dupBtn}
                  onClick={() => handleDuplicate(p)}
                  disabled={isPending}
                  title="Dupliquer ce planning"
                >
                  {isThis && action === "dup" ? "Copie en cours…" : "⧉ Dupliquer"}
                </button>
                <a
                  href={`/api/export/${p.id}`}
                  className={styles.exportJsonBtn}
                  title="Exporter en JSON"
                  download
                >
                  ⬇ JSON
                </a>
                <button
                  className={styles.archiveBtn}
                  onClick={() => handleArchive(p)}
                  disabled={isPending}
                  title="Archiver ce planning"
                >
                  {isThis && action === "archive" ? "Archivage…" : "Archive"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Import mode modal */}
      <ImportModeModal
        open={!!importModalText}
        mode={importMode}
        onModeChange={setImportMode}
        plannings={plannings}
        targetId={importTargetId}
        onTargetChange={setImportTargetId}
        onConfirm={handleImportConfirm}
        onCancel={() => setImportModalText(null)}
      />
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
          <p className={styles.importModalHint}>
            Que souhaitez-vous faire avec ce fichier ?
          </p>

          {/* Option 1 — Créer */}
          <label className={`${styles.importModeOption} ${mode === "create" ? styles.importModeOptionActive : ""}`}>
            <input
              type="radio"
              name="importMode"
              value="create"
              checked={mode === "create"}
              onChange={() => onModeChange("create")}
              className={styles.importModeRadio}
            />
            <div className={styles.importModeOptionContent}>
              <span className={styles.importModeTitle}>Créer un nouveau planning</span>
              <span className={styles.importModeDesc}>Importe le fichier comme un planning indépendant (copie avec le suffixe « import »).</span>
            </div>
          </label>

          {/* Option 2 — Mettre à jour */}
          <label className={`${styles.importModeOption} ${mode === "update" ? styles.importModeOptionActive : ""}`}>
            <input
              type="radio"
              name="importMode"
              value="update"
              checked={mode === "update"}
              onChange={() => onModeChange("update")}
              className={styles.importModeRadio}
            />
            <div className={styles.importModeOptionContent}>
              <span className={styles.importModeTitle}>Mettre à jour un planning existant</span>
              <span className={styles.importModeDesc}>
                Met à jour les dates, statuts et notes des phases et jalons correspondants.
                Les éléments non trouvés sont ajoutés. Aucune suppression.
              </span>
            </div>
          </label>

          {/* Planning selector — only when update mode */}
          {mode === "update" && plannings.length > 0 && (
            <div className={styles.importTargetRow}>
              <label className={styles.importTargetLabel}>Planning à mettre à jour</label>
              <select
                className={styles.importTargetSelect}
                value={targetId}
                onChange={(e) => onTargetChange(e.target.value)}
              >
                {plannings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.year})
                  </option>
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
