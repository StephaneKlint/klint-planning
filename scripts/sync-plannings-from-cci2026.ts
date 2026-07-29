/**
 * Sync E-facturation et CCI 2026_S2 depuis CCI 2026 (référence).
 *
 * Étapes :
 *   1. Renommages (aligner les noms de lots sur CCI 2026)
 *   2. Suppressions (lots sans équivalent dans CCI 2026)
 *   3. Sync du contenu lot par lot (sous-titre, phases, jalons)
 *
 * E-facturation : mise à jour uniquement des lots existants (pas de création)
 * CCI 2026_S2   : création des lots manquants + mise à jour de tous les lots
 *
 * Dry-run par défaut.
 * Pour exécuter :
 *   DATABASE_URL=<pooled_url> npx tsx scripts/sync-plannings-from-cci2026.ts --execute
 */
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (!DATABASE_URL) throw new Error("DATABASE_URL manquant");
const sql = neon(DATABASE_URL);
const EXECUTE = process.argv.includes("--execute");

const REF   = "10467e34-18ae-4fca-9c13-60156dc00a69"; // CCI 2026
const EFACT = "802d91e7-04fd-451a-966f-54d0d26ed7c1"; // E-facturation
const S2    = "de5b6a5e-d765-404b-9db4-756170431e06"; // CCI 2026_S2

const n = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// ── 1. Renommages ─────────────────────────────────────────────────────────────
// Lots dont le nom doit être aligné sur CCI 2026 avant la sync
const RENAMES: Array<{ planningId: string; domNorm: string; oldNorm: string; newName: string }> = [
  { planningId: S2,    domNorm: "e-facturation", oldNorm: "e-invoicing céos",     newName: "E-Facturation CÉOS" },
  { planningId: S2,    domNorm: "e-facturation", oldNorm: "e-invoicing nse / 91", newName: "E-Facturation NSE / 91" },
  { planningId: S2,    domNorm: "e-facturation", oldNorm: "e-facturation",        newName: "E-Facturation - AMO" },
  { planningId: EFACT, domNorm: "e-facturation", oldNorm: "e-facturation",        newName: "E-Facturation - AMO" },
];

