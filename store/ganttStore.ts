"use client";
import { create } from "zustand";

export type ZoomLevel = "1m" | "3m" | "6m" | "12m";
export type Density = "normal" | "compact" | "comfy";
export type ColorMode = "domain" | "status" | "person";
export type PanelMode = "compact" | "floating" | "hidden";

interface GanttState {
  zoom: ZoomLevel;
  density: Density;
  colorMode: ColorMode;
  panelMode: PanelMode;
  showWeekends: boolean;
  showDomainBands: boolean;
  showResponsables: boolean;
  setZoom: (z: ZoomLevel) => void;
  setDensity: (d: Density) => void;
  setColorMode: (m: ColorMode) => void;
  setPanelMode: (m: PanelMode) => void;
  toggleWeekends: () => void;
  toggleDomainBands: () => void;
  toggleResponsables: () => void;
}

export const useGanttStore = create<GanttState>((set) => ({
  zoom: "12m",
  density: "normal",
  colorMode: "domain",
  panelMode: "compact",
  showWeekends: true,
  showDomainBands: true,
  showResponsables: true,
  setZoom: (zoom) => set({ zoom }),
  setDensity: (density) => set({ density }),
  setColorMode: (colorMode) => set({ colorMode }),
  setPanelMode: (panelMode) => set({ panelMode }),
  toggleWeekends: () => set((s) => ({ showWeekends: !s.showWeekends })),
  toggleDomainBands: () => set((s) => ({ showDomainBands: !s.showDomainBands })),
  toggleResponsables: () => set((s) => ({ showResponsables: !s.showResponsables })),
}));
