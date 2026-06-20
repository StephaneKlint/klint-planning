import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { connectionLogs } from "@/lib/db/schema";

/** Extract real client IP from Vercel/proxy headers */
function getIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? null;
}

/** True if the IP is a loopback/private address (dev environment) */
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getIp(req);
    const userAgent = req.headers.get("user-agent") ?? undefined;

    let country: string | undefined;
    let countryCode: string | undefined;
    let city: string | undefined;
    let isAlert = false;

    // Geolocate only public IPs (no key required, ip-api.com free tier)
    if (ip && !isPrivateIp(ip)) {
      try {
        const geoRes = await fetch(
          `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (geoRes.ok) {
          const geo = (await geoRes.json()) as {
            status: string;
            country?: string;
            countryCode?: string;
            city?: string;
          };
          if (geo.status === "success") {
            country = geo.country;
            countryCode = geo.countryCode;
            city = geo.city;
            isAlert = geo.countryCode !== "FR";
          }
        }
      } catch {
        // Geolocation failed — log anyway without geo data
      }
    }

    // Insert log
    await db.insert(connectionLogs).values({
      userId: session.user.id,
      email: session.user.email,
      ip: ip ?? undefined,
      country,
      countryCode,
      city,
      userAgent,
      isAlert,
    });

    // Send alert email via Brevo if non-France and key configured
    if (isAlert && process.env.BREVO_API_KEY) {
      const fromRaw = process.env.EMAIL_FROM ?? "Klint Planning <sdurand@klint-consulting.com>";
      const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
      const senderName  = fromMatch ? fromMatch[1].trim() : "Klint Planning";
      const senderEmail = fromMatch ? fromMatch[2].trim() : fromRaw;

      fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender:      { name: senderName, email: senderEmail },
          to:          [{ email: senderEmail }],
          subject:     `⚠️ Connexion hors-France — ${session.user.email}`,
          htmlContent: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <h2 style="color:#DC2626;margin:0 0 16px">⚠️ Connexion détectée hors de France</h2>
              <table style="border-collapse:collapse;width:100%">
                <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:100px">Utilisateur</td><td style="padding:4px 0;font-size:13px;font-weight:600">${session.user.email}</td></tr>
                <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">IP</td><td style="padding:4px 0;font-size:13px;font-family:monospace">${ip ?? "inconnue"}</td></tr>
                <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Pays</td><td style="padding:4px 0;font-size:13px">${country ?? "inconnu"} (${countryCode ?? "?"})</td></tr>
                <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Ville</td><td style="padding:4px 0;font-size:13px">${city ?? "inconnue"}</td></tr>
                <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Date</td><td style="padding:4px 0;font-size:13px">${new Date().toLocaleString("fr-FR")}</td></tr>
              </table>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
              <p style="color:#6B7280;font-size:12px">Si cette connexion est légitime, ignorez ce message. Sinon, révoquez l'accès depuis Paramètres → Membres.</p>
            </div>
          `,
        }),
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true, isAlert });
  } catch (err) {
    console.error("Connection log failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
