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
  lots, phases, milestones, activityLog, closurePeriods,
} from "@/lib/db/schema";
import { eq, inArray, isNotNull } from "drizzle-orm";

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

  await db.insert(activityLog).values({ planningId: planning.id, verb: "created", targetType: "planning", targetId: planning.id, summary: "Planning créé" }).catch(() => {});
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
  // Soft delete — déplace vers la corbeille (conservé 30 jours)
  await db.update(plannings)
    .set({ deletedAt: new Date() })
    .where(eq(plannings.id, planningId));
  await db.insert(activityLog).values({ planningId, verb: "deleted", targetType: "planning", targetId: planningId, summary: "Planning déplacé en corbeille" }).catch(() => {});
  revalidatePath("/plannings");
  revalidatePath("/p");
}

export async function restorePlanning(planningId: string) {
  await db.update(plannings)
    .set({ deletedAt: null })
    .where(eq(plannings.id, planningId));
  await db.insert(activityLog).values({ planningId, verb: "restored", targetType: "planning", targetId: planningId, summary: "Planning restauré depuis la corbeille" }).catch(() => {});
  revalidatePath("/plannings");
}

export async function permanentlyDeletePlanning(planningId: string) {
  await db.delete(plannings).where(eq(plannings.id, planningId));
  revalidatePath("/plannings");
  revalidatePath("/p");
}

