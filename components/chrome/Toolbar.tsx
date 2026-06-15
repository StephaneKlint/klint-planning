/**
 * Toolbar — 48px, 3 groups: left (panel toggle + today + zoom + dates) | right (display toggles)
 */
"use client";

import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
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
  /** @deprecated Use onToggleDomainBands instead */
  onVisibilityClick?: () => void;
  /** @deprecated Use onColorModeChange instead */
  onColorModeClick?: () => void;
  onSearchClick?: () => void;
  onExportPdf?: () => void;
  exportPdfPending?: boolean;
  onExportPng?: () => void;
  exportPngPending?: boolean;
  onExportExcel?: () => void;
  onExportJson?: () => void;
  onShare?: () => void;
  onImportJson?: () => void;
  onProjectFilter?: () => void;
  projectFilterActive?: boolean;
  /** @deprecated Use colorMode instead */
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
  // New display options
  showDomainBands?: boolean;
  showWeekends?: boolean;
  showResponsables?: boolean;
  showHolidays?: boolean;
  showClosures?: boolean;
  onToggleDomainBands?: () => void;
  onToggleWeekends?: () => void;
  onToggleResponsables?: () => void;
  onToggleHolidays?: () => void;
  onToggleClosures?: () => void;
  colorMode?: "domain" | "status" | "person";
  onColorModeChange?: (mode: "domain" | "status" | "person") => void;
  // Baseline
  hasBaseline?: boolean;
  showBaseline?: boolean;
  onToggleBaseline?: () => void;
  onCreateBaseline?: () => void;
  onDeleteBaseline?: () => void;
}

const ZOOM_LEVELS: ZoomLevel[] = ["1m", "3m", "6m", "12m"];

