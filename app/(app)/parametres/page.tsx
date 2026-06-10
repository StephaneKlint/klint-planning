export const dynamic = "force-dynamic";

import Link from "next/link";
import { listPlannings, getGanttData } from "@/lib/db/queries";
import { getAppSettings } from "@/lib/actions/appSettings";
import { ParametresTabs } from "./ParametresTabs";
import styles from "./Parametres.module.css";

interface Props {
  searchParams: Promise<{ planningId?: string }>;
}

export default async function ParametresPage({ searchParams }: Props) {
  const { planningId: qPlanningId } = await searchParams;

  const [planningList, appCfg] = await Promise.all([
    listPlannings(),
    getAppSettings(),
  ]);

  if (!planningList.length) {
    return <div className={styles.empty}>Aucun planning disponible.</div>;
  }

  const activePlanningId = qPlanningId ?? planningList[0].id;
  const data = await getGanttData(activePlanningId);
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

      <ParametresTabs data={data} appCfg={appCfg} />
    </div>
  );
}
