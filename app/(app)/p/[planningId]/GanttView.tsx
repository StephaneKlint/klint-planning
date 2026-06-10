"use client";
/**
 * GanttView — Toolbar + Gantt + EditPanel + BulkBar + CommandPalette + Présence.
 * Polling 10s (données) + heartbeat/présence 30s via Neon.
 */
import { useRef, useState } from "react";
import { Gantt } from "@/components/gantt/Gantt";
import { Toolbar } from "@/components/chrome/Toolbar";
import { EditPanel } from "@/components/panels/EditPanel";
import { BulkBar } from "@/components/panels/BulkBar";
import { CommandPalette } from "@/components/panels/CommandPalette";
import { PresenceStack } from "@/components/chrome/PresenceStack";
import { useGanttStore } from "@/store/ganttStore";
import { usePlanning } from "@/lib/queries/usePlanning";
import { usePresence } from "@/lib/queries/usePresence";
import type { GanttProps } from "@/components/gantt/types";
import type { GanttData } from "@/lib/db/queries";
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
    toggleDomainBands,
    filterDateStart, filterDateEnd,
    setFilterDates, clearFilterDates,
  } = useGanttStore();

  // Données en live — polling 10s
  const { data } = usePlanning(props.planningId, initialData);
  const liveData = data ?? initialData;

  // Présence — heartbeat 30s + polling membres actifs 30s
  const activeMembers = usePresence(props.planningId, demoMemberId);

  const colorModeLabel =
    colorMode === "domain" ? "Domaine" : colorMode === "status" ? "Statut" : "Personne";

  const handleColorMode = () => {
    const next: Record<string, "domain" | "status" | "person"> = {
      domain: "status", status: "person", person: "domain",
    };
    setColorMode(next[colorMode]);
  };

  const handleTogglePanel = () => {
    setPanelMode(panelMode === "hidden" ? "compact" : "hidden");
  };

  const handleExportPdf = async () => {
    if (!ganttRef.current || exportPending) return;
    setExportPending(true);
    try {
      // Dynamic imports — évite le bundle côté server
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const el = ganttRef.current;
      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      // A3 paysage : 420 × 297 mm
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(pdfW / imgW, pdfH / imgH);

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, imgW * ratio, imgH * ratio);

      const planningName = liveData.planning.name.replace(/[^a-zA-Z0-9-_]/g, "_");
      pdf.save(`${planningName}_planning_A3.pdf`);
    } catch (err) {
      console.error("Export PDF failed:", err);
      alert("L'export PDF a échoué. Essayez de réduire le zoom ou la période affichée.");
    } finally {
      setExportPending(false);
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
        onVisibilityClick={toggleDomainBands}
        onSearchClick={() => setCommandPaletteOpen(true)}
        onColorModeClick={handleColorMode}
        onExportPdf={handleExportPdf}
        exportPdfPending={exportPending}
        colorModeLabel={colorModeLabel}
        presenceStack={<PresenceStack members={activeMembers} />}
        panelVisible={panelMode !== "hidden"}
        filterStart={filterDateStart}
        filterEnd={filterDateEnd}
        onFilterDatesChange={setFilterDates}
        onClearFilter={clearFilterDates}
      />
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
        />
      </div>

      <EditPanel planningId={props.planningId} data={liveData} />
      <BulkBar planningId={props.planningId} />
      <CommandPalette data={liveData} planningId={props.planningId} />
    </div>
  );
}
