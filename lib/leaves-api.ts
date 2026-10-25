/**
 * lib/leaves-api.ts — logique PURE de l'API « congés » (aucun accès base, aucune dépendance) : clé Bearer,
 * paramètres, liste de plannings autorisés, jours ouvrés. Testé dans __tests__/leaves-api.test.ts.
 */
import { createHash, timingSafeEqual } from "crypto";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPE_RE = /^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ _.\-/]{0,39}$/;
export const DEFAULT_LEAVE_TYPES = ["CP", "RTT", "Formation", "Absence"];
export const MAX_SPAN_DAYS = 400;
export const MAX_LEAVES = 1000;
export const MIN_KEY_LENGTH = 24;

// ── Authentification : clé Bearer comparée en TEMPS CONSTANT ───────────────────────────────────────────
// Les deux valeurs sont hachées (SHA-256) avant comparaison : longueurs égales, aucune fuite par la durée.
export function bearerMatches(header: string | null, expectedKey: string | undefined): boolean {
  if (!expectedKey || expectedKey.length < MIN_KEY_LENGTH) return false; // clé absente ou trop faible : API inactive
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  if (!m) return false;
  const a = createHash("sha256").update(m[1]).digest();
  const b = createHash("sha256").update(expectedKey).digest();
  return timingSafeEqual(a, b);
}

// ── Plannings autorisés (LEAVES_ALLOWED_PLANNING_IDS : identifiants séparés par des virgules) ───────────
export function parseAllowedIds(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => UUID_RE.test(x)));
}
export const isAllowedPlanning = (allowed: Set<string>, planningId: string) => allowed.has(planningId.toLowerCase());

// ── Dates ──────────────────────────────────────────────────────────────────────────────────────────────
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const spanDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export type ParamsResult = { ok: true; from: string; to: string; types: string[] } | { ok: false; error: string };

// from et to obligatoires (AAAA-MM-JJ, from ≤ to, 400 jours au plus) ; types facultatif (liste de codes séparés par des virgules).
export function parseLeavesParams(sp: URLSearchParams, defaultTypes: string[]): ParamsResult {
  const from = sp.get("from"); const to = sp.get("to");
  if (!isIsoDate(from) || !isIsoDate(to)) return { ok: false, error: "Paramètres from et to requis (AAAA-MM-JJ)" };
  if (to < from) return { ok: false, error: "to doit être postérieur ou égal à from" };
  if (spanDays(from, to) > MAX_SPAN_DAYS) return { ok: false, error: `Période limitée à ${MAX_SPAN_DAYS} jours` };
  const rawTypes = sp.get("types");
  let types = defaultTypes;
  if (rawTypes !== null) {
    types = [];
    for (const t of rawTypes.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!TYPE_RE.test(t)) return { ok: false, error: "Type invalide" };
      if (!types.some((x) => x.toLowerCase() === t.toLowerCase())) types.push(t);
    }
    if (!types.length || types.length > 20) return { ok: false, error: "types : 1 à 20 codes" };
  }
  return { ok: true, from, to, types: types.map((t) => t.toLowerCase()) };
}

export function parseDefaultTypes(raw: string | undefined): string[] {
  const l = (raw ?? "").split(",").map((x) => x.trim()).filter((x) => TYPE_RE.test(x));
  return l.length ? l : DEFAULT_LEAVE_TYPES;
}

// ── Jours ouvrés (lundi-vendredi, hors jours fériés français) ──────────────────────────────────────────
function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function frenchHolidays(year: number): Set<string> {
  const e = easter(year); const y = String(year);
  return new Set([`${y}-01-01`, addDays(e, 1), `${y}-05-01`, `${y}-05-08`, addDays(e, 39), addDays(e, 50), `${y}-07-14`, `${y}-08-15`, `${y}-11-01`, `${y}-11-11`, `${y}-12-25`]);
}
export function workingDays(start: string, end: string): number {
  let n = 0; const cache = new Map<number, Set<string>>();
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const y = Number(d.slice(0, 4)); if (!cache.has(y)) cache.set(y, frenchHolidays(y));
    if (!cache.get(y)!.has(d)) n++;
  }
  return n;
}

// ── Forme de la réponse : AUCUN motif, note, libellé de phase, couleur ni statut n'est jamais exposé ────
// Une ligne = une phase de type « congé » × une personne. La personne vient de l'affectation de la phase (membre du
// planning, avec e-mail) ; à défaut (planning de suivi des congés où chaque LOT porte le prénom d'une personne et où les
// phases ne sont pas affectées) elle vient du nom du lot, sans e-mail, avec le nom du domaine comme groupe.
export interface LeaveRowInput {
  phaseId: string; memberId: string | null; type: string; start: string; end: string;
  email: string | null; name: string | null; lotName?: string | null; domainName?: string | null;
}
export interface LeaveOut {
  id: string; memberRef: string; memberName: string; memberGroup?: string; type: string; start: string; end: string;
  halfDayStart: boolean; halfDayEnd: boolean; days: number;
}

const clean = (v: string | null | undefined, max: number) => (v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export function toLeaves(rows: LeaveRowInput[]): LeaveOut[] {
  const out: LeaveOut[] = [];
  for (const r of rows.slice(0, MAX_LEAVES)) {
    const email = clean(r.email, 254).toLowerCase();
    const fromMember = !!r.memberId && (email || clean(r.name, 80));
    const name = fromMember ? (clean(r.name, 80) || email.split("@")[0]) : clean(r.lotName, 80);
    if (!name) continue; // ni membre affecté ni nom de lot exploitable : rien à afficher
    const group = fromMember ? "" : clean(r.domainName, 80);
    out.push({
      id: createHash("sha256").update(`${r.phaseId}:${fromMember ? r.memberId : "lot"}`).digest("hex").slice(0, 24),
      memberRef: fromMember ? email : "",
      memberName: name,
      ...(group ? { memberGroup: group } : {}),
      type: r.type,
      start: r.start, end: r.end,
      // Klint Planning ne gère pas les demi-journées (les phases sont des jours entiers) : champs réservés.
      halfDayStart: false, halfDayEnd: false,
      days: workingDays(r.start, r.end),
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.memberName.localeCompare(b.memberName, "fr"));
}

// ── Diagnostic : types de phase présents dans le planning (AUCUNE donnée personnelle) ──────────────────────
export interface TypeSeen { code: string; label: string; count: number }
export const MAX_TYPES_SEEN = 100;

// Entrée : une ligne par type distinct (code, libellé du type s'il est défini, nombre de phases). Fusionne les codes
// identiques à la casse près et trie par effectif décroissant puis code.
export function buildTypesSeen(rows: { code: string; label?: string | null; count: number }[]): TypeSeen[] {
  const m = new Map<string, TypeSeen>();
  for (const r of rows) {
    const code = clean(r.code, 40);
    if (!code) continue;
    const k = code.toLowerCase();
    const n = Number.isFinite(Number(r.count)) ? Math.max(0, Math.floor(Number(r.count))) : 0;
    const cur = m.get(k);
    if (cur) { cur.count += n; if (!cur.label && r.label) cur.label = clean(r.label, 80); }
    else m.set(k, { code, label: clean(r.label, 80), count: n });
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, "fr")).slice(0, MAX_TYPES_SEEN);
}
