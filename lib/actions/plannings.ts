"use server";
/**
 * lib/actions/plannings.ts
 * Server actions for planning management (create, duplicate, archive).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  plannings, planningSettings, phaseTypes, milestoneTypes, statuses, domains,
  lots, phases, milestones,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Create Planning
// ---------------------------------------------------------------------------

const CreatePlanningSchema = z.object({
  name:        z.string().min(1).max(200),
  year:        z.coerce.number().int().min(2020).max(2040),
  viewStart:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  viewEnd:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional(),
  type:        z.enum(["mono", "multi"]).default("multi"),
});

export async function createPlanning(formData: FormData) {
  const raw = {
    name:        formData.get("name"),
    year:        formData.get("year"),
    viewStart:   formData.get("viewStart"),
    viewEnd:     formData.get("viewEnd"),
    description: formData.get("description") ?? undefined,
    type:        formData.get("type") ?? "multi",
  };

  const data = CreatePlanningSchema.parse(raw);

  const [planning] = await db.insert(plannings).values({
    name:          data.name,
    type:          data.type,
    year:          data.year,
    viewStart:     data.viewStart,
    viewEnd:       data.viewEnd,
    description:   data.description ?? null,
    referenceDate: new Date().toISOString().split("T")[0],
  }).returning({ id: plannings.id });

  await db.insert(planningSettings).values({
    planningId: planning.id,
    autoLate: true,
    autoCloseAfterMepDays: 30,
    notifyOnLate: true,
  });

  await db.insert(phaseTypes).values([
    { planningId: planning.id, code: "cadrage",   label: "Cadrage",        sortOrder: 0 },
    { planningId: planning.id, code: "dev",        label: "Développement",  sortOrder: 1 },
    { planningId: planning.id, code: "recette",    label: "Recette",        sortOrder: 2 },
    { planningId: planning.id, code: "formation",  label: "Formation",      sortOrder: 3 },
    { planningId: planning.id, code: "custom",     label: "Personnalisé",   sortOrder: 4 },
  ]);

  await db.insert(milestoneTypes).values([
    { planningId: planning.id, code: "livraison", label: "Livraison REC3",  color: "#0D9488", sortOrder: 0 },
    { planningId: planning.id, code: "pmep",      label: "Pré-MEP",        color: "#312E81", sortOrder: 1 },
    { planningId: planning.id, code: "cab",       label: "CAB",            color: "#65A30D", sortOrder: 2 },
    { planningId: planning.id, code: "mep",       label: "Mise en prod.",  color: "#1E3A8A", sortOrder: 3 },
    { planningId: planning.id, code: "custom",    label: "Jalon libre",    color: "#7C3AED", sortOrder: 4 },
  ]);

  await db.insert(statuses).values([
    { planningId: planning.id, code: "planned",     label: "Planifiée",  color: "#94A3B8", bg: "#F1F5F9", sortOrder: 0 },
    { planningId: planning.id, code: "in_progress", label: "En cours",   color: "#3B82F6", bg: "#E0EBFE", sortOrder: 1 },
    { planningId: planning.id, code: "review",      label: "En revue",   color: "#EAB308", bg: "#FEF3C7", sortOrder: 2 },
    { planningId: planning.id, code: "done",        label: "Terminée",   color: "#16A34A", bg: "#DCFCE7", sortOrder: 3 },
    { planningId: planning.id, code: "risk",        label: "À risque",   color: "#F59E0B", bg: "#FEF3C7", sortOrder: 4 },
    { planningId: planning.id, code: "late",        label: "En retard",  color: "#DC2626", bg: "#FEE2E2", sortOrder: 5 },
  ]);

  revalidatePath("/p");
  revalidatePath("/plannings");
  redirect(`/p/${planning.id}`);
}

// ---------------------------------------------------------------------------
// Duplicate Planning
// ---------------------------------------------------------------------------

export async function duplicatePlanning(sourcePlanningId: string, customName?: string): Promise<string> {
  // 1. Source planning
  const [src] = await db.select().from(plannings).where(eq(plannings.id, sourcePlanningId));
  if (!src) throw new Error("Planning source introuvable.");

  // 2. Create new planning (sans membres ni logs)
  const [newP] = await db.insert(plannings).values({
    name:          customName?.trim() || `${src.name} (copie)`,
    type:          src.type,
    year:          src.year,
    viewStart:     src.viewStart,
    viewEnd:       src.viewEnd,
    description:   src.description,
    referenceDate: src.referenceDate,
  }).returning({ id: plannings.id });

  const newId = newP.id;

  // 3. Copy config tables (types, statuses, settings)
  const [srcPhaseTypes, srcMilestoneTypes, srcStatuses, srcSettings] = await Promise.all([
    db.select().from(phaseTypes).where(eq(phaseTypes.planningId, sourcePlanningId)),
    db.select().from(milestoneTypes).where(eq(milestoneTypes.planningId, sourcePlanningId)),
    db.select().from(statuses).where(eq(statuses.planningId, sourcePlanningId)),
    db.select().from(planningSettings).where(eq(planningSettings.planningId, sourcePlanningId)).then(r => r[0] ?? null),
  ]);

  if (srcPhaseTypes.length > 0)
    await db.insert(phaseTypes).values(srcPhaseTypes.map(({ id: _id, planningId: _pid, ...rest }) => ({ ...rest, planningId: newId })));

  if (srcMilestoneTypes.length > 0)
    await db.insert(milestoneTypes).values(srcMilestoneTypes.map(({ id: _id, planningId: _pid, ...rest }) => ({ ...rest, planningId: newId })));

  if (srcStatuses.length > 0)
    await db.insert(statuses).values(srcStatuses.map(({ id: _id, planningId: _pid, ...rest }) => ({ ...rest, planningId: newId })));

  await db.insert(planningSettings).values({
    planningId: newId,
    autoLate: srcSettings?.autoLate ?? true,
    autoCloseAfterMepDays: srcSettings?.autoCloseAfterMepDays ?? 30,
    notifyOnLate: srcSettings?.notifyOnLate ?? true,
  });

  // 4. Copy structure: domains → lots → phases + milestones
  const srcDomains = await db.select().from(domains).where(eq(domains.planningId, sourcePlanningId));
  if (srcDomains.length > 0) {
    const domainIdMap: Record<string, string> = {};
    for (const d of srcDomains) {
      const { id: oldId, planningId: _pid, ...rest } = d;
      const [newD] = await db.insert(domains).values({ ...rest, planningId: newId }).returning({ id: domains.id });
      domainIdMap[oldId] = newD.id;
    }

    const srcLots = await db.select().from(lots).where(eq(lots.planningId, sourcePlanningId));
    if (srcLots.length > 0) {
      const lotIdMap: Record<string, string> = {};
      for (const l of srcLots) {
        const { id: oldId, planningId: _pid, domainId, ...rest } = l;
        const newDomainId = domainIdMap[domainId] ?? domainId;
        const [newL] = await db.insert(lots).values({ ...rest, planningId: newId, domainId: newDomainId }).returning({ id: lots.id });
        lotIdMap[oldId] = newL.id;
      }

      const srcLotIds = srcLots.map(l => l.id);

      const [srcPhases, srcMilestones] = await Promise.all([
        db.select().from(phases).where(inArray(phases.lotId, srcLotIds)),
        db.select().from(milestones).where(inArray(milestones.lotId, srcLotIds)),
      ]);

      if (srcPhases.length > 0)
        await db.insert(phases).values(
          srcPhases.map(({ id: _id, lotId, ...rest }) => ({ ...rest, lotId: lotIdMap[lotId] ?? lotId, progress: 0, status: null }))
        );

      if (srcMilestones.length > 0)
        await db.insert(milestones).values(
          srcMilestones.map(({ id: _id, lotId, ...rest }) => ({ ...rest, lotId: lotIdMap[lotId] ?? lotId }))
        );
    }
  }

  revalidatePath("/p");
  revalidatePath("/plannings");
  return newId;
}

// ---------------------------------------------------------------------------
// Rename / Update Planning metadata
// ---------------------------------------------------------------------------

const UpdatePlanningSchema = z.object({
  planningId:  z.string().uuid(),
  name:        z.string().min(1).max(200),
  year:        z.coerce.number().int().min(2020).max(2040),
  viewStart:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  viewEnd:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).nullable().optional(),
});

export async function updatePlanningMeta(input: z.infer<typeof UpdatePlanningSchema>) {
  const data = UpdatePlanningSchema.parse(input);
  await db.update(plannings)
    .set({
      name:        data.name,
      year:        data.year,
      viewStart:   data.viewStart,
      viewEnd:     data.viewEnd,
      description: data.description ?? null,
    })
    .where(eq(plannings.id, data.planningId));
  revalidatePath(`/p/${data.planningId}`);
  revalidatePath("/plannings");
  revalidatePath("/parametres");
}

// ---------------------------------------------------------------------------
// Delete Planning (hard delete — cascade)
// ---------------------------------------------------------------------------

export async function deletePlanning(planningId: string) {
  await db.delete(plannings).where(eq(plannings.id, planningId));
  revalidatePath("/plannings");
  revalidatePath("/p");
}

// ---------------------------------------------------------------------------
// Archive Planning
// ---------------------------------------------------------------------------

export async function archivePlanning(planningId: string) {
  await db.update(plannings).set({ archived: true }).where(eq(plannings.id, planningId));
  revalidatePath("/p");
  revalidatePath("/plannings");
}

// ---------------------------------------------------------------------------
// Import Planning from JSON
// ---------------------------------------------------------------------------

export async function importPlanningFromJSON(jsonStr: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    throw new Error("Fichier JSON invalide.");
  }

  if (!data?.klintPlanningExport) {
    throw new Error("Ce fichier n'est pas un export Klint Planning valide.");
  }

  const p = data.planning ?? {};

  // 1. Créer le planning
  const [newP] = await db.insert(plannings).values({
    name:          `${p.name ?? "Planning importé"} (import)`,
    type:          p.type ?? "multi",
    year:          Number(p.year) || new Date().getFullYear(),
    viewStart:     p.viewStart,
    viewEnd:       p.viewEnd,
    description:   p.description ?? null,
    referenceDate: p.referenceDate ?? new Date().toISOString().slice(0, 10),
  }).returning({ id: plannings.id });

  const newId = newP.id;

  // 2. Settings
  const s = data.settings;
  await db.insert(planningSettings).values({
    planningId:             newId,
    autoLate:               s?.autoLate ?? true,
    autoCloseAfterMepDays:  s?.autoCloseAfterMepDays ?? 30,
    notifyOnLate:           s?.notifyOnLate ?? true,
  });

  // 3. Phase types
  const ptArr = Array.isArray(data.phaseTypes) ? data.phaseTypes : [];
  if (ptArr.length > 0) {
    await db.insert(phaseTypes).values(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ptArr.map((pt: any, i: number) => ({
        planningId: newId,
        code:       String(pt.code ?? `pt_${i}`),
        label:      String(pt.label ?? ""),
        sortOrder:  Number(pt.sortOrder ?? i),
      }))
    );
  }

  // 4. Milestone types
  const mtArr = Array.isArray(data.milestoneTypes) ? data.milestoneTypes : [];
  if (mtArr.length > 0) {
    await db.insert(milestoneTypes).values(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mtArr.map((mt: any, i: number) => ({
        planningId: newId,
        code:       String(mt.code ?? `mt_${i}`),
        label:      String(mt.label ?? ""),
        color:      String(mt.color ?? "#000000"),
        sortOrder:  Number(mt.sortOrder ?? i),
      }))
    );
  }

  // 5. Statuses
  const stArr = Array.isArray(data.statuses) ? data.statuses : [];
  if (stArr.length > 0) {
    await db.insert(statuses).values(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stArr.map((st: any, i: number) => ({
        planningId: newId,
        code:       String(st.code ?? `st_${i}`),
        label:      String(st.label ?? ""),
        color:      String(st.color ?? "#000000"),
        bg:         String(st.bg ?? "#FFFFFF"),
        sortOrder:  Number(st.sortOrder ?? i),
      }))
    );
  }

  // 6. Domains → lots → phases + milestones
  const domainsArr = Array.isArray(data.domains) ? data.domains : [];
  for (const d of domainsArr) {
    const [newDomain] = await db.insert(domains).values({
      planningId: newId,
      code:       String(d.code ?? "DOM"),
      name:       String(d.name ?? "Domaine"),
      bg:         String(d.bg ?? "#F8FAFC"),
      bgAlt:      d.bgAlt ?? null,
      strong:     String(d.strong ?? "#001036"),
      phaseColor: String(d.phaseColor ?? "#3B82F6"),
      sortOrder:  Number(d.sortOrder ?? 0),
      collapsed:  Boolean(d.collapsed ?? false),
      cadence:    d.cadence ?? null,
    }).returning({ id: domains.id });

    const lotsArr = Array.isArray(d.lots) ? d.lots : [];
    for (const l of lotsArr) {
      const [newLot] = await db.insert(lots).values({
        planningId: newId,
        domainId:   newDomain.id,
        name:       String(l.name ?? "Lot"),
        subtitle:   l.subtitle ?? null,
        icon:       l.icon ?? null,
        sortOrder:  Number(l.sortOrder ?? 0),
        hidden:     Boolean(l.hidden ?? false),
      }).returning({ id: lots.id });

      const phasesArr = Array.isArray(l.phases) ? l.phases : [];
      if (phasesArr.length > 0) {
        await db.insert(phases).values(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          phasesArr.map((ph: any, idx: number) => ({
            lotId:     newLot.id,
            type:      String(ph.type ?? "custom"),
            label:     String(ph.label ?? ""),
            startDate: ph.startDate,
            endDate:   ph.endDate,
            status:    ph.status ?? null,
            progress:  Number(ph.progress ?? 0),
            color:     ph.color ?? null,
            note:      ph.note ?? null,
            sortOrder: Number(ph.sortOrder ?? idx),
          }))
        );
      }

      const msArr = Array.isArray(l.milestones) ? l.milestones : [];
      if (msArr.length > 0) {
        await db.insert(milestones).values(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          msArr.map((ms: any) => ({
            lotId:    newLot.id,
            type:     String(ms.type ?? "custom"),
            label:    String(ms.label ?? ""),
            date:     ms.date,
            color:    ms.color ?? null,
            labelPos: ms.labelPos ?? "above",
            note:     ms.note ?? null,
          }))
        );
      }
    }
  }

  revalidatePath("/plannings");
  revalidatePath("/p");
  return newId;
}

// ---------------------------------------------------------------------------
// Update Planning from JSON (mise à jour non-destructive)
// ---------------------------------------------------------------------------
// Stratégie :
//   - Domaines : matchés par `code`
//   - Lots     : matchés par `name` dans le domaine
//   - Phases   : matchées par `type` + `label` dans le lot → mise à jour dates/statut/etc.
//   - Jalons   : matchés par `type` + `label` dans le lot → mise à jour date/note/etc.
//   - Éléments non trouvés → création (ajout pur)
// ---------------------------------------------------------------------------
export async function updatePlanningFromJSON(planningId: string, jsonStr: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    throw new Error("Fichier JSON invalide.");
  }

  if (!data?.klintPlanningExport) {
    throw new Error("Ce fichier n'est pas un export Klint Planning valide.");
  }

  // Vérifier que le planning existe
  const [existing] = await db.select().from(plannings).where(eq(plannings.id, planningId));
  if (!existing) throw new Error("Planning introuvable.");

  // 1. Mettre à jour les métadonnées du planning (dates de vue, description)
  const p = data.planning ?? {};
  await db.update(plannings).set({
    viewStart:   p.viewStart   ?? existing.viewStart,
    viewEnd:     p.viewEnd     ?? existing.viewEnd,
    description: p.description ?? existing.description,
  }).where(eq(plannings.id, planningId));

  // 2. Charger la structure existante
  const [existingDomains, existingLots, existingPhases, existingMilestones] = await Promise.all([
    db.select().from(domains).where(eq(domains.planningId, planningId)),
    db.select().from(lots).where(eq(lots.planningId, planningId)),
    db.select().from(phases).where(
      inArray(
        phases.lotId,
        (await db.select({ id: lots.id }).from(lots).where(eq(lots.planningId, planningId))).map(l => l.id)
      )
    ),
    db.select().from(milestones).where(
      inArray(
        milestones.lotId,
        (await db.select({ id: lots.id }).from(lots).where(eq(lots.planningId, planningId))).map(l => l.id)
      )
    ),
  ]);

  // 3. Parcourir les domaines du JSON
  const domainsArr = Array.isArray(data.domains) ? data.domains : [];
  for (const d of domainsArr) {
    const domCode = String(d.code ?? "");
    const existingDomain = existingDomains.find((ed) => ed.code === domCode);
    let domainId: string;

    if (!existingDomain) {
      // Créer le domaine s'il n'existe pas
      const [newD] = await db.insert(domains).values({
        planningId,
        code:       domCode,
        name:       String(d.name ?? "Domaine"),
        bg:         String(d.bg ?? "#F8FAFC"),
        bgAlt:      d.bgAlt ?? null,
        strong:     String(d.strong ?? "#001036"),
        phaseColor: String(d.phaseColor ?? "#3B82F6"),
        sortOrder:  Number(d.sortOrder ?? 0),
        collapsed:  Boolean(d.collapsed ?? false),
        cadence:    d.cadence ?? null,
      }).returning({ id: domains.id });
      domainId = newD.id;
    } else {
      domainId = existingDomain.id;
    }

    const lotsArr = Array.isArray(d.lots) ? d.lots : [];
    for (const l of lotsArr) {
      const lotName = String(l.name ?? "");
      const existingLot = existingLots.find(
        (el) => el.domainId === domainId && el.name.trim().toLowerCase() === lotName.trim().toLowerCase()
      );
      let lotId: string;

      if (!existingLot) {
        // Créer le lot s'il n'existe pas
        const [newL] = await db.insert(lots).values({
          planningId,
          domainId,
          name:      lotName,
          subtitle:  l.subtitle ?? null,
          icon:      l.icon ?? null,
          sortOrder: Number(l.sortOrder ?? 0),
          hidden:    Boolean(l.hidden ?? false),
        }).returning({ id: lots.id });
        lotId = newL.id;
      } else {
        lotId = existingLot.id;
      }

      // Phases
      const phasesArr = Array.isArray(l.phases) ? l.phases : [];
      for (const ph of phasesArr) {
        const phType  = String(ph.type ?? "custom");
        const phLabel = String(ph.label ?? "");
        const matchPh = existingPhases.find(
          (ep) => ep.lotId === lotId && ep.type === phType &&
            (ep.label ?? "").trim().toLowerCase() === phLabel.trim().toLowerCase()
        );

        if (matchPh) {
          // Mise à jour des données modifiables
          await db.update(phases).set({
            startDate: ph.startDate ?? matchPh.startDate,
            endDate:   ph.endDate   ?? matchPh.endDate,
            status:    ph.status   !== undefined ? ph.status   : matchPh.status,
            progress:  ph.progress !== undefined ? Number(ph.progress) : matchPh.progress,
            color:     ph.color    !== undefined ? ph.color    : matchPh.color,
            note:      ph.note     !== undefined ? ph.note     : matchPh.note,
          }).where(eq(phases.id, matchPh.id));
        } else {
          // Création de la phase
          await db.insert(phases).values({
            lotId,
            type:      phType,
            label:     phLabel,
            startDate: ph.startDate,
            endDate:   ph.endDate,
            status:    ph.status    ?? null,
            progress:  Number(ph.progress ?? 0),
            color:     ph.color     ?? null,
            note:      ph.note      ?? null,
            sortOrder: Number(ph.sortOrder ?? 0),
          });
        }
      }

      // Jalons
      const msArr = Array.isArray(l.milestones) ? l.milestones : [];
      for (const ms of msArr) {
        const msType  = String(ms.type ?? "custom");
        const msLabel = String(ms.label ?? "");
        const matchMs = existingMilestones.find(
          (em) => em.lotId === lotId && em.type === msType &&
            (em.label ?? "").trim().toLowerCase() === msLabel.trim().toLowerCase()
        );

        if (matchMs) {
          await db.update(milestones).set({
            date:  ms.date  ?? matchMs.date,
            color: ms.color !== undefined ? ms.color : matchMs.color,
            note:  ms.note  !== undefined ? ms.note  : matchMs.note,
          }).where(eq(milestones.id, matchMs.id));
        } else {
          await db.insert(milestones).values({
            lotId,
            type:     msType,
            label:    msLabel,
            date:     ms.date,
            color:    ms.color    ?? null,
            labelPos: ms.labelPos ?? "above",
            note:     ms.note     ?? null,
          });
        }
      }
    }
  }

  revalidatePath("/plannings");
  revalidatePath(`/p/${planningId}`);
}
