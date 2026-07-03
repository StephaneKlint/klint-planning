/** Géolocalisation IP partagée (ip-api.com, gratuit, sans clé) — utilisée par
 * ConnectionLogger (log post-connexion) et auth.ts (blocage géo-sécurité). */

function isPrivateIp(ip: string): boolean {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("::ffff:127.")
  );
}

export function extractIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? null;
}

export type GeoResult = { country: string; countryCode: string; city: string | null };

/** Retourne null si IP privée, géoloc indisponible ou échec réseau (fail-open). */
export async function getCountryFromIp(ip: string | null): Promise<GeoResult | null> {
  if (!ip || isPrivateIp(ip)) return null;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      country?: string;
      countryCode?: string;
      city?: string;
    };
    if (data.status !== "success" || !data.countryCode) return null;
    return { country: data.country ?? data.countryCode, countryCode: data.countryCode, city: data.city ?? null };
  } catch {
    return null; // fail-open : jamais bloquer sur une géoloc en échec
  }
}
