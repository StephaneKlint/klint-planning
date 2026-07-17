import { create } from "zustand";

export type ZoomLevel = "1m" | "3m" | "6m" | "12m";
export type Density = "normal" | "compact" | "comfy";
export type ColorMode = "domain" | "status" | "person";
export type PanelMode = "compact" | "floating" | "hidden";

export type EditTarget =
  | { kind: "phase"; id: string }
  | { kind: "lot"; id: string }
  | { kind: "milestone"; id: string }
  | { kind: "create-domain"; planningId: string }
  | { kind: "edit-domain"; domainId: string; planningId: string }
  | { kind: "create-lot"; domainId: string }
  | { kind: "edit-lot"; lotId: string; planningId: string }
  | { kind: "create-phase"; lotId: string }
  | { kind: "create-milestone"; lotId: string }
  | null;

// ── Bulk drag state ──────────────────────────────────────────────────────────
export interface BulkDragState {
  deltaDays: number;
  targetLotId: string;
}

// ── Undo stack ───────────────────────────────────────────────────────────────
export type UndoEntry =
  | { type: "phase-status";   phaseId: string; planningId: string; prev: string | null }
  | { type: "phase-dates";    phaseId: string; planningId: string; prevStart: string; prevEnd: string }
  | { type: "phase-move";     phaseId: string; planningId: string; prevStart: string; prevEnd: string; prevLotId: string }
  | { type: "phase-label";    phaseId: string; planningId: string; prev: string | null }
  | { type: "phase-note";     phaseId: string; planningId: string; prev: string | null }
  | { type: "phase-color";    phaseId: string; planningId: string; prev: string | null }
  | { type: "phase-progress"; phaseId: string; planningId: string; prev: number }
  | { type: "milestone-update"; milestoneId: string; planningId: string;
      prev: { date?: string; label?: string; note?: string | null; color?: string | null } }
  | { type: "milestone-move"; milestoneId: string; planningId: string;
      prevDate: string; prevLotId: string }
  | { type: "member-delete";  userId: string; planningId: string; initials: string | null;
      color: string | null; permission: string; phaseIds: string[] }
  | { type: "phase-delete"; planningId: string; phase: {
      id: string; lotId: string; type: string; startDate: string; endDate: string;
      label: string | null; status: string | null; progress: number;
      color: string | null; note: string | null; sortOrder: number;
    }}
  | { type: "milestone-delete"; planningId: string; milestone: {
      id: string; lotId: string; type: string; label: string; date: string;
      color: string | null; note: string | null; labelPos: string;
    }}
  | { type: "lot-delete"; planningId: string; lot: {
      id: string; domainId: string; name: string; subtitle: string | null;
      sortOrder: number;
    }; phases: Array<{
      id: string; lotId: string; type: string; startDate: string; endDate: string;
      label: string | null; status: string | null; progress: number;
      color: string | null; note: string | null; sortOrder: number;
    }>; milestones: Array<{
      id: string; lotId: string; type: string; label: string; date: string;
      color: string | null; note: string | null; labelPos: string;
    }>};

const UNDO_MAX = 30;

