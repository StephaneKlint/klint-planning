/**
 * /p — redirect to first planning accessible to the current user.
 */
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPlannings, listPlanningsForUser } from "@/lib/db/queries";

export default async function PlanningsIndexPage() {
  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role ?? "contact";

  const all = userId && role !== "admin"
    ? await listPlanningsForUser(userId)
    : await listPlannings();

  if (all.length === 0) {
    return (
      <div style={{ padding: 32, fontFamily: "var(--font-display, system-ui)" }}>
        <h1>Aucun planning disponible</h1>
        <p>Vous n&apos;êtes encore membre d&apos;aucun planning.</p>
      </div>
    );
  }
  redirect(`/p/${all[0].id}`);
}
