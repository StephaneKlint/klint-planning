/**
 * /p/[planningId] — Vue Gantt principale (Server Component).
 * Fetches data from Neon, passes to Gantt client component.
 */
import { notFound } from "next/navigation";
import { getGanttData } from "@/lib/db/queries";
import { GanttView } from "./GanttView";

interface Props {
  params: Promise<{ planningId: string }>;
}

export default async function PlanningPage({ params }: Props) {
  const { planningId } = await params;
  const data = await getGanttData(planningId);
  if (!data) notFound();

  const referenceDate = data.planning.referenceDate ?? new Date().toISOString().slice(0, 10);

  return (
    <GanttView
      planningId={planningId}
      domains={data.domains}
      lots={data.lots}
      phases={data.phases}
      milestones={data.milestones}
      milestoneTypes={data.milestoneTypes}
      statuses={data.statuses}
      phaseAssignees={data.phaseAssignees}
      phaseTypes={data.phaseTypes}
      members={data.members}
      viewStart={data.planning.viewStart}
      viewEnd={data.planning.viewEnd}
      referenceDate={referenceDate}
    />
  );
}
