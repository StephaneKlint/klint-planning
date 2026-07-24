export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { listPlannings, getAccessiblePlanningIds } from "@/lib/db/queries";
import { NouveauPlanningClient } from "./NouveauPlanningClient";

export default async function NouveauPlanningPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role ?? "contact";

  const [allActive, allTemplates] = await Promise.all([
    listPlannings("active"),
    listPlannings("templates"),
  ]);

  // Non-admins only see plannings they belong to in the "Dupliquer" dropdown
  let plannings = allActive;
  let templates = allTemplates;
  if (role !== "admin" && userId) {
    const accessIds = await getAccessiblePlanningIds(userId);
    plannings = allActive.filter((p) => accessIds.has(p.id));
    templates = allTemplates.filter((p) => accessIds.has(p.id));
  }

  return <NouveauPlanningClient plannings={plannings} templates={templates} />;
}
