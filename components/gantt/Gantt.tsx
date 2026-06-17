"use client";
/**
 * Gantt — main container.
 * - Synchronises vertical scroll (side ↔ body)
 * - Synchronises horizontal scroll (header ↔ body)
 * - Re-centers on Today when zoom changes
 */
import { useRef, useEffect, useCallback, useState } from "react";
import { useGanttStore } from "@/store/ganttStore";
import { GanttSide } from "./GanttSide";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineBody } from "./TimelineBody";
import type { GanttProps } from "./types";
import type { StatusCode } from "@/components/ui/StatusPill";
import {
  PPD, ROW_H, computeRowOffsets, timelineWidth, todayScrollLeft, assignTracks,
} from "./ganttUtils";
import { derivePhaseStatus } from "@/lib/domain";
import styles from "./Gantt.module.css";

const SIDE_W = 340;
const HEADER_H = 52; // monthsRow (30) + daysRow (22)

export function Gantt({
  planningId,
  domains,
  lots,
  phases,
  milestones,
  milestoneTypes,
  statuses,
  phaseAssignees,
  phaseTypes: _phaseTypes, // eslint-disable-line @typescript-eslint/no-unused-vars
  members,
  viewStart,
  viewEnd,
  referenceDate,
  closurePeriods,
  rowHOverride,
  onMarkLotDone,
  onReorderLots,
  onReorderDomains,
}: GanttProps) {
  const { zoom: zoomRaw, density: densityRaw, colorMode, showWeekends, showDomainBands, showHolidays, showClosures, panelMode, scrollRequest, requestScroll, hiddenLotIds } = useGanttStore();
  const zoom = zoomRaw as import("@/store/ganttStore").ZoomLevel;
  const density = densityRaw as import("@/store/ganttStore").Density;

  // ── Adaptive PPD: stretch to fill available timeline width for short views ──
  const [timelineContainerW, setTimelineContainerW] = useState(0);
  const timelineWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = timelineWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setTimelineContainerW(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const minPpd = PPD[zoom];
  const nbDays = Math.max(1, Math.round(
    (new Date(viewEnd + "T00:00:00Z").getTime() - new Date(viewStart + "T00:00:00Z").getTime()) / 86400000
  ) + 1);
  // Stretch PPD when NOT in 12m view and container is measured
  const ppd = (() => {
    if (timelineContainerW < 100) return minPpd;
    const stretchPpd = timelineContainerW / nbDays;
    return Math.max(minPpd, stretchPpd);
  })();

  const rowH = rowHOverride ?? ROW_H[density];

  // ── Track counts per lot (for overlapping phases) ───────────────────────────
  const phasesByLotForTracks = phases.reduce<Record<string, typeof phases>>((acc, p) => {
    (acc[p.lotId] ??= []).push(p);
    return acc;
  }, {});
  const trackCountByLotId: Record<string, number> = {};
  const trackByPhaseId: Record<string, number> = {};
  for (const [lotId, lotPhases] of Object.entries(phasesByLotForTracks)) {
    const { numTracks, trackByPhaseId: tMap } = assignTracks(lotPhases);
    trackCountByLotId[lotId] = numTracks;
    Object.assign(trackByPhaseId, tMap);
  }

  const { rows, totalH } = computeRowOffsets(domains, lots, rowH, undefined, hiddenLotIds, trackCountByLotId);
  const totalW = timelineWidth(viewStart, viewEnd, ppd);

  // Refs for scroll sync
  // sideInnerRef → GanttSide inner content div (transform-based vertical sync)
  const sideInnerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  // Vertical sync: body → side (CSS transform, works with overflow:hidden, no re-render)
  const onBodyScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (sideInnerRef.current && bodyRef.current) {
      sideInnerRef.current.style.transform = `translateY(-${bodyRef.current.scrollTop}px)`;
    }
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.addEventListener("scroll", onBodyScroll, { passive: true });
    return () => body.removeEventListener("scroll", onBodyScroll);
  }, [onBodyScroll]);

  // Re-center on Today when zoom changes
  useEffect(() => {
    const body = bodyRef.current;
    const header = headerRef.current;
    if (!body) return;
    const containerW = body.clientWidth || 800;
    const target = todayScrollLeft(referenceDate, viewStart, ppd, containerW);
    body.scrollLeft = target;
    if (header) header.scrollLeft = target;
  }, [zoom, ppd, referenceDate, viewStart]);

  // Consume scroll requests from the Toolbar prev/next/today buttons
  useEffect(() => {
    if (!scrollRequest || !bodyRef.current) return;
    const body = bodyRef.current;
    const header = headerRef.current;
    if (scrollRequest === "today") {
      const containerW = body.clientWidth || 800;
      const target = todayScrollLeft(referenceDate, viewStart, ppd, containerW);
      body.scrollLeft = target;
      if (header) header.scrollLeft = target;
    } else {
      const step = body.clientWidth * 0.8; // scroll by 80% of visible width
      body.scrollLeft += scrollRequest === "next" ? step : -step;
      if (header) header.scrollLeft = body.scrollLeft;
    }
    requestScroll(null);
  }, [scrollRequest, ppd, referenceDate, viewStart, requestScroll]);

  // Derive lot-level stats
  const phasesByLot = phases.reduce<Record<string, typeof phases>>((acc, p) => {
    (acc[p.lotId] ??= []).push(p);
    return acc;
  }, {});

  const lotProgress: Record<string, number> = {};
  const lotStatus: Record<string, StatusCode> = {};
  const today = new Date(referenceDate);

  for (const lot of lots) {
    const lotPhases = phasesByLot[lot.id] ?? [];
    if (lotPhases.length === 0) {
      lotProgress[lot.id] = 0;
      lotStatus[lot.id] = "planned";
      continue;
    }
    const avg = Math.round(lotPhases.reduce((s, p) => s + p.progress, 0) / lotPhases.length);
    lotProgress[lot.id] = avg;

    // Derive lot status from phases
    const derived = lotPhases.map((p) =>
      derivePhaseStatus(
        { startDate: p.startDate, endDate: p.endDate, status: p.status as StatusCode | null, progress: p.progress },
        today
      )
    );
    if (derived.some((s) => s === "late")) lotStatus[lot.id] = "late";
    else if (derived.some((s) => s === "risk")) lotStatus[lot.id] = "risk";
    else if (derived.every((s) => s === "done")) lotStatus[lot.id] = "done";
    else if (derived.some((s) => s === "in_progress")) lotStatus[lot.id] = "in_progress";
    else if (derived.some((s) => s === "review")) lotStatus[lot.id] = "review";
    else lotStatus[lot.id] = "planned";
  }

  return (
    <div className={styles.gantt}>
      {/* LEFT — Side panel (hidden when panelMode === "hidden") */}
      {panelMode !== "hidden" && (
        <div
          className={styles.sideScroll}
          style={{ width: SIDE_W, minWidth: SIDE_W }}
          data-gantt-side="true"
        >
          <GanttSide
            rows={rows}
            totalH={totalH}
            domains={domains}
            lots={lots}
            planningId={planningId}
            lotProgress={lotProgress}
            lotStatus={lotStatus}
            width={SIDE_W}
            innerRef={sideInnerRef}
            onMarkLotDone={onMarkLotDone}
            onReorderLots={onReorderLots}
            onReorderDomains={onReorderDomains}
          />
        </div>
      )}

      {/* RIGHT — Timeline */}
      <div ref={timelineWrapperRef} className={styles.timelineWrapper} data-gantt-timeline="true">
        {/* Header row (scrolls horizontally) */}
        <div
          ref={headerRef}
          className={styles.headerScroll}
          style={{ height: HEADER_H }}
        >
          <TimelineHeader
            viewStart={viewStart}
            viewEnd={viewEnd}
            ppd={ppd}
            zoom={zoom}
            totalW={totalW}
          />
        </div>

        {/* Body (scrolls both) — data-gantt-body used for PDF export measurement */}
        <div ref={bodyRef} className={styles.bodyScroll} data-gantt-body="true">
          <TimelineBody
            rows={rows}
            totalH={totalH}
            totalW={totalW}
            domains={domains}
            lots={lots}
            phases={phases}
            milestones={milestones}
            milestoneTypes={milestoneTypes}
            statuses={statuses}
            phaseAssignees={phaseAssignees}
            members={members}
            viewStart={viewStart}
            ppd={ppd}
            referenceDate={referenceDate}
            colorMode={colorMode}
            showWeekends={showWeekends}
            showDomainBands={showDomainBands}
            viewStart2={viewStart}
            viewEnd={viewEnd}
            closurePeriods={closurePeriods}
            showHolidays={showHolidays}
            showClosures={showClosures}
            trackByPhaseId={trackByPhaseId}
            rowH={rowH}
            planningId={planningId}
            bodyRef={bodyRef}
            headerRef={headerRef}
          />
        </div>
      </div>
    </div>
  );
}

export default Gantt;
