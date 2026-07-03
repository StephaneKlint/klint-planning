import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { connectionLogs } from "@/lib/db/schema";
import { extractIp, getCountryFromIp } from "@/lib/geo";
import { sendSecurityAlertEmail } from "@/lib/security-alert";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = extractIp(req.headers);
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const geo = await getCountryFromIp(ip);
    const isAlert = geo ? geo.countryCode !== "FR" : false;

    await db.insert(connectionLogs).values({
      userId: session.user.id,
      email: session.user.email,
      ip: ip ?? undefined,
      country: geo?.country,
      countryCode: geo?.countryCode,
      city: geo?.city ?? undefined,
      userAgent,
      isAlert,
    });

    if (isAlert) {
      sendSecurityAlertEmail({
        kind: "alert",
        userEmail: session.user.email,
        ip,
        country: geo?.country ?? null,
        countryCode: geo?.countryCode ?? null,
        city: geo?.city ?? null,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, isAlert });
  } catch (err) {
    console.error("Connection log failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
