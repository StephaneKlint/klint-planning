"use client";
/**
 * GanttView — Toolbar + Gantt + EditPanel + BulkBar + CommandPalette + Présence.
 * Polling 10s (données) + heartbeat/présence 30s via Neon.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { Gantt } from "@/components/gantt/Gantt";
import { Toolbar } from "@/components/chrome/Toolbar";
import { ProjectFilterModal } from "@/components/chrome/ProjectFilterModal";
import { EditPanel } from "@/components/panels/EditPanel";
import { BulkBar } from "@/components/panels/BulkBar";
import { CommandPalette } from "@/components/panels/CommandPalette";
import { PresenceStack } from "@/components/chrome/PresenceStack";
import { useGanttStore } from "@/store/ganttStore";
import { usePlanning } from "@/lib/queries/usePlanning";
import { usePresence } from "@/lib/queries/usePresence";
import { useQueryClient } from "@tanstack/react-query";
import { planningQueryKey } from "@/lib/queries/usePlanning";
import {
  updatePhaseStatus, updatePhaseProgress, updatePhaseNote,
  updatePhaseDates, updatePhaseColor, updatePhaseLabel,
  updateMilestone,
  restorePhase, restoreMilestone, restoreLot,
} from "@/lib/actions/planning";
import { restoreMember } from "@/lib/actions/members";
import type { GanttProps } from "@/components/gantt/types";
import type { GanttData } from "@/lib/db/queries";
import type { UndoEntry } from "@/store/ganttStore";
import styles from "./GanttView.module.css";

interface GanttViewProps extends GanttProps {
  initialData: GanttData;
  /** Premier membre du planning — utilisé pour le heartbeat demo (Jalon 5: auth session) */
  demoMemberId?: string;
}

