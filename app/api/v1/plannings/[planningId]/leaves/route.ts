/**
 * GET /api/v1/plannings/[planningId]/leaves?from=AAAA-MM-JJ&to=AAAA-MM-JJ[&types=CP,RTT]
 *
 * API de LECTURE SEULE des congés d'un planning, destinée à Klint CoProj (serveur à serveur).
 *   Authorization: Bearer <LEAVES_API_KEY>
 *
 * Sécurité : clé comparée en temps constant ; sans clé configurée (ou trop courte) la route répond 404 (API inactive) ;
 * seuls les plannings listés dans LEAVES_ALLOWED_PLANNING_IDS répondent (les autres : 404, comme un planning inconnu) ;
 * jamais de motif, note, libellé ni statut ; aucune écriture ; pas de cache.
 *
 * Réponse : { planningId, from, to, generatedAt, leaves: [{ id, memberRef (e-mail), memberName, type, start, end,
 *             halfDayStart, halfDayEnd, days }] }
 */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  UUID_RE, bearerMatches, isAllowedPlanning, parseAllowedIds, parseDefaultTypes, parseLeavesParams, toLeaves,
} from "@/lib/leaves-api";
import { listLeaves, planningIsReadable } from "@/lib/db/leaves-queries";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function GET(request: Request, { params }: { params: Promise<{ planningId: string }> }) {
  const key = process.env.LEAVES_API_KEY;
  // API inactive tant que la clé n'est pas posée : la route n'existe pas pour l'extérieur.
  if (!key || key.length < 24) return json({ error: "Not found" }, 404);

  if (!bearerMatches(request.headers.get("authorization"), key)) {
    return json({ error: "Non autorisé" }, 401, { "WWW-Authenticate": "Bearer" });
  }

  const { planningId } = await params;
  const allowed = parseAllowedIds(process.env.LEAVES_ALLOWED_PLANNING_IDS);
  // Identifiant mal formé ou planning non autorisé : même réponse qu'un planning inconnu.
  if (!UUID_RE.test(planningId) || !isAllowedPlanning(allowed, planningId)) return json({ error: "Planning introuvable" }, 404);

  const parsed = parseLeavesParams(new URL(request.url).searchParams, parseDefaultTypes(process.env.LEAVES_PHASE_TYPES));
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    const id = planningId.toLowerCase();
    if (!(await planningIsReadable(id))) return json({ error: "Planning introuvable" }, 404);
    const rows = await listLeaves(id, parsed.from, parsed.to, parsed.types);
    return json({ planningId: id, from: parsed.from, to: parsed.to, generatedAt: new Date().toISOString(), leaves: toLeaves(rows) });
  } catch (err) {
    // Jamais de détail technique ni de donnée dans la réponse ni dans les journaux.
    console.error("[api/v1 leaves]", err instanceof Error ? err.name : "erreur");
    return json({ error: "Erreur interne" }, 500);
  }
}
