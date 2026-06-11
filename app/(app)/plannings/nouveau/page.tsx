export const dynamic = "force-dynamic";

import { listPlannings } from "@/lib/db/queries";
import { NouveauPlanningClient } from "./NouveauPlanningClient";

export default async function NouveauPlanningPage() {
  const plannings = await listPlannings();
  return <NouveauPlanningClient plannings={plannings} />;
}
