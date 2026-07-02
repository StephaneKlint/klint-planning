import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phaseItemImports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { confirmPhaseItemImport, type ImportedItem } from "@/lib/actions/phase-items";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? "";

export async function POST(req: Request) {
  if (!BRIDGE_SECRET || req.headers.get("x-bridge-secret") !== BRIDGE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { jobId: string; items?: ImportedItem[]; error?: string };

  if (body.error) {
    await db
      .update(phaseItemImports)
      .set({ status: "error", errorMsg: body.error, processedAt: new Date() })
      .where(eq(phaseItemImports.id, body.jobId));
    return NextResponse.json({ ok: true });
  }

  if (!body.items || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  await confirmPhaseItemImport(body.jobId, body.items);
  return NextResponse.json({ ok: true, count: body.items.length });
}
