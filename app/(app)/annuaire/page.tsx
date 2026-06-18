export const dynamic = "force-dynamic";

import { listAllDirectoryContacts } from "@/lib/db/queries";
import { AnnuaireClient } from "./AnnuaireClient";

export default async function AnnuairePage() {
  const contacts = await listAllDirectoryContacts();
  return <AnnuaireClient contacts={contacts} />;
}
