/**
 * /p/[planningId] — Vue Gantt principale (Server Component).
 */
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getGanttData, getLatestBaselineForPlanning, listPlanningsForUser } from "@/lib/db/queries";
import { GanttView } from "./GanttView";

interface Props {
  params: Promise<{ planningId: string }>;
}

export default async function PlanningPage({ params }: Props) {
  const { planningId } = await params;

  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role ?? "contact";

  // Vérifier l'accès pour les non-admins
  if (role !== "admin" && userId) {
    const accessible = await listPlanningsForUser(userId);
    if (!accessible.find((p) => p.id === planningId)) {
      notFound();
    }
  }

  const [data, initialBaseline] = await Promise.all([
    getGanttData(planningId),
    getLatestBaselineForPlanning(planningId),
  ]);
  if (!data) notFound();

  const referenceDate = data.planning.referenceDate ?? new Date().toISOString().slice(0, 10);

  // currentMemberId : membre correspondant à l'utilisateur connecté
  const currentMemberId = userId
    ? data.members.find((m) => m.userEmail === session?.user?.email)?.id
    : data.members[0]?.id;

  return (
    <GanttView
      initialData={data}
      initialBaseline={initialBaseline}
      demoMemberId={currentMemberId}
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
