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
import { getOrCreateShareToken, revokeShareToken } from "@/lib/actions/share";
import { importLegacyPlanningJSON, updatePlanningFromJSON } from "@/lib/actions/plannings";
import { createBaseline, deleteBaseline } from "@/lib/actions/baseline";
import type { BaselineRow } from "@/lib/db/queries";
import type { GanttProps } from "@/components/gantt/types";
import type { GanttData } from "@/lib/db/queries";
import type { UndoEntry } from "@/store/ganttStore";
import styles from "./GanttView.module.css";

interface GanttViewProps extends GanttProps {
  initialData: GanttData;
  /** Premier membre du planning — utilisé pour le heartbeat demo (Jalon 5: auth session) */
  demoMemberId?: string;
  /** Baseline chargée côté serveur au démarrage (null si aucune) */
  initialBaseline?: BaselineRow | null;
}

export function GanttView({ initialData, demoMemberId, initialBaseline, ...props }: GanttViewProps) {
  const ganttRef = useRef<HTMLDivElement>(null);
  const importJsonRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [exportPngPending, setExportPngPending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareRevoking, setShareRevoking] = useState(false);

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
    editTarget, closeEdit,
    baselinePhases, setBaselinePhases,
    showBaseline, toggleShowBaseline,
  } = useGanttStore();

  const hasBaseline = baselinePhases !== null;

  // Initialise le store avec la baseline chargée côté serveur
  useEffect(() => {
    if (initialBaseline) {
      setBaselinePhases(initialBaseline.phases);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Capture commune html2canvas ─────────────────────────────────────────────
  const captureGantt = async (scale: number) => {
    const html2canvas = (await import("html2canvas")).default;
    const outerEl = ganttRef.current!;

    const bodyEl = outerEl.querySelector<HTMLElement>("[data-gantt-body]");
    const timelineW = bodyEl?.scrollWidth  ?? 1200;
    const timelineH = bodyEl?.scrollHeight ?? 600;
    const SIDE_W   = 340;
    const HEADER_H = 52;
    const exportW  = timelineW + SIDE_W;
    const exportH  = timelineH + HEADER_H;

    const canvas = await html2canvas(outerEl, {
      scale,
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
        const el = clonedOuter as HTMLElement;
        el.style.cssText = [
          `position: relative !important`,
          `width: ${exportW}px !important`,
          `height: ${exportH}px !important`,
          `overflow: visible !important`,
          `padding: 0 !important`,
        ].join(";");

        const sideEl      = el.querySelector<HTMLElement>("[data-gantt-side]");
        const sideRowsEl  = el.querySelector<HTMLElement>("[data-gantt-side-rows]");
        const timelineEl  = el.querySelector<HTMLElement>("[data-gantt-timeline]");
        const bodyCloneEl = el.querySelector<HTMLElement>("[data-gantt-body]");
        const ganttFlexRow = sideEl?.parentElement ?? null;

        el.querySelectorAll<HTMLElement>("*").forEach((child) => {
          if (child === ganttFlexRow) return;
          child.style.overflow  = "visible";
          child.style.overflowX = "visible";
          child.style.overflowY = "visible";
          child.style.maxHeight = "none";
          child.style.maxWidth  = "none";
        });

        if (sideEl) {
          sideEl.style.height    = `${exportH}px`;
          sideEl.style.minHeight = `${exportH}px`;
          sideEl.style.position  = "relative";
          sideEl.style.zIndex    = "10";
        }
        if (sideRowsEl) {
          sideRowsEl.style.height    = `${timelineH}px`;
          sideRowsEl.style.minHeight = `${timelineH}px`;
          sideRowsEl.style.flex      = "none";
        }
        if (timelineEl) {
          timelineEl.style.height    = `${exportH}px`;
          timelineEl.style.minHeight = `${exportH}px`;
          timelineEl.style.position  = "relative";
          timelineEl.style.zIndex    = "1";
        }
        if (bodyCloneEl) {
          bodyCloneEl.style.height    = `${timelineH}px`;
          bodyCloneEl.style.minHeight = `${timelineH}px`;
          bodyCloneEl.style.flex      = "none";
        }
        // ganttFlexRow (.gantt div) est exclu de la boucle overflow mais doit aussi être étendu
        if (ganttFlexRow) {
          ganttFlexRow.style.height    = `${exportH}px`;
          ganttFlexRow.style.minHeight = `${exportH}px`;
          ganttFlexRow.style.maxHeight = "none";
          ganttFlexRow.style.overflow  = "visible";
          ganttFlexRow.style.flex      = "none";
        }
      },
    });

    return { canvas, exportW, exportH };
  };

  // ── PDF export ──────────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (!ganttRef.current || exportPending || exportPngPending) return;
    setExportPending(true);
    try {
      const { canvas } = await captureGantt(1.5);
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

  // ── Export PNG haute résolution (PowerPoint) ────────────────────────────────
  const handleExportPng = async () => {
    if (!ganttRef.current || exportPending || exportPngPending) return;
    setExportPngPending(true);
    try {
      const { canvas } = await captureGantt(3);
      const planningName = liveData.planning.name;
      // Nom de fichier sécurisé
      const safeName = planningName.replace(/[^a-zA-Z0-9_\-]/g, "_");
      const a = document.createElement("a");
      a.download = `${safeName}_planning.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch (err) {
      console.error("Export PNG failed:", err);
      alert("L'export PNG a échoué. Essayez de réduire le zoom ou la période affichée.");
    } finally {
      setExportPngPending(false);
    }
  };

  // ── Export JSON ─────────────────────────────────────────────────────────────
  const handleExportJson = () => {
    window.location.href = `/api/export/${props.planningId}`;
  };

  // ── Import JSON (nouveau format ou legacy) ──────────────────────────────────
  const handleImportJson = () => {
    importJsonRef.current?.click();
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const text = await file.text();
    setImportPending(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = JSON.parse(text);
      if (parsed?.klintPlanningExport) {
        await updatePlanningFromJSON(props.planningId, text);
      } else if (parsed?.projects) {
        await importLegacyPlanningJSON(props.planningId, text);
      } else {
        alert("Format JSON non reconnu. Le fichier doit être un export Klint Planning ou un export de l'ancienne application.");
        return;
      }
      qc.invalidateQueries({ queryKey: planningQueryKey(props.planningId) });
    } catch (err) {
      alert((err as Error).message ?? "Erreur lors de l'import.");
    } finally {
      setImportPending(false);
    }
  };

  // ── Export Excel (.xlsx) ────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    const XLSX = (await import("xlsx")).default;

    const domainsById = new Map(liveData.domains.map((d) => [d.id, d]));
    const lotsById    = new Map(liveData.lots.map((l) => [l.id, l]));
    const ptMap  = new Map(liveData.phaseTypes.map((pt) => [pt.code, pt.label]));
    const mtMap  = new Map(liveData.milestoneTypes.map((mt) => [mt.code, mt.label]));
    const stMap  = new Map(liveData.statuses.map((s) => [s.code, s.label]));
    const mbrMap = new Map(liveData.members.map((m) => [m.id, m]));

    const assigneesMap = new Map<string, string[]>();
    for (const a of liveData.phaseAssignees) {
      const m = mbrMap.get(a.memberId);
      if (m) {
        if (!assigneesMap.has(a.phaseId)) assigneesMap.set(a.phaseId, []);
        assigneesMap.get(a.phaseId)!.push(m.initials ?? m.userName ?? "?");
      }
    }

    const fmt = (d: string) => {
      const [y, mo, day] = d.split("-");
      return `${day}/${mo}/${y}`;
    };

    const phasesData = liveData.phases.map((p) => {
      const lot    = lotsById.get(p.lotId);
      const domain = lot ? domainsById.get(lot.domainId) : undefined;
      const dur    = Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86400000) + 1;
      return {
        "Domaine":         domain?.name ?? "",
        "Lot":             lot?.name ?? "",
        "Type":            ptMap.get(p.type) ?? p.type,
        "Libellé":         p.label ?? "",
        "Début":           fmt(p.startDate),
        "Fin":             fmt(p.endDate),
        "Durée (j)":       dur,
        "Statut":          p.status ? (stMap.get(p.status) ?? p.status) : "",
        "Avancement (%)":  p.progress,
        "Responsables":    (assigneesMap.get(p.id) ?? []).join(", "),
        "Note":            p.note ?? "",
      };
    });

    const milestonesData = liveData.milestones.map((ms) => {
      const lot    = lotsById.get(ms.lotId);
      const domain = lot ? domainsById.get(lot.domainId) : undefined;
      return {
        "Domaine": domain?.name ?? "",
        "Lot":     lot?.name ?? "",
        "Type":    mtMap.get(ms.type) ?? ms.type,
        "Libellé": ms.label,
        "Date":    fmt(ms.date),
        "Note":    ms.note ?? "",
      };
    });

    const wsPhases     = XLSX.utils.json_to_sheet(phasesData);
    const wsMilestones = XLSX.utils.json_to_sheet(milestonesData);

    wsPhases["!cols"] = [
      { wch: 22 }, { wch: 32 }, { wch: 16 }, { wch: 40 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 },
      { wch: 14 }, { wch: 22 }, { wch: 40 },
    ];
    wsMilestones["!cols"] = [
      { wch: 22 }, { wch: 32 }, { wch: 16 }, { wch: 40 },
      { wch: 12 }, { wch: 40 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsPhases, "Phases");
    XLSX.utils.book_append_sheet(wb, wsMilestones, "Jalons");

    const safeName = liveData.planning.name.replace(/[^a-zA-Z0-9_\-]/g, "_");
    XLSX.writeFile(wb, `${safeName}_planning.xlsx`);
  };

  // ── Baseline ────────────────────────────────────────────────────────────────
  const handleCreateBaseline = async () => {
    const today = new Date().toLocaleDateString("fr-FR");
    await createBaseline(props.planningId, `Baseline du ${today}`);
    const snapshot = Object.fromEntries(
      liveData.phases.map((p) => [p.id, { startDate: p.startDate, endDate: p.endDate }])
    );
    setBaselinePhases(snapshot);
    if (!showBaseline) toggleShowBaseline();
  };

  const handleDeleteBaseline = async () => {
    await deleteBaseline(props.planningId);
    setBaselinePhases(null);
    if (showBaseline) toggleShowBaseline();
  };

  // ── Share link ──────────────────────────────────────────────────────────────
  const handleOpenShare = async () => {
    setShareOpen(true);
    if (shareToken) return;
    setShareLoading(true);
    try {
      const { token } = await getOrCreateShareToken(props.planningId);
      setShareToken(token);
    } catch (err) {
      console.error("Share token error:", err);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShare = async () => {
    if (!shareToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const handleRevokeShare = async () => {
    setShareRevoking(true);
    try {
      await revokeShareToken(props.planningId);
      setShareToken(null);
    } catch (err) {
      console.error("Revoke error:", err);
    } finally {
      setShareRevoking(false);
    }
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
        onExportPng={handleExportPng}
        exportPngPending={exportPngPending}
        onExportExcel={handleExportExcel}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onShare={handleOpenShare}
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
        hasBaseline={hasBaseline}
        showBaseline={showBaseline}
        onToggleBaseline={toggleShowBaseline}
        onCreateBaseline={handleCreateBaseline}
        onDeleteBaseline={handleDeleteBaseline}
      />

      {/* Input file caché — import JSON */}
      <input
        ref={importJsonRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleImportJsonFile}
        aria-hidden
      />
      {importPending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "24px 32px", fontFamily: "var(--font-display)", fontSize: 14, color: "var(--klint-navy)" }}>
            Import en cours…
          </div>
        </div>
      )}

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

      {/* Overlay transparent — ferme l'EditPanel au clic extérieur */}
      {editTarget && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 19 }}
          onClick={closeEdit}
          aria-hidden="true"
        />
      )}
      <EditPanel planningId={props.planningId} data={liveData} />
      <BulkBar planningId={props.planningId} />
      <CommandPalette data={liveData} planningId={props.planningId} />

      {shareOpen && (
        <div className={styles.shareOverlay} onClick={() => setShareOpen(false)}>
          <div className={styles.shareModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.shareModalHeader}>
              <span className={styles.shareModalTitle}>Lien de partage</span>
              <button className={styles.shareClose} onClick={() => setShareOpen(false)}>✕</button>
            </div>
            <p className={styles.shareHint}>
              Ce lien donne acc&egrave;s au planning en lecture seule.
              Toute personne disposant du lien peut le consulter sans connexion.
            </p>
            {shareLoading ? (
              <p className={styles.shareStatus}>G&eacute;n&eacute;ration en cours&hellip;</p>
            ) : shareToken ? (
              <>
                <div className={styles.shareLinkRow}>
                  <input
                    className={styles.shareLinkInput}
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareToken}`}
                    onFocus={(e) => e.target.select()}
                  />
                  <button className={styles.shareCopyBtn} onClick={handleCopyShare}>
                    {shareCopied ? "✓ Copié !" : "Copier"}
                  </button>
                </div>
                <button
                  className={styles.shareRevokeBtn}
                  onClick={handleRevokeShare}
                  disabled={shareRevoking}
                >
                  {shareRevoking ? "Révocation…" : "Révoquer le lien"}
                </button>
              </>
            ) : (
              <button className={styles.shareGenerateBtn} onClick={handleOpenShare}>
                Générer un lien
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
