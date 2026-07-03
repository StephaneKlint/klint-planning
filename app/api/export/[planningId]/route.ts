/**
 * GET /api/export/[planningId]
 * Exporte un planning complet (structure + données) en JSON téléchargeable.
 * Format : { klintPlanningExport, version, exportedAt, planning, settings,
 *            phaseTypes, milestoneTypes, statuses, domains[{...lots[{...phases, milestones}]}] }
 */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGanttData, listPlanningsForUser } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planningId: string }> }
) {
  const { planningId } = await params;

  const session = await auth();
  const userId  = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const role = session?.user?.role ?? "contact";
  if (role !== "admin") {
    const accessible = await listPlanningsForUser(userId);
    if (!accessible.find((p) => p.id === planningId)) {
      return NextResponse.json({ error: "Planning introuvable" }, { status: 404 });
    }
  }

  const data = await getGanttData(planningId);
  if (!data) {
    return NextResponse.json({ error: "Planning introuvable" }, { status: 404 });
  }

  const { planning, settings, domains, lots, phases, milestones, phaseTypes, milestoneTypes, statuses } = data;

  const exportData = {
    klintPlanningExport: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    planning: {
      name:          planning.name,
      type:          planning.type,
      year:          planning.year,
      viewStart:     planning.viewStart,
      viewEnd:       planning.viewEnd,
      description:   planning.description,
      referenceDate: planning.referenceDate,
    },
    settings: settings ? {
      autoLate:               settings.autoLate,
      autoCloseAfterMepDays:  settings.autoCloseAfterMepDays,
      notifyOnLate:           settings.notifyOnLate,
    } : null,
    phaseTypes: phaseTypes.map(({ code, label, sortOrder }) => ({ code, label, sortOrder })),
    milestoneTypes: milestoneTypes.map(({ code, label, color, sortOrder }) => ({ code, label, color, sortOrder })),
    statuses: statuses.map(({ code, label, color, bg, sortOrder }) => ({ code, label, color, bg, sortOrder })),
    domains: domains.map((domain) => {
      const domainLots = lots.filter((l) => l.domainId === domain.id);
      return {
        code:       domain.code,
        name:       domain.name,
        bg:         domain.bg,
        bgAlt:      domain.bgAlt,
        strong:     domain.strong,
        phaseColor: domain.phaseColor,
        sortOrder:  domain.sortOrder,
        collapsed:  domain.collapsed,
        cadence:    domain.cadence,
        lots: domainLots.map((lot) => {
          const lotPhases     = phases.filter((p) => p.lotId === lot.id);
          const lotMilestones = milestones.filter((m) => m.lotId === lot.id);
          return {
            name:      lot.name,
            subtitle:  lot.subtitle,
            icon:      lot.icon,
            sortOrder: lot.sortOrder,
            hidden:    lot.hidden,
            phases: lotPhases.map(({ type, label, startDate, endDate, status, progress, color, note, sortOrder }) => ({
              type, label, startDate, endDate, status, progress, color, note, sortOrder,
            })),
            milestones: lotMilestones.map(({ type, label, date, color, labelPos, note }) => ({
              type, label, date, color, labelPos, note,
            })),
          };
        }),
      };
    }),
  };

  const filename = `${planning.name.replace(/[^a-zA-Z0-9-_]/g, "_")}_planning.json`;

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