interface GanttState {
  // Display
  zoom: ZoomLevel;
  density: Density;
  colorMode: ColorMode;
  panelMode: PanelMode;
  showWeekends: boolean;
  showDomainBands: boolean;
  showResponsables: boolean;
  showHolidays: boolean;
  showClosures: boolean;
  // Edit panel
  editTarget: EditTarget;
  // Bulk selection
  selectedPhaseIds: Set<string>;
  selectedMilestoneIds: Set<string>;
  // Visibility overrides (lotId → hidden)
  hiddenLotIds: Set<string>;
  // Command palette
  commandPaletteOpen: boolean;
  // Scroll intent (set by Toolbar buttons, consumed by Gantt)
  scrollRequest: "today" | "prev" | "next" | null;
  // Date range filter (null = use planning default)
  filterDateStart: string | null;
  filterDateEnd: string | null;
  // Undo stack
  undoStack: UndoEntry[];
  pushUndo: (entry: UndoEntry) => void;
  popUndo: () => UndoEntry | undefined;
  clearUndo: () => void;
  // Actions
  setZoom: (z: ZoomLevel) => void;
  setDensity: (d: Density) => void;
  setColorMode: (m: ColorMode) => void;
  setPanelMode: (m: PanelMode) => void;
  toggleWeekends: () => void;
  toggleDomainBands: () => void;
  toggleResponsables: () => void;
  toggleHolidays: () => void;
  toggleClosures: () => void;
  openEdit: (target: EditTarget) => void;
  closeEdit: () => void;
  togglePhaseSelection: (phaseId: string, multi: boolean) => void;
  toggleMilestoneSelection: (milestoneId: string, multi: boolean) => void;
  clearSelection: () => void;
  toggleLotVisibility: (lotId: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  requestScroll: (req: "today" | "prev" | "next" | null) => void;
  setFilterDates: (start: string | null, end: string | null) => void;
  clearFilterDates: () => void;
  // Project visibility filter
  projectFilterOpen: boolean;
  setProjectFilterOpen: (open: boolean) => void;
  // Baseline
  baselinePhases: Record<string, { startDate: string; endDate: string }> | null;
  showBaseline: boolean;
  activeBaselineId: string | null;
  setBaselinePhases: (phases: Record<string, { startDate: string; endDate: string }> | null) => void;
  toggleShowBaseline: () => void;
  setActiveBaselineId: (id: string | null) => void;
  // Bulk drag (shared state between leader and follower items during a drag)
  bulkDragState: BulkDragState | null;
  setBulkDragState: (s: BulkDragState | null) => void;
}

export const useGanttStore = create<GanttState>((set, get) => ({
  zoom: "12m",
  density: "normal",
  colorMode: "domain",
  panelMode: "compact",
  showWeekends: true,
  showDomainBands: true,
  showResponsables: true,
  showHolidays: true,
  showClosures: true,
  editTarget: null,
  selectedPhaseIds: new Set(),
  selectedMilestoneIds: new Set(),
  hiddenLotIds: new Set(),
  commandPaletteOpen: false,
  scrollRequest: null,
  filterDateStart: null,
  filterDateEnd: null,
  undoStack: [],
  projectFilterOpen: false,
  baselinePhases: null,
  showBaseline: false,
  activeBaselineId: null,
  bulkDragState: null,

  setZoom: (zoom) => set({ zoom }),
  setDensity: (density) => set({ density }),
  setColorMode: (colorMode) => set({ colorMode }),
  setPanelMode: (panelMode) => set({ panelMode }),
  toggleWeekends: () => set((s) => ({ showWeekends: !s.showWeekends })),
  toggleDomainBands: () => set((s) => ({ showDomainBands: !s.showDomainBands })),
  toggleResponsables: () => set((s) => ({ showResponsables: !s.showResponsables })),
  toggleHolidays: () => set((s) => ({ showHolidays: !s.showHolidays })),
  toggleClosures: () => set((s) => ({ showClosures: !s.showClosures })),

  openEdit: (editTarget) => set({ editTarget, selectedPhaseIds: new Set(), selectedMilestoneIds: new Set() }),
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

  toggleMilestoneSelection: (milestoneId, multi) =>
    set((s) => {
      if (!multi) {
        return { selectedMilestoneIds: new Set(), editTarget: { kind: "milestone", id: milestoneId } };
      }
      const next = new Set(s.selectedMilestoneIds);
      if (next.has(milestoneId)) next.delete(milestoneId);
      else next.add(milestoneId);
      return { selectedMilestoneIds: next, editTarget: null };
    }),

  clearSelection: () => set({ selectedPhaseIds: new Set(), selectedMilestoneIds: new Set(), editTarget: null }),

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

  setBaselinePhases: (baselinePhases) => set({ baselinePhases }),
  toggleShowBaseline: () => set((s) => ({ showBaseline: !s.showBaseline })),
  setActiveBaselineId: (activeBaselineId) => set({ activeBaselineId }),
  setBulkDragState: (bulkDragState) => set({ bulkDragState }),

  pushUndo: (entry) => set((s) => ({
    undoStack: [entry, ...s.undoStack].slice(0, UNDO_MAX),
  })),
  popUndo: () => {
    const state = get();
    if (state.undoStack.length === 0) return undefined;
    const popped = state.undoStack[0];
    set({ undoStack: state.undoStack.slice(1) });
    return popped;
  },
  clearUndo: () => set({ undoStack: [] }),

  setProjectFilterOpen: (projectFilterOpen) => set({ projectFilterOpen }),
}));
