import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listPhaseItems } from "@/lib/actions/phase-items";

export async function GET(_req: Request, { params }: { params: Promise<{ phaseId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { phaseId } = await params;
  const items = await listPhaseItems(phaseId);
  return NextResponse.json({ items });
}
