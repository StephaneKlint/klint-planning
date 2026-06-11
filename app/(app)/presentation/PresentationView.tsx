"use client";
/**
 * PresentationView — Affichage Gantt en mode présentation / plein écran.
 * Aucun EditPanel, BulkBar ni CommandPalette. Barre de contrôle minimaliste.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Gantt } from "@/components/gantt/Gantt";
import { useGanttStore } from "@/store/ganttStore";
import type { GanttData } from "@/lib/db/queries";
import type { ZoomLevel } from "@/store/ganttStore";
import styles from "./Presentation.module.css";

const ZOOM_LABELS: Record<ZoomLevel, string> = {
  "1m": "1 mois",
  "3m": "3 mois",
  "6m": "6 mois",
  "12m": "12 mois",
};

const ZOOM_ORDER: ZoomLevel[] = ["1m", "3m", "6m", "12m"];

interface Props {
  data: GanttData;
  planningId: string;
}

export function PresentationView({ data, planningId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    zoom, setZoom,
    requestScroll,
  } = useGanttStore();

  // Écoute les changements d'état plein écran
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!isFullscreen) {
      try {
        await containerRef.current?.requestFullscreen();
      } catch {
        // Safari / iOS : fallback silencieux
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  }, [isFullscreen]);

  // Touche Échap / F pour raccourcis clavier plein écran
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        // Vérifie qu'on n'est pas dans un input
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const handleZoomIn = () => {
    const idx = ZOOM_ORDER.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_ORDER[idx - 1]);
  };

  const handleZoomOut = () => {
    const idx = ZOOM_ORDER.indexOf(zoom);
    if (idx < ZOOM_ORDER.length - 1) setZoom(ZOOM_ORDER[idx + 1]);
  };

  const referenceDate = data.planning.referenceDate ?? new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Barre de présentation */}
      <div className={styles.bar}>
        {/* Retour vers le planning */}
        <Link href={`/p/${planningId}`} className={styles.backLink} title="Retour au planning">
          ← Retour
        </Link>

        <div className={styles.separator} />

        {/* Nom du planning */}
        <span className={styles.planningName}>{data.planning.name}</span>

        <div className={styles.separator} />

        {/* Navigation temporelle */}
        <button
          className={styles.barBtn}
          onClick={() => requestScroll("prev")}
          title="Période précédente"
        >
          ‹
        </button>
        <button
          className={`${styles.barBtn} ${styles.barBtnActive}`}
          onClick={() => requestScroll("today")}
          title="Aller à aujourd'hui"
        >
          Aujourd&apos;hui
        </button>
        <button
          className={styles.barBtn}
          onClick={() => requestScroll("next")}
          title="Période suivante"
        >
          ›
        </button>

        <div className={styles.separator} />

        {/* Zoom */}
        <button
          className={styles.barBtn}
          onClick={handleZoomIn}
          disabled={zoom === "1m"}
          title="Zoom avant"
        >
          +
        </button>
        <span style={{ fontSize: "var(--text-12)", color: "rgba(255,255,255,0.75)", minWidth: 52, textAlign: "center" }}>
          {ZOOM_LABELS[zoom as ZoomLevel]}
        </span>
        <button
          className={styles.barBtn}
          onClick={handleZoomOut}
          disabled={zoom === "12m"}
          title="Zoom arrière"
        >
          −
        </button>

        <div className={styles.separator} />

        {/* Plein écran */}
        <button
          className={styles.fullscreenBtn}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Quitter le plein écran (F)" : "Plein écran (F)"}
        >
          {isFullscreen ? "⊡ Quitter plein écran" : "⛶ Plein écran"}
        </button>
      </div>

      {/* Zone Gantt — lecture seule (pas d'EditPanel ni de BulkBar) */}
      <div className={styles.ganttWrap}>
        <Gantt
          planningId={planningId}
          domains={data.domains}
          lots={data.lots}
          phases={data.phases}
          milestones={data.milestones}
          milestoneTypes={data.milestoneTypes}
          statuses={data.statuses}
          phaseTypes={data.phaseTypes}
          members={data.members}
          phaseAssignees={data.phaseAssignees}
          viewStart={data.planning.viewStart}
          viewEnd={data.planning.viewEnd}
          referenceDate={referenceDate}
        />
      </div>
    </div>
  );
}
