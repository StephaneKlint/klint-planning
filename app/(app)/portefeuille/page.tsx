import { auth } from "@/auth";
import { getPortfolioData } from "@/lib/db/queries";
import { PortefeuilleClient } from "./PortefeuilleClient";

export const dynamic = "force-dynamic";

export default async function PortefeuillePage() {
  const session = await auth();
  const userId  = session?.user?.id;
  const role    = session?.user?.role ?? "contact";

  const cards = await getPortfolioData(role !== "admin" && userId ? userId : undefined);
  return <PortefeuilleClient cards={cards} />;
}
