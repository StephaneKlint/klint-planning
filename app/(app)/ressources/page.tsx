export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { listPlannings, listPlanningsForUser, getGanttData, listUsersNotInPlanning } from "@/lib/db/queries";
import styles from "./Ressources.module.css";
import { RessourcesClient } from "./RessourcesClient";

interface Props {
  searchParams: Promise<{ planningId?: string }>;
}

export default async function RessourcesPage({ searchParams }: Props) {
  const { planningId: qPlanningId } = await searchParams;

  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role ?? "contact";

  const planningList = userId && role !== "admin"
    ? await listPlanningsForUser(userId)
    : await listPlannings();

  if (!planningList.length) {
    return <div className={styles.empty}>Aucun planning disponible.</div>;
  }

  const activePlanningId = qPlanningId ?? planningList[0].id;

  // Vérifier l'accès si planningId vient de l'URL
  if (qPlanningId && role !== "admin" && !planningList.find((p) => p.id === activePlanningId)) {
    notFound();
  }

  const [data, existingUsers] = await Promise.all([
    getGanttData(activePlanningId),
    listUsersNotInPlanning(activePlanningId),
  ]);
  if (!data) return <div className={styles.empty}>Données introuvables.</div>;

  return (
    <>
      {/* Sélecteur de planning (si plusieurs) */}
      {planningList.length > 1 && (
        <div style={{ display: "flex", gap: 6, padding: "16px 32px 0", flexWrap: "wrap" }}>
          {planningList.map((p) => (
            <Link
              key={p.id}
              href={`/ressources?planningId=${p.id}`}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                border: "1px solid var(--klint-line)",
                background: p.id === activePlanningId ? "var(--klint-navy)" : "transparent",
                color: p.id === activePlanningId ? "white" : "var(--klint-navy)",
                textDecoration: "none",
                transition: "background 120ms, color 120ms",
              }}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}
      <RessourcesClient data={data} existingUsers={existingUsers} />
    </>
  );
}
