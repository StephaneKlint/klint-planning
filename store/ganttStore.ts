import { create } from "zustand";

export type ZoomLevel = "1m" | "3m" | "6m" | "12m";
export type Density = "normal" | "compact" | "comfy";
export type ColorMode = "domain" | "status" | "person";
export type PanelMode = "compact" | "floating" | "hidden";

export type EditTarget =
  | { kind: "phase"; id: string }
  | { kind: "lot"; id: string }
  | { kind: "milestone"; id: string }
  | { kind: "create"; lotId?: string }
  | null;

interface GanttState {
  // Display
  zoom: ZoomLevel;
  density: Density;
  colorMode: ColorMode;
  panelMode: PanelMode;
  showWeekends: boolean;
  showDomainBands: boolean;
  showResponsables: boolean;
  // Edit panel
  editTarget: EditTarget;
  // Bulk selection
  selectedPhaseIds: Set<string>;
  // Visibility overrides (lotId → hidden)
  hiddenLotIds: Set<string>;
  // Command palette
  commandPaletteOpen: boolean;
  // Scroll intent (set by Toolbar buttons, consumed by Gantt)
  scrollRequest: "today" | "prev" | "next" | null;
  // Date range filter (null = use planning default)
  filterDateStart: string | null;
  filterDateEnd: string | null;
  // Actions
  setZoom: (z: ZoomLevel) => void;
  setDensity: (d: Density) => void;
  setColorMode: (m: ColorMode) => void;
  setPanelMode: (m: PanelMode) => void;
  toggleWeekends: () => void;
  toggleDomainBands: () => void;
  toggleResponsables: () => void;
  openEdit: (target: EditTarget) => void;
  closeEdit: () => void;
  togglePhaseSelection: (phaseId: string, multi: boolean) => void;
  clearSelection: () => void;
  toggleLotVisibility: (lotId: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  requestScroll: (req: "today" | "prev" | "next" | null) => void;
  setFilterDates: (start: string | null, end: string | null) => void;
  clearFilterDates: () => void;
}

export const useGanttStore = create<GanttState>((set) => ({
  zoom: "12m",
  density: "normal",
  colorMode: "domain",
  panelMode: "compact",
  showWeekends: true,
  showDomainBands: true,
  showResponsables: true,
  editTarget: null,
  selectedPhaseIds: new Set(),
  hiddenLotIds: new Set(),
  commandPaletteOpen: false,
  scrollRequest: null,
  filterDateStart: null,
  filterDateEnd: null,

  setZoom: (zoom) => set({ zoom }),
  setDensity: (density) => set({ density }),
  setColorMode: (colorMode) => set({ colorMode }),
  setPanelMode: (panelMode) => set({ panelMode }),
  toggleWeekends: () => set((s) => ({ showWeekends: !s.showWeekends })),
  toggleDomainBands: () => set((s) => ({ showDomainBands: !s.showDomainBands })),
  toggleResponsables: () => set((s) => ({ showResponsables: !s.showResponsables })),

  openEdit: (editTarget) => set({ editTarget, selectedPhaseIds: new Set() }),
  closeEdit: () => set({ editTarget: null }),

  togglePhaseSelection: (phaseId, multi) =>
    set((s) => {
      if (!multi) {
        // Single click without modifier → open edit panel
        return { selectedPhaseIds: new Set(), editTarget: { kind: "phase", id: phaseId } };
      }
      // ⌘/Ctrl+click → toggle selection
      const next = new Set(s.selectedPhaseIds);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return { selectedPhaseIds: next, editTarget: null };
    }),

  clearSelection: () => set({ selectedPhaseIds: new Set(), editTarget: null }),

  toggleLotVisibility: (lotId) =>
    set((s) => {
      const next = new Set(s.hiddenLotIds);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return { hiddenLotIds: next };
    }),

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  requestScroll: (scrollRequest) => set({ scrollRequest }),
  setFilterDates: (filterDateStart, filterDateEnd) => set({ filterDateStart, filterDateEnd }),
  clearFilterDates: () => set({ filterDateStart: null, filterDateEnd: null }),
}));
