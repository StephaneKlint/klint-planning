export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { listPlannings, listPlanningsForUser, getGanttData, listUsersNotInPlanning, getActivityLog, listConnectionLogs, listAllDirectoryContacts } from "@/lib/db/queries";
import { getAppSettings, getPermissions, getSecuritySettings } from "@/lib/actions/appSettings";
import type { ExistingUserRow, ActivityEntry, ConnectionLogRow, DirectoryContact, UserRole } from "@/lib/db/queries";
import { ParametresTabs } from "./ParametresTabs";
import { PlanningSelector } from "./PlanningSelector";
import styles from "./Parametres.module.css";

interface Props {
  searchParams: Promise<{ planningId?: string }>;
}

export default async function ParametresPage({ searchParams }: Props) {
  const { planningId: qPlanningId } = await searchParams;

  const session = await auth();
  const userId  = session?.user?.id;
  const userRole: UserRole = (session?.user?.role ?? "contact") as UserRole;
  const isAdmin = userRole === "admin";

  const [planningList, appCfg, permissions, securitySettings] = await Promise.all([
    userId && !isAdmin ? listPlanningsForUser(userId) : listPlannings(),
    getAppSettings(),
    getPermissions(),
    getSecuritySettings(),
  ]);

  if (!planningList.length) {
    return <div className={styles.empty}>Aucun planning disponible.</div>;
  }

  const activePlanningId = qPlanningId ?? planningList[0].id;

  // Vérifier l'accès si planningId vient de l'URL
  if (qPlanningId && !isAdmin && !planningList.find((p) => p.id === activePlanningId)) {
    notFound();
  }

  const [data, existingUsers, activityEntries, connLogs, directoryContacts] = await Promise.all([
    getGanttData(activePlanningId),
    listUsersNotInPlanning(activePlanningId),
    getActivityLog(activePlanningId, 200),
    isAdmin ? listConnectionLogs(200) : Promise.resolve([]),
    isAdmin ? listAllDirectoryContacts() : Promise.resolve([]),
  ]);
  if (!data) return <div className={styles.empty}>Données introuvables.</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Paramètres</h1>

        {/* Sélecteur de planning */}
        <PlanningSelector plannings={planningList} activePlanningId={activePlanningId} />
      </header>

      <ParametresTabs
        data={data}
        appCfg={appCfg}
        userRole={userRole}
        permissions={permissions}
        securitySettings={securitySettings}
        existingUsers={existingUsers as ExistingUserRow[]}
        activityEntries={activityEntries as ActivityEntry[]}
        connLogs={connLogs as ConnectionLogRow[]}
        directoryContacts={directoryContacts as DirectoryContact[]}
      />
    </div>
  );
}
