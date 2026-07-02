import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { phaseItemImports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const [job] = await db
    .select({
      id:          phaseItemImports.id,
      status:      phaseItemImports.status,
      resultJson:  phaseItemImports.resultJson,
      errorMsg:    phaseItemImports.errorMsg,
      processedAt: phaseItemImports.processedAt,
    })
    .from(phaseItemImports)
    .where(eq(phaseItemImports.id, id))
    .limit(1);

  if (!job) return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  return NextResponse.json({ job });
}