// Purge automatique des plannings en corbeille depuis plus de 30 jours
export async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expired = await db.select({ id: plannings.id })
    .from(plannings)
    .where(isNotNull(plannings.deletedAt));
  // Filtrage côté JS sur la date (deletedAt est nullable mais typed)
  const ids = expired
    .filter((p) => p.id) // always truthy, refined below
    .map((p) => p.id);

  if (ids.length === 0) return;

  // Pour chaque planning candidat, on vérifie la date côté serveur
  // (évite d'avoir à utiliser sql`` pour un lt sur nullable timestamp)
  for (const id of ids) {
    const [row] = await db.select({ deletedAt: plannings.deletedAt }).from(plannings).where(eq(plannings.id, id));
    if (row?.deletedAt && new Date(row.deletedAt) < cutoff) {
      await db.delete(plannings).where(eq(plannings.id, id)).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Archive Planning
// ---------------------------------------------------------------------------

export async function archivePlanning(planningId: string) {
  await db.update(plannings).set({ archived: true }).where(eq(plannings.id, planningId));
  await db.insert(activityLog).values({ planningId, verb: "archived", targetType: "planning", targetId: planningId, summary: "Planning archivé" }).catch(() => {});
  revalidatePath("/p");
  revalidatePath("/plannings");
}

export async function disablePlanning(planningId: string) {
  await db.update(plannings).set({ disabled: true }).where(eq(plannings.id, planningId));
  revalidatePath("/plannings");
}

export async function enablePlanning(planningId: string) {
  await db.update(plannings).set({ disabled: false }).where(eq(plannings.id, planningId));
  revalidatePath("/plannings");
}

export async function unarchivePlanning(planningId: string) {
  await db.update(plannings).set({ archived: false }).where(eq(plannings.id, planningId));
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

  // 1. Créer le planning — toute la suite est dans un try/catch avec rollback
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

  try {

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

  } catch (err) {
    // Rollback : suppression physique du planning créé pour éviter une coquille vide
    await db.delete(plannings).where(eq(plannings.id, newId)).catch(() => {});
    throw err;
  }

  await db.insert(activityLog).values({ planningId: newId, verb: "imported", targetType: "planning", targetId: newId, summary: "Planning importé depuis JSON" }).catch(() => {});
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

// ---------------------------------------------------------------------------
// Import depuis l'ancien format (cci_planning_2026)
// ---------------------------------------------------------------------------
// Structure ancienne : { domains[], projects[], closedPeriods[] }
// Structure nouvelle : { klintPlanningExport, planning, domains[{lots[]}] }
// ---------------------------------------------------------------------------

function hexLighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const v = (c: number) => Math.min(255, Math.round(c + (255 - c) * amount));
  return `#${v(r).toString(16).padStart(2, "0")}${v(g).toString(16).padStart(2, "0")}${v(b).toString(16).padStart(2, "0")}`;
}

function hexDarken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const v = (c: number) => Math.round(c * (1 - amount));
  return `#${v(r).toString(16).padStart(2, "0")}${v(g).toString(16).padStart(2, "0")}${v(b).toString(16).padStart(2, "0")}`;
}

function seedColorToDomainColors(seed: string) {
  const hex = seed.startsWith("#") ? seed : `#${seed}`;
  return {
    bg:         hexLighten(hex, 0.88),
    bgAlt:      hexLighten(hex, 0.75),
    strong:     hexDarken(hex, 0.4),
    phaseColor: hex,
  };
}

const LEGACY_STATUS_MAP: Record<string, string> = {
  done:        "done",
  in_progress: "in_progress",
  planned:     "planned",
  review:      "review",
  risk:        "risk",
  late:        "late",
};

export async function importLegacyPlanningJSON(planningId: string, jsonStr: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    throw new Error("Fichier JSON invalide.");
  }

  if (!data?.domains || !data?.projects) {
    throw new Error("Ce fichier ne semble pas être un export de l'ancienne application Klint Planning.");
  }

  // Verify planning exists
  const [existing] = await db.select().from(plannings).where(eq(plannings.id, planningId));
  if (!existing) throw new Error("Planning introuvable.");

  // Build domain id map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domainMap: Record<string, string> = {}; // oldId → new DB id

  for (let i = 0; i < data.domains.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = data.domains[i];
    const seed  = String(d.seedColor ?? "#3B82F6");
    const { bg, bgAlt, strong, phaseColor } = seedColorToDomainColors(seed);
    const name  = String(d.name ?? "Domaine");
    const code  = name.toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 40) || `DOM${i}`;

    const [newDom] = await db.insert(domains).values({
      planningId,
      code,
      name,
      bg,
      bgAlt,
      strong,
      phaseColor,
      sortOrder: i,
      collapsed: false,
      cadence: { livraison: 0, pmep: 10, cab: 12, mep: 15 },
    }).returning({ id: domains.id });

    domainMap[String(d.id)] = newDom.id;
  }

  // Import projects → lots (each project = 1 lot in its domain)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectsArr: any[] = Array.isArray(data.projects) ? data.projects : [];
  for (let i = 0; i < projectsArr.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = projectsArr[i];
    const domainId = domainMap[String(p.domain ?? p.parentId ?? "")];
    if (!domainId) continue; // skip orphaned projects

    const [newLot] = await db.insert(lots).values({
      planningId,
      domainId,
      name:      String(p.name ?? "Lot"),
      subtitle:  p.subtitle ? String(p.subtitle) : null,
      sortOrder: i,
      hidden:    false,
    }).returning({ id: lots.id });

    // Phases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phasesArr: any[] = Array.isArray(p.phases) ? p.phases : [];
    if (phasesArr.length > 0) {
      await db.insert(phases).values(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phasesArr.map((ph: any, idx: number) => ({
          lotId:     newLot.id,
          type:      String(ph.type ?? "custom"),
          label:     ph.label ? String(ph.label) : null,
          startDate: String(ph.start ?? ph.startDate),
          endDate:   String(ph.end ?? ph.endDate),
          status:    (ph.status ? (LEGACY_STATUS_MAP[ph.status] ?? null) : null) as "planned" | "in_progress" | "review" | "done" | "risk" | "late" | null,
          progress:  0,
          sortOrder: idx,
        }))
      );
    }

    // Milestones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msArr: any[] = Array.isArray(p.milestones) ? p.milestones : [];
    if (msArr.length > 0) {
      await db.insert(milestones).values(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        msArr.map((ms: any) => ({
          lotId:    newLot.id,
          type:     String(ms.type ?? "custom"),
          label:    String(ms.label ?? ""),
          date:     String(ms.date),
          labelPos: "above" as const,
        }))
      );
    }
  }

  // Import closed periods → closurePeriods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closedArr: any[] = Array.isArray(data.closedPeriods) ? data.closedPeriods : [];
  if (closedArr.length > 0) {
    await db.insert(closurePeriods).values(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      closedArr.map((cp: any, idx: number) => ({
        planningId,
        label:     String(cp.label ?? "Fermeture"),
        startDate: String(cp.start ?? cp.startDate),
        endDate:   String(cp.end ?? cp.endDate),
        color:     "#FEF3C7",
        type:      "custom" as const,
        active:    true,
        sortOrder: idx,
      }))
    );
  }

  await db.insert(activityLog).values({
    planningId,
    verb:       "imported",
    targetType: "planning",
    targetId:   planningId,
    summary:    "Planning importé depuis l'ancien format (cci_planning_2026)",
  }).catch(() => {});

  revalidatePath(`/p/${planningId}`);
  revalidatePath("/plannings");
}

