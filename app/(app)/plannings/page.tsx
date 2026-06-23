export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/auth";
import { listPlannings, getAccessiblePlanningIds } from "@/lib/db/queries";
import { PlanningListClient } from "./PlanningListClient";
import styles from "./Plannings.module.css";

export default async function PlanningsPage() {
  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role ?? "contact";

  const [active, archived, disabled, trashed] = await Promise.all([
    listPlannings("active"),
    listPlannings("archived"),
    listPlannings("disabled"),
    listPlannings("trashed"),
  ]);

  // Non-admins only see plannings they belong to
  let activeFiltered   = active;
  let archivedFiltered = archived;
  let disabledFiltered = disabled;
  let trashedFiltered  = trashed;

  if (role !== "admin" && userId) {
    const accessIds = await getAccessiblePlanningIds(userId);
    activeFiltered   = active.filter((p) => accessIds.has(p.id));
    archivedFiltered = archived.filter((p) => accessIds.has(p.id));
    disabledFiltered = disabled.filter((p) => accessIds.has(p.id));
    trashedFiltered  = trashed.filter((p) => accessIds.has(p.id));
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Mes plannings</h1>
          <p className={styles.subtitle}>{activeFiltered.length} planning{activeFiltered.length > 1 ? "s" : ""} actif{activeFiltered.length > 1 ? "s" : ""}</p>
        </div>
        {role === "admin" && (
          <Link href="/plannings/nouveau" className={styles.newBtn}>
            + Nouveau planning
          </Link>
        )}
      </header>

      <PlanningListClient
        active={activeFiltered}
        archived={archivedFiltered}
        disabled={disabledFiltered}
        trashed={trashedFiltered}
      />
    </div>
  );
}
