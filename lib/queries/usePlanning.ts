"use client";
/**
 * lib/queries/usePlanning.ts
 * TanStack Query hook — polling toutes les 10s pour sync multi-utilisateurs.
 * IMPORTANT: Ne pas importer lib/db/* ici — module client.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GanttData } from "@/lib/db/queries";
import { fetchPlanningData } from "@/lib/actions/planning";

export const planningQueryKey = (id: string) => ["planning", id] as const;

export function usePlanning(planningId: string, initialData: GanttData) {
  return useQuery({
    queryKey: planningQueryKey(planningId),
    queryFn: () => fetchPlanningData(planningId),
    initialData,
    staleTime: 8_000,           // données fraîches pendant 8s
    refetchInterval: 10_000,    // ← polling toutes les 10s (multi-utilisateurs)
    refetchOnWindowFocus: true,
  });
}

export function useOptimisticPhase() {
  const qc = useQueryClient();
  return function patchPhase(
    planningId: string,
    phaseId: string,
    patch: Partial<GanttData["phases"][0]>
  ) {
    qc.setQueryData<GanttData>(planningQueryKey(planningId), (old) => {
      if (!old) return old;
      return { ...old, phases: old.phases.map((p) => p.id === phaseId ? { ...p, ...patch } : p) };
    });
  };
}

export function useOptimisticMilestone() {
  const qc = useQueryClient();
  return function patchMilestone(
    planningId: string,
    milestoneId: string,
    patch: Partial<GanttData["milestones"][0]>
  ) {
    qc.setQueryData<GanttData>(planningQueryKey(planningId), (old) => {
      if (!old) return old;
      return { ...old, milestones: old.milestones.map((m) => m.id === milestoneId ? { ...m, ...patch } : m) };
    });
  };
}
