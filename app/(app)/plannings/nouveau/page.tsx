export const dynamic = "force-dynamic";

import Link from "next/link";
import { createPlanning } from "@/lib/actions/plannings";
import styles from "./NewPlanning.module.css";

const CURRENT_YEAR = new Date().getFullYear();

export default function NouveauPlanningPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Nouveau planning</h1>
        <p className={styles.subtitle}>
          Crée un planning vierge avec les types de phases et jalons par défaut.
        </p>
      </header>

      <form action={createPlanning} className={styles.form}>

        {/* Type de planning */}
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

        {/* Nom */}
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

        {/* Année + Dates */}
        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="year">Année</label>
            <input
              id="year"
              name="year"
              type="number"
              required
              min={2020}
              max={2040}
              defaultValue={CURRENT_YEAR}
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="viewStart">Début</label>
            <input
              id="viewStart"
              name="viewStart"
              type="date"
              required
              defaultValue={`${CURRENT_YEAR}-01-01`}
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="viewEnd">Fin</label>
            <input
              id="viewEnd"
              name="viewEnd"
              type="date"
              required
              defaultValue={`${CURRENT_YEAR}-12-31`}
              className={styles.input}
            />
          </div>
        </div>

        {/* Description */}
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            maxLength={500}
            rows={3}
            placeholder="Description optionnelle…"
            className={styles.textarea}
          />
        </div>

        <div className={styles.actions}>
          <Link href="/plannings" className={styles.cancelBtn}>Annuler</Link>
          <button type="submit" className={styles.submitBtn}>
            Créer le planning
          </button>
        </div>
      </form>
    </div>
  );
}
