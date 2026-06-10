"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { duplicatePlanning, archivePlanning } from "@/lib/actions/plannings";
import styles from "./Plannings.module.css";

type PlanningRow = {
  id: string;
  name: string;
  year: number;
  type: string;
  archived: boolean;
  viewStart: string;
  viewEnd: string;
  createdAt: Date;
};

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const TYPE_LABELS: Record<string, string> = {
  multi: "Multi-projets",
  mono:  "Mono-projet",
};

export function PlanningListClient({ plannings }: { plannings: PlanningRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [action, setAction] = useState<"dup" | "archive" | null>(null);

  const handleDuplicate = (p: PlanningRow) => {
    if (isPending) return;
    setLoadingId(p.id);
    setAction("dup");
    startTransition(async () => {
      const newId = await duplicatePlanning(p.id);
      router.push(`/p/${newId}`);
    });
  };

  const handleArchive = (p: PlanningRow) => {
    if (!confirm(`Archiver "${p.name}" ? Il ne sera plus accessible depuis la liste.`)) return;
    if (isPending) return;
    setLoadingId(p.id);
    setAction("archive");
    startTransition(async () => {
      await archivePlanning(p.id);
      setLoadingId(null);
      setAction(null);
      router.refresh();
    });
  };

  if (plannings.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Aucun planning actif</p>
        <p className={styles.emptyDesc}>Créez votre premier planning pour démarrer.</p>
        <Link href="/plannings/nouveau" className={styles.emptyBtn}>
          + Nouveau planning
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {plannings.map((p) => {
        const isThis = loadingId === p.id;
        return (
          <div key={p.id} className={styles.card}>
            {/* Header */}
            <div className={styles.cardHead}>
              <span className={styles.cardType}>{TYPE_LABELS[p.type] ?? p.type}</span>
              <span className={styles.cardYear}>{p.year}</span>
            </div>

            {/* Title */}
            <Link href={`/p/${p.id}`} className={styles.cardTitle}>
              {p.name}
            </Link>

            {/* Meta */}
            <p className={styles.cardMeta}>
              {fmtDate(p.viewStart)} → {fmtDate(p.viewEnd)}
            </p>

            {/* Actions */}
            <div className={styles.cardActions}>
              <Link href={`/p/${p.id}`} className={styles.openBtn}>
                Ouvrir →
              </Link>
              <button
                className={styles.dupBtn}
                onClick={() => handleDuplicate(p)}
                disabled={isPending}
                title="Dupliquer ce planning"
              >
                {isThis && action === "dup" ? "Copie en cours…" : "⧉ Dupliquer"}
              </button>
              <button
                className={styles.archiveBtn}
                onClick={() => handleArchive(p)}
                disabled={isPending}
                title="Archiver ce planning"
              >
                {isThis && action === "archive" ? "Archivage…" : "Archive"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
