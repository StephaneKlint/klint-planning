/**
 * /presentation — Mode présentation Gantt plein écran.
 * Accepte ?planningId=xxx pour choisir le planning.
 * Sans planningId et avec plusieurs plannings → affiche un sélecteur.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getGanttData, listPlannings, listPlanningsForUser } from "@/lib/db/queries";
import { PresentationView } from "./PresentationView";
import styles from "./Presentation.module.css";

interface Props {
  searchParams: Promise<{ planningId?: string }>;
}

export default async function PresentationPage({ searchParams }: Props) {
  const { planningId } = await searchParams;

  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role ?? "contact";

  const plannings = userId && role !== "admin"
    ? await listPlanningsForUser(userId)
    : await listPlannings();

  // Si un planningId est fourni → vérifier l'accès puis charger
  if (planningId) {
    const hasAccess = role === "admin" || plannings.some((p) => p.id === planningId);
    if (!hasAccess) notFound();
    const data = await getGanttData(planningId);
    if (!data) notFound();
    return <PresentationView data={data} planningId={planningId} />;
  }

  // Un seul planning → redirection automatique
  if (plannings.length === 1) {
    redirect(`/presentation?planningId=${plannings[0].id}`);
  }

  // Aucun planning accessible
  if (plannings.length === 0) {
    return (
      <div className={styles.selector}>
        <h1 className={styles.selectorTitle}>Mode présentation</h1>
        <p className={styles.selectorDesc}>Vous n&apos;êtes encore membre d&apos;aucun planning actif.</p>
      </div>
    );
  }

  // Plusieurs plannings → sélecteur
  return (
    <div className={styles.selector}>
      <h1 className={styles.selectorTitle}>Mode présentation</h1>
      <p className={styles.selectorDesc}>Choisissez le planning à afficher en plein écran.</p>
      <div className={styles.selectorList}>
        {plannings.map((p) => (
          <Link
            key={p.id}
            href={`/presentation?planningId=${p.id}`}
            className={styles.selectorItem}
          >
            <span>{p.name} — {p.year}</span>
            <span className={styles.selectorItemArrow}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