export function GanttView({ initialData, demoMemberId, ...props }: GanttViewProps) {
  const ganttRef = useRef<HTMLDivElement>(null);
  const [exportPending, setExportPending] = useState(false);

  const {
    zoom, setZoom,
    colorMode, setColorMode,
    panelMode, setPanelMode,
    setCommandPaletteOpen,
    requestScroll,
    showDomainBands, toggleDomainBands,
    showWeekends, toggleWeekends,
    showResponsables, toggleResponsables,
    showHolidays, toggleHolidays,
    showClosures, toggleClosures,
    filterDateStart, filterDateEnd,
    setFilterDates, clearFilterDates,
    undoStack, popUndo,
    projectFilterOpen, setProjectFilterOpen,
    hiddenLotIds,
  } = useGanttStore();

  const qc = useQueryClient();

  // Données en live — polling 10s
  const { data } = usePlanning(props.planningId, initialData);
  const liveData = data ?? initialData;

  // Présence — heartbeat 30s + polling membres actifs 30s
  const activeMembers = usePresence(props.planningId, demoMemberId);

  const handleTogglePanel = () => {
    setPanelMode(panelMode === "hidden" ? "compact" : "hidden");
  };

  // ── Undo ────────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(async () => {
    const entry: UndoEntry | undefined = popUndo();
    if (!entry) return;

    try {
      switch (entry.type) {
        case "phase-status":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updatePhaseStatus({ phaseId: entry.phaseId, planningId: entry.planningId, status: entry.prev as any });
          break;
        case "phase-dates":
          await updatePhaseDates({ phaseId: entry.phaseId, planningId: entry.planningId, startDate: entry.prevStart, endDate: entry.prevEnd });
          break;
        case "phase-label":
          await updatePhaseLabel({ phaseId: entry.phaseId, planningId: entry.planningId, label: entry.prev });
          break;
        case "phase-note":
          await updatePhaseNote({ phaseId: entry.phaseId, planningId: entry.planningId, note: entry.prev });
          break;
        case "phase-color":
          await updatePhaseColor({ phaseId: entry.phaseId, planningId: entry.planningId, color: entry.prev });
          break;
        case "phase-progress":
          await updatePhaseProgress({ phaseId: entry.phaseId, planningId: entry.planningId, progress: entry.prev });
          break;
        case "milestone-update":
          await updateMilestone({ milestoneId: entry.milestoneId, planningId: entry.planningId, ...entry.prev });
          break;
        case "member-delete":
          await restoreMember({
            userId: entry.userId, planningId: entry.planningId,
            initials: entry.initials, color: entry.color,
            permission: entry.permission, phaseIds: entry.phaseIds,
          });
          break;
        case "phase-delete":
          await restorePhase(entry.phase, entry.planningId);
          break;
        case "milestone-delete":
          await restoreMilestone(entry.milestone, entry.planningId);
          break;
        case "lot-delete":
          await restoreLot(entry.lot, entry.phases, entry.milestones, entry.planningId);
          break;
      }
      qc.invalidateQueries({ queryKey: planningQueryKey(props.planningId) });
    } catch (err) {
      console.error("Undo failed:", err);
    }
  }, [popUndo, props.planningId, qc]);

  // Ctrl+Z keyboard shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        handleUndo();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

  // ── PDF export ──────────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (!ganttRef.current || exportPending) return;
    setExportPending(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const outerEl = ganttRef.current;

      // Mesure les dimensions réelles du contenu via l'élément bodyScroll
      const bodyEl = outerEl.querySelector<HTMLElement>("[data-gantt-body]");
      const timelineW = bodyEl?.scrollWidth  ?? 1200;
      const timelineH = bodyEl?.scrollHeight ?? 600;
      const SIDE_W   = 340;
      const HEADER_H = 52;
      const exportW  = timelineW + SIDE_W;
      const exportH  = timelineH + HEADER_H;

      const canvas = await html2canvas(outerEl, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        width: exportW,
        height: exportH,
        windowWidth: exportW,
        windowHeight: exportH,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onclone: (_clonedDoc: Document, clonedOuter: any) => {
          // Agrandit le conteneur extérieur à la taille totale du contenu
          (clonedOuter as HTMLElement).style.cssText = [
            `position: relative !important`,
            `width: ${exportW}px !important`,
            `height: ${exportH}px !important`,
            `overflow: visible !important`,
            `padding: 0 !important`,
          ].join(";");

          // Supprime toutes les contraintes de débordement dans les enfants
          (clonedOuter as HTMLElement).querySelectorAll<HTMLElement>("*").forEach((child) => {
            child.style.overflow  = "visible";
            child.style.overflowX = "visible";
            child.style.overflowY = "visible";
            child.style.maxHeight = "none";
            child.style.maxWidth  = "none";
          });
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const planningName = liveData.planning.name;

      const printWin = window.open("", "_blank");
      if (!printWin) {
        alert("Autorisez les pop-ups pour l'impression.");
        return;
      }
      printWin.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${planningName} — Planning A3</title>
  <style>
    @page { size: A3 landscape; margin: 8mm; }
    @media print { .toolbar { display:none !important; } body { margin:0; } .img-wrap { padding:0; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; }
    .toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px; background: #001036; color: white;
      position: sticky; top: 0; z-index: 10; gap: 12px;
    }
    .toolbar h1 { font-size: 15px; font-weight: 700; flex: 1; }
    .toolbar-hint { font-size: 12px; color: rgba(255,255,255,0.55); }
    .toolbar-btns { display: flex; gap: 8px; }
    .print-btn {
      padding: 7px 18px; background: #5CD696; color: #001036;
      border: none; border-radius: 6px; font-weight: 700;
      font-size: 13px; cursor: pointer; font-family: inherit;
    }
    .print-btn:hover { opacity: 0.88; }
    .close-btn {
      padding: 7px 14px; background: transparent; color: white;
      border: 1px solid rgba(255,255,255,0.3); border-radius: 6px;
      font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit;
    }
    .close-btn:hover { background: rgba(255,255,255,0.1); }
    .img-wrap { padding: 8mm; }
    img { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>${planningName} — Planning A3 paysage</h1>
    <span class="toolbar-hint">Format A3 paysage — 420 × 297 mm</span>
    <div class="toolbar-btns">
      <button class="close-btn" onclick="window.close()">Fermer</button>
      <button class="print-btn" onclick="window.print()">🖨️&nbsp;Imprimer / PDF</button>
    </div>
  </div>
  <div class="img-wrap">
    <img src="${imgData}" alt="${planningName}">
  </div>
</body>
</html>`);
      printWin.document.close();
    } catch (err) {
      console.error("Export PDF failed:", err);
      alert("L'export PDF a échoué. Essayez de réduire le zoom ou la période affichée.");
    } finally {
      setExportPending(false);
    }
  };

  // ── Export JSON ─────────────────────────────────────────────────────────────
  const handleExportJson = () => {
    window.location.href = `/api/export/${props.planningId}`;
  };

  return (
    <div className={styles.view}>
      <Toolbar
        zoom={zoom}
        onZoomChange={setZoom}
        onTodayClick={() => requestScroll("today")}
        onScrollPrev={() => requestScroll("prev")}
        onScrollNext={() => requestScroll("next")}
        onTogglePanel={handleTogglePanel}
        onSearchClick={() => setCommandPaletteOpen(true)}
        onExportPdf={handleExportPdf}
        exportPdfPending={exportPending}
        onExportJson={handleExportJson}
        onProjectFilter={() => setProjectFilterOpen(!projectFilterOpen)}
        projectFilterActive={projectFilterOpen || hiddenLotIds.size > 0}
        presenceStack={<PresenceStack members={activeMembers} />}
        panelVisible={panelMode !== "hidden"}
        filterStart={filterDateStart}
        filterEnd={filterDateEnd}
        onFilterDatesChange={setFilterDates}
        onClearFilter={clearFilterDates}
        canUndo={undoStack.length > 0}
        onUndo={handleUndo}
        showDomainBands={showDomainBands}
        showWeekends={showWeekends}
        showResponsables={showResponsables}
        onToggleDomainBands={toggleDomainBands}
        onToggleWeekends={toggleWeekends}
        onToggleResponsables={toggleResponsables}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        showHolidays={showHolidays}
        showClosures={showClosures}
        onToggleHolidays={toggleHolidays}
        onToggleClosures={toggleClosures}
      />

      {/* Modal sélecteur de projets */}
      {projectFilterOpen && (
        <ProjectFilterModal
          domains={liveData.domains}
          lots={liveData.lots}
          onClose={() => setProjectFilterOpen(false)}
        />
      )}

      <div className={styles.ganttOuter} ref={ganttRef}>
        <Gantt
          {...props}
          viewStart={filterDateStart ?? props.viewStart}
          viewEnd={filterDateEnd ?? props.viewEnd}
          domains={liveData.domains}
          lots={liveData.lots}
          phases={liveData.phases}
          milestones={liveData.milestones}
          milestoneTypes={liveData.milestoneTypes}
          statuses={liveData.statuses}
          phaseAssignees={liveData.phaseAssignees}
          closurePeriods={liveData.closurePeriods}
        />
      </div>

      <EditPanel planningId={props.planningId} data={liveData} />
      <BulkBar planningId={props.planningId} />
      <CommandPalette data={liveData} planningId={props.planningId} />
    </div>
  );
}
