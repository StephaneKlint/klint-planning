"use client";

import { useRouter } from "next/navigation";
import styles from "./Parametres.module.css";

interface Planning {
  id: string;
  name: string;
}

interface Props {
  plannings: Planning[];
  activePlanningId: string;
}

export function PlanningSelector({ plannings, activePlanningId }: Props) {
  const router = useRouter();

  if (plannings.length <= 1) return null;

  return (
    <select
      className={styles.planningSelect}
      value={activePlanningId}
      onChange={(e) => router.push(`/parametres?planningId=${e.target.value}`)}
      aria-label="Sélectionner un planning"
    >
      {plannings.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