// ── 2. Suppressions ───────────────────────────────────────────────────────────
// Lots à supprimer car sans équivalent dans CCI 2026
const DELETE_LOTS: Array<{ planningId: string; domNorm: string; lotNorm: string }> = [
  { planningId: S2, domNorm: "e-facturation", lotNorm: "e-invoicing" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type Domain = {
  id: string; name: string; planningId: string;
  code: string; bg: string; bgAlt: string; strong: string; phaseColor: string;
  sortOrder: number; collapsed: boolean; cadence: unknown;
};
type Lot = {
  id: string; name: string; subtitle: string | null;
  domainId: string; planningId: string; sortOrder: number;
};
type Phase = {
  id: string; type: string; label: string | null;
  startDate: string; endDate: string; status: string | null; progress: number;
  color: string | null; note: string | null; sortOrder: number;
  lotId: string; syncGroupId: string | null;
};
type Milestone = {
  id: string; type: string; label: string; date: string;
  color: string | null; labelPos: string; note: string | null;
  lotId: string; syncGroupId: string | null;
};
type Data = { domains: Domain[]; lots: Lot[]; phases: Phase[]; milestones: Milestone[] };

// ── Chargement ────────────────────────────────────────────────────────────────
async function loadData(planningId: string): Promise<Data> {
  const domains = await sql`
    SELECT id, name, planning_id AS "planningId", code, bg,
           bg_alt AS "bgAlt", strong, phase_color AS "phaseColor",
           sort_order AS "sortOrder", collapsed, cadence
    FROM domains WHERE planning_id = ${planningId}
  `;
  const lots = await sql`
    SELECT id, name, subtitle, domain_id AS "domainId",
           planning_id AS "planningId", sort_order AS "sortOrder"
    FROM lots WHERE planning_id = ${planningId}
  `;
  const phases = await sql`
    SELECT p.id, p.type, p.label,
           to_char(p.start_date, 'YYYY-MM-DD') AS "startDate",
           to_char(p.end_date,   'YYYY-MM-DD') AS "endDate",
           p.status, p.progress, p.color, p.note,
           p.sort_order AS "sortOrder",
           p.lot_id AS "lotId", p.sync_group_id AS "syncGroupId"
    FROM phases p
    JOIN lots l ON l.id = p.lot_id
    WHERE l.planning_id = ${planningId}
  `;
  const milestones = await sql`
    SELECT m.id, m.type, m.label,
           to_char(m.date, 'YYYY-MM-DD') AS "date",
           m.color, m.label_pos AS "labelPos", m.note,
           m.lot_id AS "lotId", m.sync_group_id AS "syncGroupId"
    FROM milestones m
    JOIN lots l ON l.id = m.lot_id
    WHERE l.planning_id = ${planningId}
  `;
  return {
    domains: domains as Domain[],
    lots: lots as Lot[],
    phases: phases as Phase[],
    milestones: milestones as Milestone[],
  };
}

// Parmi plusieurs candidats, retourne celui dont la startDate est la plus proche de refDate
function closestPhase(candidates: Phase[], refDate: string): Phase | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const rt = new Date(refDate).getTime();
  return candidates.reduce((best, cur) => {
    const bd = Math.abs(new Date(best.startDate).getTime() - rt);
    const cd = Math.abs(new Date(cur.startDate).getTime() - rt);
    return cd < bd ? cur : best;
  });
}

type SyncResult = { added: number; deleted: number; updated: number; logs: string[] };

// ── Sync phases ───────────────────────────────────────────────────────────────
async function syncPhases(
  refPhases: Phase[], targetPhases: Phase[],
  targetLotId: string, _lotKey: string
): Promise<SyncResult> {
  const result: SyncResult = { added: 0, deleted: 0, updated: 0, logs: [] };
  const log = (s: string) => result.logs.push(s);
  const matched = new Set<string>();

  // Lookup : syncGroupId → phase ; label_norm → [phases] ; type_norm → [phases]
  const tBySyncGroup = new Map<string, Phase>();
  const tByLabel = new Map<string, Phase[]>();
  const tByType  = new Map<string, Phase[]>();
  for (const tp of targetPhases) {
    if (tp.syncGroupId) tBySyncGroup.set(tp.syncGroupId, tp);
    if (tp.label) {
      const k = n(tp.label);
      if (!tByLabel.has(k)) tByLabel.set(k, []);
      tByLabel.get(k)!.push(tp);
    }
    const tk = n(tp.type);
    if (!tByType.has(tk)) tByType.set(tk, []);
    tByType.get(tk)!.push(tp);
  }

  for (const rp of refPhases) {
    // Matching : 1) syncGroupId  2) label + date la plus proche  3) type + date la plus proche
    let tp: Phase | undefined;
    if (rp.syncGroupId) tp = tBySyncGroup.get(rp.syncGroupId);
    if (!tp && rp.label) {
      const k = n(rp.label);
      const candidates = (tByLabel.get(k) ?? []).filter(x => !matched.has(x.id));
      tp = closestPhase(candidates, rp.startDate);
    }
    if (!tp) {
      const tk = n(rp.type);
      const candidates = (tByType.get(tk) ?? []).filter(x => !matched.has(x.id));
      tp = closestPhase(candidates, rp.startDate);
    }

    if (!tp) {
      result.added++;
      log(`       ➕ Phase ajoutée   : "${rp.label}" ${rp.startDate}→${rp.endDate}`);
      if (EXECUTE) {
        await sql`
          INSERT INTO phases
            (id, lot_id, type, label, start_date, end_date, status, progress,
             color, note, sort_order, sync_group_id)
          SELECT ${randomUUID()}, ${targetLotId}, type, label, start_date, end_date,
                 status, progress, color, note, sort_order, ${rp.syncGroupId ?? null}
          FROM phases WHERE id = ${rp.id}
        `;
      }
      continue;
    }

    matched.add(tp.id);

    // Si ref.label est null, on ne force pas null sur la cible (on garde son label)
    const labelNeedsUpdate = rp.label !== null && tp.label !== rp.label;
    const effectiveLabel   = rp.label ?? tp.label;

    const needsUpdate =
      labelNeedsUpdate || tp.startDate !== rp.startDate ||
      tp.endDate !== rp.endDate || tp.status !== rp.status ||
      tp.progress !== rp.progress;

    if (needsUpdate) {
      result.updated++;
      const ch: string[] = [];
      if (labelNeedsUpdate)              ch.push(`label "${tp.label}"→"${rp.label}"`);
      if (tp.startDate !== rp.startDate) ch.push(`start ${tp.startDate}→${rp.startDate}`);
      if (tp.endDate !== rp.endDate)     ch.push(`end ${tp.endDate}→${rp.endDate}`);
      if (tp.status !== rp.status)       ch.push(`status ${tp.status}→${rp.status}`);
      if (tp.progress !== rp.progress)   ch.push(`progress ${tp.progress}→${rp.progress}`);
      log(`       ✏️  Phase MàJ        : "${effectiveLabel}" — ${ch.join(", ")}`);
      if (EXECUTE) {
        if (labelNeedsUpdate) {
          await sql`
            UPDATE phases SET
              label = ${rp.label}, start_date = ${rp.startDate}, end_date = ${rp.endDate},
              status = ${rp.status}, progress = ${rp.progress}
            WHERE id = ${tp.id}
          `;
        } else {
          await sql`
            UPDATE phases SET
              start_date = ${rp.startDate}, end_date = ${rp.endDate},
              status = ${rp.status}, progress = ${rp.progress}
            WHERE id = ${tp.id}
          `;
        }
      }
    }
  }

  for (const tp of targetPhases) {
    if (!matched.has(tp.id)) {
      result.deleted++;
      log(`       🗑️  Phase supprimée  : "${tp.label}" ${tp.startDate}→${tp.endDate}`);
      if (EXECUTE) {
        await sql`DELETE FROM phases WHERE id = ${tp.id}`;
      }
    }
  }
  return result;
}

// ── Sync milestones ───────────────────────────────────────────────────────────
async function syncMilestones(
  refMs: Milestone[], targetMs: Milestone[],
  targetLotId: string, _lotKey: string
): Promise<SyncResult> {
  const result: SyncResult = { added: 0, deleted: 0, updated: 0, logs: [] };
  const log = (s: string) => result.logs.push(s);
  const matched = new Set<string>();

  const tBySyncGroup = new Map<string, Milestone>();
  const tByLabel = new Map<string, Milestone[]>();
  for (const tm of targetMs) {
    if (tm.syncGroupId) tBySyncGroup.set(tm.syncGroupId, tm);
    const k = n(tm.label);
    if (!tByLabel.has(k)) tByLabel.set(k, []);
    tByLabel.get(k)!.push(tm);
  }

  for (const rm of refMs) {
    let tm: Milestone | undefined;
    if (rm.syncGroupId) tm = tBySyncGroup.get(rm.syncGroupId);
    if (!tm) {
      const k = n(rm.label);
      const candidates = (tByLabel.get(k) ?? []).filter(x => !matched.has(x.id));
      // Tiebreaker par date la plus proche
      if (candidates.length === 1) {
        tm = candidates[0];
      } else if (candidates.length > 1) {
        const rt = new Date(rm.date).getTime();
        tm = candidates.reduce((best, cur) =>
          Math.abs(new Date(cur.date).getTime() - rt) < Math.abs(new Date(best.date).getTime() - rt) ? cur : best
        );
      }
    }

    if (!tm) {
      result.added++;
      log(`       ➕ Jalon ajouté     : "${rm.label}" ${rm.date}`);
      if (EXECUTE) {
        await sql`
          INSERT INTO milestones
            (id, lot_id, type, label, date, color, label_pos, note, sync_group_id)
          SELECT ${randomUUID()}, ${targetLotId}, type, label, date,
                 color, label_pos, note, ${rm.syncGroupId ?? null}
          FROM milestones WHERE id = ${rm.id}
        `;
      }
      continue;
    }

    matched.add(tm.id);

    const needsUpdate = tm.label !== rm.label || tm.date !== rm.date;
    if (needsUpdate) {
      result.updated++;
      const ch: string[] = [];
      if (tm.label !== rm.label) ch.push(`label "${tm.label}"→"${rm.label}"`);
      if (tm.date !== rm.date)   ch.push(`date ${tm.date}→${rm.date}`);
      log(`       ✏️  Jalon MàJ         : "${rm.label}" — ${ch.join(", ")}`);
      if (EXECUTE) {
        await sql`
          UPDATE milestones SET label = ${rm.label}, date = ${rm.date}
          WHERE id = ${tm.id}
        `;
      }
    }
  }

  for (const tm of targetMs) {
    if (!matched.has(tm.id)) {
      result.deleted++;
      log(`       🗑️  Jalon supprimé   : "${tm.label}" ${tm.date}`);
      if (EXECUTE) {
        await sql`DELETE FROM milestones WHERE id = ${tm.id}`;
      }
    }
  }
  return result;
}

// ── Phase 1 : Renommages ──────────────────────────────────────────────────────
async function applyRenames() {
  console.log(`\n${"─".repeat(70)}`);
  console.log("📝  PHASE 1 : Renommages de lots");
  for (const r of RENAMES) {
    const rows = await sql`
      SELECT l.id, l.name
      FROM lots l JOIN domains d ON d.id = l.domain_id
      WHERE l.planning_id = ${r.planningId}
        AND lower(trim(d.name)) = ${r.domNorm}
        AND lower(trim(l.name)) = ${r.oldNorm}
      LIMIT 1
    `;
    if (rows.length === 0) {
      console.log(`   ⚠️  Introuvable (${r.planningId.substring(0, 8)}): [${r.domNorm}] "${r.oldNorm}"`);
      continue;
    }
    console.log(`   → (${r.planningId.substring(0, 8)}) [${r.domNorm}] "${rows[0].name}" → "${r.newName}"`);
    if (EXECUTE) {
      await sql`UPDATE lots SET name = ${r.newName} WHERE id = ${rows[0].id}`;
    }
  }
}

// ── Phase 2 : Suppressions ────────────────────────────────────────────────────
async function applyDeletes() {
  console.log(`\n${"─".repeat(70)}`);
  console.log("🗑️   PHASE 2 : Suppressions de lots");
  for (const d of DELETE_LOTS) {
    const rows = await sql`
      SELECT l.id, l.name,
        (SELECT COUNT(*) FROM phases p WHERE p.lot_id = l.id)::int AS phase_count,
        (SELECT COUNT(*) FROM milestones m WHERE m.lot_id = l.id)::int AS ms_count
      FROM lots l JOIN domains dom ON dom.id = l.domain_id
      WHERE l.planning_id = ${d.planningId}
        AND lower(trim(dom.name)) = ${d.domNorm}
        AND lower(trim(l.name)) = ${d.lotNorm}
      LIMIT 1
    `;
    if (rows.length === 0) {
      console.log(`   ⚠️  Introuvable: [${d.domNorm}] "${d.lotNorm}"`);
      continue;
    }
    const lot = rows[0];
    console.log(`   🗑️  [${d.domNorm}] "${lot.name}" — ${lot.phase_count} phases, ${lot.ms_count} jalons`);
    if (EXECUTE) {
      await sql`DELETE FROM milestones WHERE lot_id = ${lot.id}`;
      await sql`DELETE FROM phases WHERE lot_id = ${lot.id}`;
      await sql`DELETE FROM lots WHERE id = ${lot.id}`;
    }
  }
}

// ── Phase 3 : Sync du contenu ─────────────────────────────────────────────────
async function syncTarget(targetId: string, targetName: string, efactMode: boolean) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`📋  PHASE 3 : Sync → "${targetName}"`);
  if (efactMode) console.log(`    [mode E-facturation : mise à jour uniquement, pas de création de lots]`);

  const ref    = await loadData(REF);
  const target = await loadData(targetId);

  const refDomByNorm = new Map(ref.domains.map(d => [n(d.name), d]));
  const tDomByNorm   = new Map(target.domains.map(d => [n(d.name), d]));

  // Virtual renames : pour le dry-run, on simule les renommages déjà appliqués
  const vRename = new Map<string, string>(); // oldKey → newKey
  for (const r of RENAMES.filter(r => r.planningId === targetId)) {
    vRename.set(`${r.domNorm}::${r.oldNorm}`, `${r.domNorm}::${n(r.newName)}`);
  }
  const deletedKeys = new Set(
    DELETE_LOTS.filter(d => d.planningId === targetId).map(d => `${d.domNorm}::${d.lotNorm}`)
  );

  // Map CCI 2026 : domNorm::lotNorm → lot
  const refLotMap = new Map<string, Lot>();
  for (const lot of ref.lots) {
    const dom = ref.domains.find(d => d.id === lot.domainId);
    if (dom) refLotMap.set(`${n(dom.name)}::${n(lot.name)}`, lot);
  }

  // Map cible : domNorm::lotNorm → lot (avec virtual renames + exclusion des supprimés)
  const tLotMap = new Map<string, Lot>();
  for (const lot of target.lots) {
    const dom = target.domains.find(d => d.id === lot.domainId);
    if (!dom) continue;
    const rawKey = `${n(dom.name)}::${n(lot.name)}`;
    if (deletedKeys.has(rawKey)) continue;
    const key = vRename.get(rawKey) ?? rawKey;
    tLotMap.set(key, lot);
  }

  let lotsCreated = 0, lotsUpdated = 0;
  let phAdded = 0, phDeleted = 0, phUpdated = 0;
  let msAdded = 0, msDeleted = 0, msUpdated = 0;

  for (const [key, refLot] of refLotMap) {
    const [domNorm] = key.split("::");
    const tLot = tLotMap.get(key);

    if (!tLot) {
      if (efactMode) continue; // E-facturation : pas de création de lots

      // CCI 2026_S2 : créer le lot (et son domaine si absent)
      const refDom = refDomByNorm.get(domNorm)!;
      console.log(`\n   ➕ Lot à créer : [${domNorm}] "${refLot.name}"`);

      let newLotId: string | null = null;
      if (EXECUTE) {
        let tDom = tDomByNorm.get(domNorm);
        if (!tDom) {
          const newDomId = randomUUID();
          await sql`
            INSERT INTO domains
              (id, planning_id, code, name, bg, bg_alt, strong, phase_color,
               sort_order, collapsed, cadence)
            SELECT ${newDomId}, ${targetId}, code, name, bg, bg_alt, strong, phase_color,
                   sort_order, collapsed, cadence
            FROM domains WHERE id = ${refDom.id}
          `;
          tDom = { ...refDom, id: newDomId, planningId: targetId };
          tDomByNorm.set(domNorm, tDom);
          console.log(`     📁 Domaine créé : "${refDom.name}"`);
        }
        newLotId = randomUUID();
        await sql`
          INSERT INTO lots (id, planning_id, domain_id, name, subtitle, icon, sort_order)
          SELECT ${newLotId}, ${targetId}, ${tDom.id}, name, subtitle, icon, sort_order
          FROM lots WHERE id = ${refLot.id}
        `;
        lotsCreated++;
        console.log(`     ✓ Lot créé : "${refLot.name}"`);
      }

      const refPh = ref.phases.filter(p => p.lotId === refLot.id);
      const refMs = ref.milestones.filter(m => m.lotId === refLot.id);
      const phRes = await syncPhases(refPh, [], newLotId ?? "dry-run", key);
      const msRes = await syncMilestones(refMs, [], newLotId ?? "dry-run", key);
      for (const line of [...phRes.logs, ...msRes.logs]) console.log(line);
      phAdded += phRes.added; msAdded += msRes.added;
      continue;
    }

    // ── Lot existant : sync du contenu ──────────────────────────────────────
    lotsUpdated++;

    const refPh = ref.phases.filter(p => p.lotId === refLot.id);
    const tPh   = target.phases.filter(p => p.lotId === tLot.id);
    const refMs = ref.milestones.filter(m => m.lotId === refLot.id);
    const tMs   = target.milestones.filter(m => m.lotId === tLot.id);

    const phRes = await syncPhases(refPh, tPh, tLot.id, key);
    const msRes = await syncMilestones(refMs, tMs, tLot.id, key);

    const hasPhDiff      = refPh.length !== tPh.length;
    const hasMsDiff      = refMs.length !== tMs.length;
    const hasSubtitleDiff = tLot.subtitle !== refLot.subtitle;
    const hasUpdates     = phRes.added > 0 || phRes.deleted > 0 || phRes.updated > 0 ||
                           msRes.added > 0 || msRes.deleted > 0 || msRes.updated > 0;

    // Sous-titre (header propre + exécution)
    if (hasSubtitleDiff) {
      console.log(`\n   📝 [${key}]`);
      console.log(`      subtitle : "${tLot.subtitle}" → "${refLot.subtitle}"`);
      if (EXECUTE) {
        await sql`UPDATE lots SET subtitle = ${refLot.subtitle} WHERE id = ${tLot.id}`;
      }
    }

    // Header principal — toujours AVANT les logs de phases/jalons
    if (hasPhDiff || hasMsDiff || hasSubtitleDiff) {
      console.log(`\n   🔄 [${key}]  (${refPh.length} ph ref / ${tPh.length} ph cible | ${refMs.length} ms ref / ${tMs.length} ms cible)`);
    } else if (hasUpdates) {
      console.log(`\n   🔄 [${key}]  (mises à jour)`);
    }

    // Logs bufferisés
    for (const line of [...phRes.logs, ...msRes.logs]) console.log(line);

    phAdded += phRes.added; phDeleted += phRes.deleted; phUpdated += phRes.updated;
    msAdded += msRes.added; msDeleted += msRes.deleted; msUpdated += msRes.updated;
  }

  // Lots dans la cible sans correspondance dans CCI 2026
  for (const [key] of tLotMap) {
    if (!refLotMap.has(key)) {
      console.log(`\n   ⚠️  Lot sans correspondance CCI 2026 (non touché) : [${key}]`);
    }
  }

  console.log(`\n${"─".repeat(70)}`);
  console.log(`  Résumé "${targetName}" :`);
  console.log(`     Lots    : ${lotsCreated} créés, ${lotsUpdated} parcourus`);
  console.log(`     Phases  : ${phAdded} ajoutées, ${phDeleted} supprimées, ${phUpdated} mises à jour`);
  console.log(`     Jalons  : ${msAdded} ajoutés, ${msDeleted} supprimés, ${msUpdated} mis à jour`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n${"═".repeat(70)}`);
  console.log("🔄  Sync E-facturation & CCI 2026_S2  ←  CCI 2026");
  console.log(`    Mode : ${EXECUTE ? "⚠️  EXÉCUTION — modifications en base" : "🔍 DRY-RUN — aucune modification"}`);
  console.log(`${"═".repeat(70)}`);

  await applyRenames();
  await applyDeletes();
  await syncTarget(EFACT, "E-facturation - Macro-Planning prévisionnel", true);
  await syncTarget(S2,    "Planning CCI 2026_S2", false);

  console.log(`\n${"═".repeat(70)}`);
  if (EXECUTE) {
    console.log("✅ Terminé — modifications appliquées.");
  } else {
    console.log("ℹ️  Dry-run terminé. Pour appliquer :");
    console.log("   DATABASE_URL=<pooled_url> npx tsx scripts/sync-plannings-from-cci2026.ts --execute");
  }
  console.log(`${"═".repeat(70)}\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
