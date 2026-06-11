/**
 * Toolbar — 48px, 3 groups: left (panel toggle + today + zoom) | center (search + filters) | right (display toggles)
 */
"use client";

import { Icon } from "@/components/ui/Icon";
import styles from "./Toolbar.module.css";

export type ZoomLevel = "1m" | "3m" | "6m" | "12m";

interface ToolbarProps {
  zoom?: ZoomLevel;
  onZoomChange?: (zoom: ZoomLevel) => void;
  onTodayClick?: () => void;
  onTogglePanel?: () => void;
  onScrollPrev?: () => void;
  onScrollNext?: () => void;
  onVisibilityClick?: () => void;
  onColorModeClick?: () => void;
  onSearchClick?: () => void;
  onExportPdf?: () => void;
  exportPdfPending?: boolean;
  onExportJson?: () => void;
  onProjectFilter?: () => void;
  projectFilterActive?: boolean;
  colorModeLabel?: string;
  presenceStack?: React.ReactNode;
  panelVisible?: boolean;
  // Date range filter
  filterStart?: string | null;
  filterEnd?: string | null;
  onFilterDatesChange?: (start: string | null, end: string | null) => void;
  onClearFilter?: () => void;
  // Undo
  canUndo?: boolean;
  onUndo?: () => void;
}

const ZOOM_LEVELS: ZoomLevel[] = ["1m", "3m", "6m", "12m"];

export function Toolbar({
  zoom = "12m",
  onZoomChange,
  onTodayClick,
  onTogglePanel,
  onScrollPrev,
  onScrollNext,
  onVisibilityClick,
  onColorModeClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSearchClick: _onSearchClick,
  onExportPdf,
  exportPdfPending = false,
  onExportJson,
  onProjectFilter,
  projectFilterActive = false,
  colorModeLabel = "Domaine",
  presenceStack,
  panelVisible = true,
  filterStart,
  filterEnd,
  onFilterDatesChange,
  onClearFilter,
  canUndo = false,
  onUndo,
}: ToolbarProps) {
  const hasFilter = !!(filterStart || filterEnd);
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Barre d'outils du planning">
      {/* Groupe gauche — Navigation */}
      <div className={styles.group}>
        <button
          className={`${styles.btn} ${!panelVisible ? styles.btnActive : ""}`}
          onClick={onTogglePanel}
          aria-label="Masquer/Afficher le panneau"
          title="Masquer/Afficher le panneau ([)"
        >
          <Icon name="layers" size={14} />
        </button>

        <button
          className={styles.btn}
          onClick={onTodayClick}
          aria-label="Aller à aujourd'hui"
          title="Aller à aujourd'hui"
        >
          <Icon name="today" size={14} />
          <span>Aujourd&apos;hui</span>
        </button>

        <div className={styles.zoomSwitch} role="radiogroup" aria-label="Niveau de zoom">
          {ZOOM_LEVELS.map((z) => (
            <button
              key={z}
              className={`${styles.zoomBtn} ${zoom === z ? styles.zoomActive : ""}`}
              onClick={() => onZoomChange?.(z)}
              aria-pressed={zoom === z}
              aria-label={`Afficher ${z}`}
            >
              {z}
            </button>
          ))}
        </div>

        {/* Prev / Next navigation — visible for zooms < 12m */}
        {zoom !== "12m" && (
          <div className={styles.navArrows}>
            <button
              className={styles.arrowBtn}
              onClick={onScrollPrev}
              aria-label="Période précédente"
              title="Période précédente"
            >
              ‹
            </button>
            <button
              className={styles.arrowBtn}
              onClick={onScrollNext}
              aria-label="Période suivante"
              title="Période suivante"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className={styles.divider} aria-hidden />

      {/* Groupe centre — Filtres */}
      <div className={`${styles.group} ${styles.groupCenter}`}>
        <button
          className={styles.btn}
          onClick={onVisibilityClick}
          aria-label="Affichage des lots"
          title="Afficher/masquer domaines et lots"
        >
          <Icon name="eye" size={14} />
          <span>Affichage</span>
        </button>

        <button
          className={styles.btn}
          onClick={onColorModeClick}
          aria-label={`Coloration : ${colorModeLabel}`}
          title="Changer le mode de coloration"
        >
          <Icon name="filter" size={14} />
          <span>{colorModeLabel}</span>
        </button>

        <div className={`${styles.dateFilterGroup} ${hasFilter ? styles.dateFilterGroupActive : ""}`}>
          <span className={styles.dateFilterLabel}>Du</span>
          <input
            type="date"
            className={styles.dateFilterInput}
            value={filterStart ?? ""}
            title="Début de la période affichée"
            onChange={(e) => onFilterDatesChange?.(e.target.value || null, filterEnd ?? null)}
          />
          <span className={styles.dateFilterLabel}>au</span>
          <input
            type="date"
            className={styles.dateFilterInput}
            value={filterEnd ?? ""}
            title="Fin de la période affichée"
            onChange={(e) => onFilterDatesChange?.(filterStart ?? null, e.target.value || null)}
          />
          {hasFilter && (
            <button
              className={styles.clearFilterBtn}
              onClick={onClearFilter}
              title="Effacer le filtre de dates"
              aria-label="Effacer le filtre de dates"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className={styles.divider} aria-hidden />

      {/* Groupe droite — Présence + export */}
      <div className={`${styles.group} ${styles.groupRight}`}>
        {presenceStack}

        {/* Undo */}
        {onUndo && (
          <button
            className={styles.btn}
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Annuler la dernière action (Ctrl+Z)"
            title="Annuler (Ctrl+Z)"
            style={!canUndo ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
          >
            <Icon name="undo" size={14} />
          </button>
        )}

        {/* Filtrer les projets */}
        <button
          className={`${styles.btn} ${projectFilterActive ? styles.btnActive : ""}`}
          onClick={onProjectFilter}
          aria-label="Filtrer les projets affichés"
          title="Afficher / masquer des projets"
        >
          <Icon name="sort" size={14} />
          <span>Projets</span>
        </button>

        {/* Export JSON */}
        {onExportJson && (
          <button
            className={styles.btn}
            onClick={onExportJson}
            aria-label="Exporter en JSON"
            title="Exporter le planning en JSON"
          >
            <Icon name="download" size={14} />
            <span>JSON</span>
          </button>
        )}

        {/* Export PDF A3 */}
        {onExportPdf && (
          <button
            className={`${styles.btn} ${styles.exportBtn}`}
            onClick={onExportPdf}
            disabled={exportPdfPending}
            aria-label="Exporter en PDF A3"
            title="Aperçu et impression A3 paysage"
          >
            <Icon name="download" size={14} />
            <span>{exportPdfPending ? "Capture…" : "PDF A3"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default Toolbar;
