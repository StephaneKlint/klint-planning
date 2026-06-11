"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { closurePeriods } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ── Jours fériés français ────────────────────────────────────────────────────

const FRENCH_HOLIDAYS_2025 = [
  { label: "Jour de l'An",       date: "2025-01-01" },
  { label: "Lundi de Pâques",    date: "2025-04-21" },
  { label: "Fête du Travail",    date: "2025-05-01" },
  { label: "Victoire 1945",      date: "2025-05-08" },
  { label: "Ascension",          date: "2025-05-29" },
  { label: "Lundi de Pentecôte", date: "2025-06-09" },
  { label: "Fête Nationale",     date: "2025-07-14" },
  { label: "Assomption",         date: "2025-08-15" },
  { label: "Toussaint",          date: "2025-11-01" },
  { label: "Armistice",          date: "2025-11-11" },
  { label: "Noël",               date: "2025-12-25" },
];

const FRENCH_HOLIDAYS_2026 = [
  { label: "Jour de l'An",       date: "2026-01-01" },
  { label: "Lundi de Pâques",    date: "2026-04-06" },
  { label: "Fête du Travail",    date: "2026-05-01" },
  { label: "Victoire 1945",      date: "2026-05-08" },
  { label: "Ascension",          date: "2026-05-14" },
  { label: "Lundi de Pentecôte", date: "2026-05-25" },
  { label: "Fête Nationale",     date: "2026-07-14" },
  { label: "Assomption",         date: "2026-08-17" },
  { label: "Toussaint",          date: "2026-11-02" },
  { label: "Armistice",          date: "2026-11-11" },
  { label: "Noël",               date: "2026-12-25" },
];

function getHolidays(year: number) {
  if (year === 2025) return FRENCH_HOLIDAYS_2025;
  if (year === 2026) return FRENCH_HOLIDAYS_2026;
  // Fallback: 2025 dates as a base (fixed holidays only)
  return FRENCH_HOLIDAYS_2025;
}

// ── Actions ──────────────────────────────────────────────────────────────────

export async function seedHolidays(planningId: string, year: number) {
  const holidays = getHolidays(year);
  // Load existing holidays to avoid duplicates (by date + type)
  const existing = await db
    .select({ startDate: closurePeriods.startDate })
    .from(closurePeriods)
    .where(eq(closurePeriods.planningId, planningId));
  const existingDates = new Set(existing.map((e) => e.startDate));

  const toInsert = holidays
    .filter((h) => !existingDates.has(h.date))
    .map((h, i) => ({
      planningId,
      label: h.label,
      startDate: h.date,
      endDate: h.date,
      color: "#FEF3C7",
      type: "holiday" as const,
      sortOrder: i,
    }));

  if (toInsert.length > 0) {
    await db.insert(closurePeriods).values(toInsert);
  }

  revalidatePath("/parametres");
  revalidatePath(`/p/${planningId}`);
  return { inserted: toInsert.length };
}

export async function createClosurePeriod(data: {
  planningId: string;
  label: string;
  startDate: string;
  endDate: string;
  color: string;
  type: "holiday" | "custom";
}) {
  await db.insert(closurePeriods).values(data);
  revalidatePath("/parametres");
  revalidatePath(`/p/${data.planningId}`);
}

export async function updateClosurePeriod(
  id: string,
  data: {
    label?: string;
    startDate?: string;
    endDate?: string;
    color?: string;
    active?: boolean;
  }
) {
  const [row] = await db
    .update(closurePeriods)
    .set(data)
    .where(eq(closurePeriods.id, id))
    .returning({ planningId: closurePeriods.planningId });
  if (row) {
    revalidatePath("/parametres");
    revalidatePath(`/p/${row.planningId}`);
  }
}

export async function deleteClosurePeriod(id: string, planningId: string) {
  await db.delete(closurePeriods).where(eq(closurePeriods.id, id));
  revalidatePath("/parametres");
  revalidatePath(`/p/${planningId}`);
}
