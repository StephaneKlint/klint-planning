import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAppSettings, getPermissions, getSecuritySettings } from "@/lib/actions/appSettings";
import {
  listConnectionLogs, listPlannings, getGanttData,
  listUsersNotInPlanning, getActivityLog, listAllDirectoryContacts,
  getPlanningGroupsForPlanning,
} from "@/lib/db/queries";
import type { ExistingUserRow, ActivityEntry, DirectoryContact } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { AdministrationClient } from "./AdministrationClient";

export const metadata = { title: "Administration — Klint Planning" };

interface Props {
  searchParams: Promise<{ planningId?: string; tab?: string }>;
}

export default async function AdministrationPage({ searchParams }: Props) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/plannings");

  const { planningId: qPlanningId, tab: qTab } = await searchParams;

  const [appCfg, permissions, securitySettings, connLogs, allUsers, planningList] = await Promise.all([
    getAppSettings(),
    getPermissions(),
    getSecuritySettings(),
    listConnectionLogs(200),
    db.select({
      id:                 users.id,
      name:               users.name,
      email:              users.email,
      role:               users.role,
      disabledAt:         users.disabledAt,
      createdAt:          users.createdAt,
      allowInternational: users.allowInternational,
    }).from(users).orderBy(asc(users.name)),
    listPlannings("all"),
  ]);

  const activePlanningId = qPlanningId ?? planningList[0]?.id ?? null;

  const [planningData, existingUsers, activityEntries, directoryContacts, syncGroups] =
    activePlanningId
      ? await Promise.all([
          getGanttData(activePlanningId),
          listUsersNotInPlanning(activePlanningId),
          getActivityLog(activePlanningId, 200),
          listAllDirectoryContacts(),
          getPlanningGroupsForPlanning(activePlanningId),
        ])
      : [null, [], [], [], []];

  return (
    <AdministrationClient
      appCfg={appCfg}
      permissions={permissions}
      securitySettings={securitySettings}
      connLogs={connLogs}
      allUsers={allUsers}
      planningList={planningList}
      activePlanningId={activePlanningId}
      planningData={planningData}
      existingUsers={existingUsers as ExistingUserRow[]}
      activityEntries={activityEntries as ActivityEntry[]}
      directoryContacts={directoryContacts as DirectoryContact[]}
      syncGroups={syncGroups}
      defaultTab={qTab === "planning" ? "planning" : "global"}
    />
  );
}
