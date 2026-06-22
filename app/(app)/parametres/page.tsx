export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/auth";
import { listPlannings, getGanttData, listUsersNotInPlanning, getActivityLog, listConnectionLogs, listAllDirectoryContacts } from "@/lib/db/queries";
import { getAppSettings, getPermissions } from "@/lib/actions/appSettings";
import type { ExistingUserRow, ActivityEntry, ConnectionLogRow, DirectoryContact, UserRole } from "@/lib/db/queries";
import { ParametresTabs } from "./ParametresTabs";
import styles from "./Parametres.module.css";

interface Props {
  searchParams: Promise<{ planningId?: string }>;
}

export default async function ParametresPage({ searchParams }: Props) {
  const { planningId: qPlanningId } = await searchParams;

  const [session, planningList, appCfg, permissions] = await Promise.all([
    auth(),
    listPlannings(),
    getAppSettings(),
    getPermissions(),
  ]);

  const userRole: UserRole = (session?.user?.role ?? "contact") as UserRole;

  if (!planningList.length) {
    return <div className={styles.empty}>Aucun planning disponible.</div>;
  }

  const activePlanningId = qPlanningId ?? planningList[0].id;
  const [data, existingUsers, activityEntries, connLogs, directoryContacts] = await Promise.all([
    getGanttData(activePlanningId),
    listUsersNotInPlanning(activePlanningId),
    getActivityLog(activePlanningId, 200),
    listConnectionLogs(200),
    listAllDirectoryContacts(),
  ]);
  if (!data) return <div className={styles.empty}>Données introuvables.</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Paramètres</h1>

        {/* Sélecteur de planning */}
        <div className={styles.planningSelector}>
          {planningList.map((p) => (
            <Link
              key={p.id}
              href={`/parametres?planningId=${p.id}`}
              className={`${styles.planningTab} ${p.id === activePlanningId ? styles.planningTabActive : ""}`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      </header>

      <ParametresTabs
        data={data}
        appCfg={appCfg}
        userRole={userRole}
        permissions={permissions}
        existingUsers={existingUsers as ExistingUserRow[]}
        activityEntries={activityEntries as ActivityEntry[]}
        connLogs={connLogs as ConnectionLogRow[]}
        directoryContacts={directoryContacts as DirectoryContact[]}
      />
    </div>
  );
}
