import type {
  DomainRow, LotRow, PhaseRow, MilestoneRow, MemberRow,
  StatusRow, PhaseTypeRow, MilestoneTypeRow, ClosurePeriodRow,
} from "@/lib/db/queries";
import type { ZoomLevel, Density, ColorMode } from "@/store/ganttStore";

export type { ZoomLevel, Density, ColorMode };

export interface RowEntry {
  kind: "domain" | "lot";
  id: string;
  domainCode: string;
  y: number;
  h: number;
}

export interface GanttProps {
  planningId: string;
  domains: DomainRow[];
  lots: LotRow[];
  phases: PhaseRow[];
  milestones: MilestoneRow[];
  members: MemberRow[];
  phaseAssignees: { phaseId: string; memberId: string }[];
  phaseTypes: PhaseTypeRow[];
  milestoneTypes: MilestoneTypeRow[];
  statuses: StatusRow[];
  viewStart: string;
  viewEnd: string;
  referenceDate: string;
  closurePeriods?: ClosurePeriodRow[];
  /** Override row height (px) — used by presentation fit-view mode */
  rowHOverride?: number;
  /** Called when user clicks "mark all phases done" on a lot */
  onMarkLotDone?: (lotId: string) => void;
}
