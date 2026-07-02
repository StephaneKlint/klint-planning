import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phaseItemImports } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? "";

export async function GET(req: Request) {
  if (!BRIDGE_SECRET || req.headers.get("x-bridge-secret") !== BRIDGE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [job] = await db
    .select()
    .from(phaseItemImports)
    .where(eq(phaseItemImports.status, "pending"))
    .orderBy(asc(phaseItemImports.createdAt))
    .limit(1);

  if (!job) return NextResponse.json({ job: null });

  await db
    .update(phaseItemImports)
    .set({ status: "processing" })
    .where(eq(phaseItemImports.id, job.id));

  return NextResponse.json({ job });
}
