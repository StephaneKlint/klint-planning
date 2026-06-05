"use client";
/**
 * GanttView — Toolbar + Gantt + EditPanel + BulkBar + CommandPalette + Présence.
 * Polling 10s (données) + heartbeat/présence 30s via Neon.
 */
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
  const {
    zoom, setZoom,
    colorMode, setColorMode,
    panelMode, setPanelMode,
    setCommandPaletteOpen,
    requestScroll,
    toggleDomainBands,
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
        colorModeLabel={colorModeLabel}
        presenceStack={<PresenceStack members={activeMembers} />}
        panelVisible={panelMode !== "hidden"}
      />
      <div className={styles.ganttOuter}>
        <Gantt
          {...props}
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
