import { getPortfolioData } from "@/lib/db/queries";
import { PortefeuilleClient } from "./PortefeuilleClient";

export const dynamic = "force-dynamic";

export default async function PortefeuillePage() {
  const cards = await getPortfolioData();
  return <PortefeuilleClient cards={cards} />;
}