export function Toolbar({
  zoom = "12m",
  onZoomChange,
  onTodayClick,
  onTogglePanel,
  onScrollPrev,
  onScrollNext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onVisibilityClick: _onVisibilityClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onColorModeClick: _onColorModeClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSearchClick: _onSearchClick,
  onExportPdf,
  exportPdfPending = false,
  onExportPng,
  exportPngPending = false,
  onExportExcel,
  onExportJson,
  onShare,
  onImportJson,
  onProjectFilter,
  projectFilterActive = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  colorModeLabel: _colorModeLabel,
  presenceStack,
  panelVisible = true,
  filterStart,
  filterEnd,
  onFilterDatesChange,
  onClearFilter,
  canUndo = false,
  onUndo,
  showDomainBands,
  showWeekends,
  showResponsables,
  showHolidays,
  showClosures,
  onToggleDomainBands,
  onToggleWeekends,
  onToggleResponsables,
  onToggleHolidays,
  onToggleClosures,
  colorMode,
  onColorModeChange,
  hasBaseline = false,
  showBaseline = false,
  onToggleBaseline,
  onCreateBaseline,
  onDeleteBaseline,
}: ToolbarProps) {
  const hasFilter = !!(filterStart || filterEnd);

  const [affichageOpen, setAffichageOpen] = useState(false);
  const affichageRef = useRef<HTMLDivElement>(null);
  const affichageBtnRef = useRef<HTMLButtonElement>(null);
  const [affichagePos, setAffichagePos] = useState<{ top: number; left: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const [exportPos, setExportPos] = useState<{ top: number; right: number } | null>(null);

  const closeOnOutside = useCallback((ref: React.RefObject<HTMLDivElement | null>, setter: (v: boolean) => void) => {
    return (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setter(false);
    };
  }, []);

  useEffect(() => {
    if (!affichageOpen) return;
    const handler = closeOnOutside(affichageRef, setAffichageOpen);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [affichageOpen, closeOnOutside]);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = closeOnOutside(exportRef, setExportOpen);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen, closeOnOutside]);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Barre d'outils du planning">
      {/* Groupe gauche — Navigation + Dates */}
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

        <div className={styles.divider} aria-hidden />

        {/* Date range filter — within left group */}
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

      {/* Groupe droite — Affichage + Présence + export */}
      <div className={`${styles.group} ${styles.groupRight}`}>
        {/* Groupe Affichage — dropdown */}
        <div ref={affichageRef} style={{ position: "relative" }}>
          <button
            ref={affichageBtnRef}
            className={`${styles.btn} ${affichageOpen ? styles.btnActive : ""}`}
            onClick={() => {
              if (affichageBtnRef.current) {
                const r = affichageBtnRef.current.getBoundingClientRect();
                setAffichagePos({ top: r.bottom + 6, left: r.left });
              }
              setAffichageOpen((o) => !o);
            }}
            aria-label="Options d'affichage"
            title="Affichage"
          >
            <Icon name="eye" size={14} />
            <span>Affichage</span>
            <span style={{ fontSize: 10, marginLeft: 2 }}>{affichageOpen ? "▲" : "▼"}</span>
          </button>

          {affichageOpen && affichagePos && (
            <div
              className={styles.affichageDropdown}
              style={{ position: "fixed", top: affichagePos.top, left: affichagePos.left, right: "auto", zIndex: 9999 } as CSSProperties}
            >
              {/* Visibilité */}
              <p className={styles.dropdownSection}>Éléments visibles</p>
              {[
                { label: "Bandes de domaines", active: showDomainBands,   toggle: onToggleDomainBands },
                { label: "Week-ends",          active: showWeekends,      toggle: onToggleWeekends },
                { label: "Responsables",       active: showResponsables,  toggle: onToggleResponsables },
                { label: "Jours fériés",       active: showHolidays,      toggle: onToggleHolidays },
                { label: "Fermetures / Gel",   active: showClosures,      toggle: onToggleClosures },
              ].map(({ label, active, toggle }) => (
                <button
                  key={label}
                  className={styles.dropdownItem}
                  onClick={toggle}
                >
                  <span className={styles.dropdownCheck}>{active ? "✓" : ""}</span>
                  {label}
                </button>
              ))}

              <div className={styles.dropdownDivider} />

              {/* Baseline */}
              <p className={styles.dropdownSection}>Plan de référence</p>
              {hasBaseline && (
                <button className={styles.dropdownItem} onClick={onToggleBaseline}>
                  <span className={styles.dropdownCheck}>{showBaseline ? "✓" : ""}</span>
                  Afficher la baseline
                </button>
              )}
              <button className={styles.dropdownItem} onClick={onCreateBaseline}>
                <span className={styles.dropdownCheck} />
                {hasBaseline ? "Recréer la baseline" : "Créer une baseline"}
              </button>
              {hasBaseline && (
                <button className={styles.dropdownItem} onClick={onDeleteBaseline} style={{ color: "#DC2626" }}>
                  <span className={styles.dropdownCheck} />
                  Supprimer la baseline
                </button>
              )}

              <div className={styles.dropdownDivider} />

              {/* Coloration */}
              <p className={styles.dropdownSection}>Coloration des phases</p>
              {(["domain", "status", "person"] as const).map((m) => (
                <button
                  key={m}
                  className={styles.dropdownItem}
                  onClick={() => { onColorModeChange?.(m); }}
                >
                  <span className={styles.dropdownCheck}>{colorMode === m ? "●" : ""}</span>
                  {m === "domain" ? "Par domaine" : m === "status" ? "Par statut" : "Par responsable"}
                </button>
              ))}
            </div>
          )}
        </div>

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

        {/* Partager — lien lecture seule */}
        {onShare && (
          <button
            className={styles.btn}
            onClick={onShare}
            aria-label="Partager le planning"
            title="Partager en lecture seule"
          >
            <Icon name="share" size={14} />
            <span>Partager</span>
          </button>
        )}

        {/* Exporter — dropdown unifié */}
        {(onExportPdf || onExportPng || onExportExcel || onExportJson || onImportJson) && (
          <div ref={exportRef} style={{ position: "relative" }}>
            <button
              ref={exportBtnRef}
              className={`${styles.btn} ${exportOpen ? styles.btnActive : ""}`}
              onClick={() => {
                if (exportBtnRef.current) {
                  const r = exportBtnRef.current.getBoundingClientRect();
                  setExportPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
                }
                setExportOpen((o) => !o);
              }}
              disabled={exportPdfPending || exportPngPending}
              aria-label="Options d'export"
              title="Exporter le planning"
            >
              <Icon name="download" size={14} />
              <span>{exportPdfPending || exportPngPending ? "Capture…" : "Exporter"}</span>
              <span style={{ fontSize: 10, marginLeft: 2 }}>{exportOpen ? "▲" : "▼"}</span>
            </button>

            {exportOpen && exportPos && (
              <div
                className={styles.affichageDropdown}
                style={{ position: "fixed", top: exportPos.top, right: exportPos.right, zIndex: 9999 } as CSSProperties}
              >
                {(onExportPdf || onExportPng) && (
                  <>
                    <p className={styles.dropdownSection}>Visuels</p>
                    {onExportPdf && (
                      <button
                        className={styles.dropdownItem}
                        onClick={() => { setExportOpen(false); onExportPdf(); }}
                        disabled={exportPdfPending || exportPngPending}
                      >
                        <span className={styles.dropdownCheck} />
                        PDF A3 paysage
                      </button>
                    )}
                    {onExportPng && (
                      <button
                        className={styles.dropdownItem}
                        onClick={() => { setExportOpen(false); onExportPng(); }}
                        disabled={exportPngPending || exportPdfPending}
                      >
                        <span className={styles.dropdownCheck} />
                        PNG ×3 — PowerPoint
                      </button>
                    )}
                  </>
                )}
                {(onExportPdf || onExportPng) && (onExportExcel || onExportJson) && (
                  <div className={styles.dropdownDivider} />
                )}
                {(onExportExcel || onExportJson) && (
                  <>
                    <p className={styles.dropdownSection}>Données</p>
                    {onExportExcel && (
                      <button
                        className={styles.dropdownItem}
                        onClick={() => { setExportOpen(false); onExportExcel(); }}
                      >
                        <span className={styles.dropdownCheck} />
                        Excel .xlsx
                      </button>
                    )}
                    {onExportJson && (
                      <button
                        className={styles.dropdownItem}
                        onClick={() => { setExportOpen(false); onExportJson(); }}
                      >
                        <span className={styles.dropdownCheck} />
                        JSON
                      </button>
                    )}
                  </>
                )}
                {onImportJson && (
                  <>
                    <div className={styles.dropdownDivider} />
                    <p className={styles.dropdownSection}>Import</p>
                    <button
                      className={styles.dropdownItem}
                      onClick={() => { setExportOpen(false); onImportJson(); }}
                    >
                      <span className={styles.dropdownCheck} />
                      Mettre à jour depuis JSON
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Toolbar;
