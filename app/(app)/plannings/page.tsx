export const dynamic = "force-dynamic";

import Link from "next/link";
import { listPlannings } from "@/lib/db/queries";
import { PlanningListClient } from "./PlanningListClient";
import styles from "./Plannings.module.css";

export default async function PlanningsPage() {
  const plannings = await listPlannings();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Mes plannings</h1>
          <p className={styles.subtitle}>{plannings.length} planning{plannings.length > 1 ? "s" : ""} actif{plannings.length > 1 ? "s" : ""}</p>
        </div>
        <Link href="/plannings/nouveau" className={styles.newBtn}>
          + Nouveau planning
        </Link>
      </header>

      <PlanningListClient plannings={plannings} />
    </div>
  );
}
