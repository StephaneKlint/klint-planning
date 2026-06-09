export const dynamic = "force-dynamic";

import { listPlannings, getGanttData } from "@/lib/db/queries";
import styles from "./Ressources.module.css";
import { RessourcesClient } from "./RessourcesClient";

export default async function RessourcesPage() {
  const planningList = await listPlannings();
  if (!planningList.length) {
    return <div className={styles.empty}>Aucun planning disponible.</div>;
  }

  const data = await getGanttData(planningList[0].id);
  if (!data) return <div className={styles.empty}>Données introuvables.</div>;

  return <RessourcesClient data={data} />;
}
