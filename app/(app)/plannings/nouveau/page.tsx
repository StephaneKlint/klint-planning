export const dynamic = "force-dynamic";

import { listPlannings } from "@/lib/db/queries";
import { NouveauPlanningClient } from "./NouveauPlanningClient";

export default async function NouveauPlanningPage() {
  const [plannings, templates] = await Promise.all([
    listPlannings("active"),
    listPlannings("templates"),
  ]);
  return <NouveauPlanningClient plannings={plannings} templates={templates} />;
}