// ---------------------------------------------------------------------------
// Bibliothèque de modèles (templates)
// ---------------------------------------------------------------------------

export async function setTemplateFlag(planningId: string, isTemplate: boolean): Promise<void> {
  await db.update(plannings).set({ isTemplate }).where(eq(plannings.id, planningId));
  revalidatePath("/plannings");
  revalidatePath("/plannings/nouveau");
}

export async function createPlanningFromTemplate(
  templateId: string,
  name: string,
  referenceDate: string
): Promise<string> {
  // 1. Duplicate the template (reuses all config + structure)
  const newId = await duplicatePlanning(templateId, name);

  // 2. Find earliest date in the new planning
  const newLots = await db.select({ id: lots.id }).from(lots).where(eq(lots.planningId, newId));
  if (!newLots.length) return newId;

  const lotIds = newLots.map((l) => l.id);
  const [newPhases, newMilestones] = await Promise.all([
    db.select({ id: phases.id, startDate: phases.startDate, endDate: phases.endDate })
      .from(phases).where(inArray(phases.lotId, lotIds)),
    db.select({ id: milestones.id, date: milestones.date })
      .from(milestones).where(inArray(milestones.lotId, lotIds)),
  ]);

  const allDates = [
    ...newPhases.map((p) => p.startDate),
    ...newMilestones.map((m) => m.date),
  ];
  if (!allDates.length) return newId;

  const earliest = allDates.reduce((a, b) => (a < b ? a : b));
  const offsetDays = Math.round(
    (new Date(referenceDate).getTime() - new Date(earliest).getTime()) / 86400000
  );

  if (offsetDays === 0) return newId;

  const shiftDate = (d: string): string => {
    const dt = new Date(d + "T12:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + offsetDays);
    return dt.toISOString().slice(0, 10);
  };

  // 3. Shift all phases, milestones, and planning view dates
  await Promise.all([
    ...newPhases.map((p) =>
      db.update(phases)
        .set({ startDate: shiftDate(p.startDate), endDate: shiftDate(p.endDate) })
        .where(eq(phases.id, p.id))
    ),
    ...newMilestones.map((m) =>
      db.update(milestones)
        .set({ date: shiftDate(m.date) })
        .where(eq(milestones.id, m.id))
    ),
  ]);

  const [src] = await db.select().from(plannings).where(eq(plannings.id, templateId));
  if (src) {
    await db.update(plannings).set({
      viewStart:     shiftDate(src.viewStart),
      viewEnd:       shiftDate(src.viewEnd),
      referenceDate: src.referenceDate ? shiftDate(src.referenceDate) : null,
    }).where(eq(plannings.id, newId));
  }

  revalidatePath("/plannings");
  return newId;
}
