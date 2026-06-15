"use client";
/**
 * NouveauPlanningClient — 3-mode creation flow:
 * 1. Vide         — create empty planning
 * 2. Dupliquer    — clone any active planning
 * 3. Depuis modèle — clone a template planning with date recalculation
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPlanning, duplicatePlanning, createPlanningFromTemplate } from "@/lib/actions/plannings";
import styles from "./NewPlanning.module.css";

type Mode = "vide" | "dupliquer" | "modele";

interface PlanningItem {
  id: string;
  name: string;
  year: number;
  type: string;
  viewStart: string;
  viewEnd: string;
  isTemplate: boolean;
}

interface Props {
  plannings: PlanningItem[];
  templates: PlanningItem[];
}

const MODES: { id: Mode; icon: string; title: string; desc: string }[] = [
  {
    id: "vide",
    icon: "✨",
    title: "Planning vide",
    desc: "Créer un planning vierge et y ajouter vos domaines, projets et phases.",
  },
  {
    id: "dupliquer",
    icon: "📋",
    title: "Dupliquer un planning",
    desc: "Copier la structure complète d'un planning existant (domaines, lots, phases).",
  },
  {
    id: "modele",
    icon: "🗂️",
    title: "Depuis un modèle",
    desc: "Démarrer depuis un modèle et recaler toutes les dates sur une nouvelle date de début.",
  },
];

const CURRENT_YEAR = new Date().getFullYear();

export function NouveauPlanningClient({ plannings, templates }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("vide");
  const [selectedId, setSelectedId] = useState<string>("");
  const [dupName, setDupName] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDuplicate = () => {
    if (!selectedId) { setError("Veuillez sélectionner un planning source."); return; }
    setError(null);
    startTransition(async () => {
      try {
        const newId = await duplicatePlanning(selectedId, dupName.trim() || undefined);
        router.push(`/p/${newId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la duplication.");
      }
    });
  };

  const handleFromTemplate = () => {
    if (!selectedId) { setError("Veuillez sélectionner un modèle."); return; }
    if (!referenceDate) { setError("Veuillez saisir une date de début."); return; }
    if (!dupName.trim()) { setError("Veuillez nommer le nouveau planning."); return; }
    setError(null);
    startTransition(async () => {
      try {
        const newId = await createPlanningFromTemplate(selectedId, dupName.trim(), referenceDate);
        router.push(`/p/${newId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la création depuis le modèle.");
      }
    });
  };

  const currentList = mode === "modele" ? templates : plannings;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Nouveau planning</h1>
        <p className={styles.subtitle}>Choisissez un point de départ pour votre nouveau planning.</p>
      </header>

      {/* Mode selector */}
      <div className={styles.modeGrid}>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`${styles.modeCard} ${mode === m.id ? styles.modeCardActive : ""}`}
            onClick={() => { setMode(m.id); setSelectedId(""); setDupName(""); setReferenceDate(""); setError(null); }}
          >
            <span className={styles.modeIcon}>{m.icon}</span>
            <span className={styles.modeTitle}>{m.title}</span>
            <span className={styles.modeDesc}>{m.desc}</span>
          </button>
        ))}
      </div>

      {/* ── MODE VIDE ── */}
      {mode === "vide" && (
        <form action={createPlanning} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Type de planning</label>
            <div className={styles.typeGrid}>
              <label className={styles.typeCard}>
                <input type="radio" name="type" value="multi" defaultChecked className={styles.typeRadio} />
                <div className={styles.typeCardContent}>
                  <span className={styles.typeCardIcon}>🗂️</span>
                  <span className={styles.typeCardTitle}>Multi-projets</span>
                  <span className={styles.typeCardDesc}>
                    Plusieurs domaines et projets en parallèle. Idéal pour un portefeuille ou un plan de transformation.
                  </span>
                </div>
              </label>
              <label className={styles.typeCard}>
                <input type="radio" name="type" value="mono" className={styles.typeRadio} />
                <div className={styles.typeCardContent}>
                  <span className={styles.typeCardIcon}>📋</span>
                  <span className={styles.typeCardTitle}>Mono-projet</span>
                  <span className={styles.typeCardDesc}>
                    Un seul projet avec ses phases. Adapté à un suivi de projet CRM ou applicatif unique.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="name">
              Nom du planning <span className={styles.required}>*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={200}
              placeholder="ex. Planning CRM 2027"
              className={styles.input}
              autoFocus
            />
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="year">Année</label>
              <input
                id="year" name="year" type="number" required
                min={2020} max={2040} defaultValue={CURRENT_YEAR}
                className={styles.input}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="viewStart">Début</label>
              <input
                id="viewStart" name="viewStart" type="date" required
                defaultValue={`${CURRENT_YEAR}-01-01`} className={styles.input}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="viewEnd">Fin</label>
              <input
                id="viewEnd" name="viewEnd" type="date" required
                defaultValue={`${CURRENT_YEAR}-12-31`} className={styles.input}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="description">Description</label>
            <textarea
              id="description" name="description"
              maxLength={500} rows={3}
              placeholder="Description optionnelle…"
              className={styles.textarea}
            />
          </div>

          <div className={styles.actions}>
            <Link href="/plannings" className={styles.cancelBtn}>Annuler</Link>
            <button type="submit" className={styles.submitBtn}>Créer le planning</button>
          </div>
        </form>
      )}

      {/* ── MODE DUPLIQUER ── */}
      {mode === "dupliquer" && (
        <div className={styles.form}>
          {plannings.length === 0 ? (
            <div className={styles.emptyPickerState}>
              <span style={{ fontSize: 32 }}>📭</span>
              <p style={{ margin: "8px 0 0", color: "#6B7280", fontSize: 13 }}>
                Aucun planning actif disponible. Créez d&apos;abord un planning vide.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Planning à dupliquer <span className={styles.required}>*</span>
                </label>
                <div className={styles.planningPicker}>
                  {plannings.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.planningPickerItem} ${selectedId === p.id ? styles.planningPickerItemSelected : ""}`}
                      onClick={() => { setSelectedId(p.id); setDupName(`${p.name} (copie)`); setError(null); }}
                    >
                      <span className={styles.planningPickerIcon}>
                        {p.type === "mono" ? "📋" : "🗂️"}
                      </span>
                      <div className={styles.planningPickerText}>
                        <span className={styles.planningPickerName}>{p.name}</span>
                        <span className={styles.planningPickerMeta}>
                          {p.year} · {p.type === "mono" ? "Mono-projet" : "Multi-projets"} · {p.viewStart} → {p.viewEnd}
                        </span>
                      </div>
                      {selectedId === p.id && (
                        <span className={styles.planningPickerCheck}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {selectedId && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="dupName">
                    Nom du nouveau planning
                  </label>
                  <input
                    id="dupName"
                    type="text"
                    value={dupName}
                    onChange={(e) => setDupName(e.target.value)}
                    maxLength={200}
                    placeholder="Nom du planning dupliqué…"
                    className={styles.input}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleDuplicate()}
                  />
                </div>
              )}

              {error && <p style={{ color: "#DC2626", fontSize: 12, margin: 0 }}>{error}</p>}

              <div className={styles.actions}>
                <Link href="/plannings" className={styles.cancelBtn}>Annuler</Link>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={handleDuplicate}
                  disabled={isPending || !selectedId}
                >
                  {isPending ? "Duplication…" : "Dupliquer le planning"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODE MODÈLE ── */}
      {mode === "modele" && (
        <div className={styles.form}>
          {templates.length === 0 ? (
            <div className={styles.emptyPickerState}>
              <span style={{ fontSize: 32 }}>🗂️</span>
              <p style={{ margin: "8px 0 0", color: "#6B7280", fontSize: 13 }}>
                Aucun modèle disponible. Marquez un planning comme modèle dans ses Paramètres → Général.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Modèle à utiliser <span className={styles.required}>*</span>
                </label>
                <div className={styles.planningPicker}>
                  {currentList.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.planningPickerItem} ${selectedId === p.id ? styles.planningPickerItemSelected : ""}`}
                      onClick={() => { setSelectedId(p.id); setDupName(`${p.name} — copie`); setError(null); }}
                    >
                      <span className={styles.planningPickerIcon}>🗂️</span>
                      <div className={styles.planningPickerText}>
                        <span className={styles.planningPickerName}>{p.name}</span>
                        <span className={styles.planningPickerMeta}>
                          {p.year} · {p.type === "mono" ? "Mono-projet" : "Multi-projets"} · {p.viewStart} → {p.viewEnd}
                        </span>
                      </div>
                      {selectedId === p.id && (
                        <span className={styles.planningPickerCheck}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {selectedId && (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="tplName">
                      Nom du nouveau planning <span className={styles.required}>*</span>
                    </label>
                    <input
                      id="tplName"
                      type="text"
                      value={dupName}
                      onChange={(e) => setDupName(e.target.value)}
                      maxLength={200}
                      placeholder="ex. Planning CRM Client X 2027"
                      className={styles.input}
                      autoFocus
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="refDate">
                      Date de début du projet <span className={styles.required}>*</span>
                    </label>
                    <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 6px" }}>
                      Toutes les dates seront recalées sur cette nouvelle date de démarrage.
                    </p>
                    <input
                      id="refDate"
                      type="date"
                      value={referenceDate}
                      onChange={(e) => setReferenceDate(e.target.value)}
                      className={styles.input}
                      style={{ maxWidth: 200 }}
                    />
                  </div>
                </>
              )}

              {error && <p style={{ color: "#DC2626", fontSize: 12, margin: 0 }}>{error}</p>}

              <div className={styles.actions}>
                <Link href="/plannings" className={styles.cancelBtn}>Annuler</Link>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={handleFromTemplate}
                  disabled={isPending || !selectedId || !referenceDate || !dupName.trim()}
                >
                  {isPending ? "Création…" : "Créer depuis ce modèle"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
