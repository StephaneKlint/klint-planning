"use client";
/**
 * GanttView — client shell that wraps Gantt with Toolbar.
 */
import { Gantt } from "@/components/gantt/Gantt";
import { Toolbar } from "@/components/chrome/Toolbar";
import { useGanttStore } from "@/store/ganttStore";
import type { GanttProps } from "@/components/gantt/types";
import styles from "./GanttView.module.css";

export function GanttView(props: GanttProps) {
  const { zoom, setZoom, colorMode, setColorMode } = useGanttStore();

  const colorModeLabel =
    colorMode === "domain" ? "Domaine" : colorMode === "status" ? "Statut" : "Personne";

  const handleColorMode = () => {
    const next: Record<string, "domain" | "status" | "person"> = {
      domain: "status", status: "person", person: "domain",
    };
    setColorMode(next[colorMode]);
  };

  return (
    <div className={styles.view}>
      <Toolbar
        zoom={zoom}
        onZoomChange={setZoom}
        onColorModeClick={handleColorMode}
        colorModeLabel={colorModeLabel}
      />
      <div className={styles.ganttOuter}>
        <Gantt {...props} />
      </div>
    </div>
  );
}
