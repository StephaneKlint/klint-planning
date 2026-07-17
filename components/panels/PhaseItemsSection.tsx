"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  createPhaseItem, updatePhaseItem, deletePhaseItem, submitPhaseItemImport, getPhaseItemImport,
} from "@/lib/actions/phase-items";
import styles from "./PhaseItemsSection.module.css";

type ItemStatus = "todo" | "doing" | "done" | "cancelled";

type PhaseItem = {
  id: string;
  phaseId: string;
  title: string;
  detail: string | null;
  date: string | null;
  status: ItemStatus;
  sortOrder: number;
};

const STATUS_META: Record<ItemStatus, { label: string; cls: string }> = {
  todo:      { label: "À faire",  cls: styles.sTodo },
  doing:     { label: "En cours", cls: styles.sDoing },
  done:      { label: "Fait",     cls: styles.sDone },
  cancelled: { label: "Annulé",   cls: styles.sCancelled },
};
const STATUS_CYCLE: ItemStatus[] = ["todo", "doing", "done", "cancelled"];

function fmtDate(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

function parseLocalFile(file: File): Promise<Omit<PhaseItem, "id" | "phaseId" | "sortOrder">[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const ext = file.name.split(".").pop()?.toLowerCase();
      try {
        if (ext === "json") {
          const arr = JSON.parse(text);
          if (!Array.isArray(arr)) throw new Error("JSON doit être un tableau");
          resolve(arr.map((it: Record<string, string>) => ({
            title: String(it.title || it.Titre || "").slice(0, 300),
            detail: it.detail ?? it.Détail ?? null,
            date: it.date ?? null,
            status: (["todo","doing","done","cancelled"].includes(it.status) ? it.status : "todo") as ItemStatus,
          })));
        } else if (ext === "md") {
          const lines = text.split("\n").filter(l => /^[-*]\s/.test(l.trim()));
          resolve(lines.map(l => {
            const clean = l.replace(/^[-*]\s+/, "").trim();
            const [title, ...rest] = clean.split(/\s*:\s*/);
            return { title: title.slice(0, 300), detail: rest.join(": ") || null, date: null, status: "todo" as ItemStatus };
          }));
        } else if (ext === "csv") {
          const rows = text.split("\n").filter(Boolean);
          const headers = rows[0].split(",").map(h => h.trim().toLowerCase());
          resolve(rows.slice(1).map(r => {
            const cols = r.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
            return {
              title: (obj.title || obj.titre || "").slice(0, 300),
              detail: obj.detail || obj.description || null,
              date: obj.date || null,
              status: (["todo","doing","done","cancelled"].includes(obj.status) ? obj.status : "todo") as ItemStatus,
            };
          }).filter(it => it.title));
        } else {
          reject(new Error("Format non supporté. Utilisez .json, .md ou .csv"));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsText(file);
  });
}

interface Props {
  phaseId: string;
  planningId: string;
  phaseColor?: string;
}

export function PhaseItemsSection({ phaseId, phaseColor = "#3B82F6" }: Props) {
  const [items, setItems] = useState<PhaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<"table" | "cards">("table");
  const [isPending, startTransition] = useTransition();

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDetail, setFormDetail] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStatus, setFormStatus] = useState<ItemStatus>("todo");

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<"text" | "file">("text");
  const [importText, setImportText] = useState("");
  const [importParsed, setImportParsed] = useState<Omit<PhaseItem, "id" | "phaseId" | "sortOrder">[] | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "pending" | "polling" | "done" | "error">("idle");
  const [importError, setImportError] = useState<string | null>(null);

  const loadItems = useCallback(() => {
    fetch(`/api/phase-items/${phaseId}`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [phaseId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const openAdd = () => {
    setEditingId(null);
    setFormTitle(""); setFormDetail(""); setFormDate(""); setFormStatus("todo");
    setShowAddForm(true);
  };

  const openEdit = (item: PhaseItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDetail(item.detail ?? "");
    setFormDate(item.date ?? "");
    setFormStatus(item.status);
    setShowAddForm(true);
  };

  const cancelForm = () => { setShowAddForm(false); setEditingId(null); };

  const saveForm = () => {
    if (!formTitle.trim()) return;
    startTransition(async () => {
      if (editingId) {
        await updatePhaseItem({ id: editingId, phaseId, title: formTitle, detail: formDetail || null, date: formDate || null, status: formStatus });
      } else {
        await createPhaseItem({ phaseId, title: formTitle, detail: formDetail || null, date: formDate || null, status: formStatus });
      }
      cancelForm();
      loadItems();
    });
  };

  const cycleStatus = (item: PhaseItem) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length];
    startTransition(async () => {
      await updatePhaseItem({ id: item.id, phaseId, status: next });
      loadItems();
    });
  };

  const removeItem = (item: PhaseItem) => {
    if (!confirm(`Supprimer "${item.title}" ?`)) return;
    startTransition(async () => {
      await deletePhaseItem(item.id, phaseId);
      loadItems();
    });
  };

  // ── Import via Claude (texte) ──
  const submitImportText = async () => {
    if (!importText.trim()) return;
    setImportStatus("pending");
    setImportError(null);
    try {
      const { jobId } = await submitPhaseItemImport(phaseId, importText);
      setImportStatus("polling");
      pollJob(jobId);
    } catch {
      setImportStatus("error");
      setImportError("Erreur lors de l'envoi. Réessayez.");
    }
  };

  const pollJob = (jobId: string) => {
    const interval = setInterval(async () => {
      const job = await getPhaseItemImport(jobId);
      if (!job) { clearInterval(interval); setImportStatus("error"); setImportError("Job introuvable."); return; }
      if (job.status === "done") {
        clearInterval(interval);
        setImportStatus("done");
        loadItems();
        setShowImport(false);
        setImportText("");
        setImportStatus("idle");
      } else if (job.status === "error") {
        clearInterval(interval);
        setImportStatus("error");
        setImportError(job.errorMsg ?? "Erreur lors du traitement.");
      }
    }, 5000);
    // Auto-stop after 3 minutes
    setTimeout(() => clearInterval(interval), 180_000);
  };

  // ── Import fichier local ──
  const handleFile = async (file: File) => {
    setImportError(null);
    try {
      const parsed = await parseLocalFile(file);
      setImportParsed(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Erreur de lecture");
    }
  };

  const confirmFileImport = () => {
    if (!importParsed) return;
    startTransition(async () => {
      for (const it of importParsed) {
        await createPhaseItem({ phaseId, title: it.title, detail: it.detail, date: it.date, status: it.status });
      }
      setImportParsed(null);
      setShowImport(false);
      loadItems();
    });
  };

  const done  = items.filter(i => i.status === "done").length;
  const active = items.filter(i => i.status !== "cancelled").length;
  const pct   = active > 0 ? Math.round((done / active) * 100) : 0;

  if (loading) return <div className={styles.loading}>Chargement…</div>;

  return (
    <div className={styles.root}>
      {/* Section header */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Éléments de la phase</span>
        {items.length > 0 && (
          <span className={styles.badge}>{items.length}</span>
        )}
        <div className={styles.layoutSw}>
          <button
            className={`${styles.lswBtn} ${layout === "table" ? styles.lswActive : ""}`}
            onClick={() => setLayout("table")}
            title="Vue liste"
          >
            ☰
          </button>
          <button
            className={`${styles.lswBtn} ${layout === "cards" ? styles.lswActive : ""}`}
            onClick={() => setLayout("cards")}
            title="Vue cartes"
          >
            ▦
          </button>
        </div>
        <button
          className={styles.importBtn}
          onClick={() => { setShowImport(v => !v); setImportParsed(null); setImportError(null); }}
          title="Importer des éléments"
        >
          ↑ Importer
        </button>
      </div>

      {/* Progress hint */}
      {items.length > 0 && (
        <div className={styles.progressHint}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.progressLabel}>{done}/{active} terminés · {pct}%</span>
        </div>
      )}

      {/* Import panel */}
      {showImport && (
        <div className={styles.importPanel}>
          <div className={styles.importTabs}>
            <button
              className={`${styles.importTab} ${importTab === "text" ? styles.importTabActive : ""}`}
              onClick={() => setImportTab("text")}
            >
              Coller du texte
            </button>
            <button
              className={`${styles.importTab} ${importTab === "file" ? styles.importTabActive : ""}`}
              onClick={() => setImportTab("file")}
            >
              Fichier (.json / .md / .csv)
            </button>
          </div>

          {importTab === "text" && (
            <div>
              <textarea
                className={styles.importTextarea}
                placeholder={"ATL-01 — 9 juillet : Kickoff ateliers\nATL-02 — 14 sept. : Gestion contacts\n..."}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={5}
                disabled={importStatus === "polling"}
              />
              {importStatus === "polling" && (
                <p className={styles.importPending}>
                  ⏳ Analyse en cours avec Claude… (peut prendre 30-60s)
                </p>
              )}
              {importError && <p className={styles.importError}>{importError}</p>}
              <div className={styles.importActions}>
                <button className={styles.btnSm} onClick={() => { setShowImport(false); setImportText(""); setImportStatus("idle"); }}>
                  Annuler
                </button>
                <button
                  className={`${styles.btnSm} ${styles.btnPrimary}`}
                  onClick={submitImportText}
                  disabled={!importText.trim() || importStatus === "polling"}
                >
                  {importStatus === "polling" ? "Traitement…" : "Analyser avec Claude"}
                </button>
              </div>
            </div>
          )}

          {importTab === "file" && (
            <div>
              <label className={styles.fileZone}>
                <input
                  type="file"
                  accept=".json,.md,.csv"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <span>Glissez ou cliquez pour choisir</span>
                <span className={styles.fileHint}>.json · .md · .csv</span>
              </label>
              {importError && <p className={styles.importError}>{importError}</p>}
              {importParsed && (
                <div>
                  <p className={styles.parsedCount}>{importParsed.length} élément{importParsed.length !== 1 ? "s" : ""} détecté{importParsed.length !== 1 ? "s" : ""}</p>
                  <div className={styles.parsedPreview}>
                    {importParsed.slice(0, 5).map((it, i) => (
                      <div key={i} className={styles.parsedRow}>✓ {it.title}</div>
                    ))}
                    {importParsed.length > 5 && <div className={styles.parsedRow} style={{ color: "var(--klint-ink3)" }}>…et {importParsed.length - 5} autres</div>}
                  </div>
                  <div className={styles.importActions}>
                    <button className={styles.btnSm} onClick={() => setImportParsed(null)}>Annuler</button>
                    <button className={`${styles.btnSm} ${styles.btnPrimary}`} onClick={confirmFileImport} disabled={isPending}>
                      {isPending ? "Import…" : `Importer ${importParsed.length} élément${importParsed.length !== 1 ? "s" : ""}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      {items.length === 0 && !showAddForm ? (
        <p className={styles.emptyState}>Aucun élément. Ajoutez ou importez ci-dessous.</p>
      ) : layout === "table" ? (
        <table className={styles.table} aria-label="Éléments de la phase">
          <tbody>
            {items.map((item, i) => {
              const s = STATUS_META[item.status];
              return (
                <tr key={item.id} className={styles.tableRow} style={item.status === "cancelled" ? { opacity: 0.55 } : {}}>
                  <td className={styles.colNum}>{String(i + 1).padStart(2, "0")}</td>
                  <td className={styles.colContent}>
                    <div className={styles.itemTitle} style={item.status === "cancelled" ? { textDecoration: "line-through" } : {}}>
                      {item.title}
                    </div>
                    {item.detail && <div className={styles.itemDetail}>{item.detail}</div>}
                  </td>
                  <td className={styles.colMeta}>
                    {item.date && <span className={styles.dateChip}>📅 {fmtDate(item.date)}</span>}
                    <button className={`${styles.statusPill} ${s.cls}`} onClick={() => cycleStatus(item)} title="Changer le statut">
                      {s.label}
                    </button>
                  </td>
                  <td className={styles.colActs}>
                    <button className={styles.actBtn} onClick={() => openEdit(item)} aria-label="Modifier">✎</button>
                    <button className={`${styles.actBtn} ${styles.actDanger}`} onClick={() => removeItem(item)} aria-label="Supprimer">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className={styles.cardList}>
          {items.map((item, i) => {
            const s = STATUS_META[item.status];
            const accent = item.status === "done" ? "#16A34A" : item.status === "doing" ? "#3B82F6" : item.status === "cancelled" ? "#DC2626" : phaseColor;
            return (
              <div key={item.id} className={styles.card} style={{ borderLeftColor: accent, opacity: item.status === "cancelled" ? 0.6 : 1 }}>
                <div className={styles.cardRow}>
                  <span className={styles.cardNum}>{String(i + 1).padStart(2, "0")}</span>
                  <div className={styles.cardMain}>
                    <p className={styles.cardTitle} style={item.status === "cancelled" ? { textDecoration: "line-through" } : {}}>{item.title}</p>
                    {item.detail && <p className={styles.cardDetail}>{item.detail}</p>}
                    <div className={styles.cardMeta}>
                      {item.date && <span className={styles.dateChip}>📅 {fmtDate(item.date)}</span>}
                      <button className={`${styles.statusPill} ${s.cls}`} onClick={() => cycleStatus(item)} title="Changer le statut">
                        {s.label}
                      </button>
                    </div>
                  </div>
                  <div className={styles.cardActs}>
                    <button className={styles.actBtn} onClick={() => openEdit(item)} aria-label="Modifier">✎</button>
                    <button className={`${styles.actBtn} ${styles.actDanger}`} onClick={() => removeItem(item)} aria-label="Supprimer">✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline form */}
      {showAddForm && (
        <div className={styles.form}>
          <p className={styles.formTitle}>{editingId ? "Modifier" : "Nouvel élément"}</p>
          <input
            className={styles.formInput}
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Titre *"
            autoFocus
          />
          <textarea
            className={styles.formTextarea}
            value={formDetail}
            onChange={e => setFormDetail(e.target.value)}
            placeholder="Détail (optionnel)"
            rows={2}
          />
          <div className={styles.formMeta}>
            <div style={{ flex: 1 }}>
              <label className={styles.formLabel}>Date</label>
              <input type="date" className={styles.formInput} value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className={styles.formLabel}>Statut</label>
              <select className={styles.formSelect} value={formStatus} onChange={e => setFormStatus(e.target.value as ItemStatus)}>
                <option value="todo">À faire</option>
                <option value="doing">En cours</option>
                <option value="done">Fait</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.btnSm} onClick={cancelForm}>Annuler</button>
            <button className={`${styles.btnSm} ${styles.btnPrimary}`} onClick={saveForm} disabled={!formTitle.trim() || isPending}>
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showAddForm && (
        <button className={styles.addBtn} onClick={openAdd}>
          + Ajouter un élément
        </button>
      )}
    </div>
  );
}
