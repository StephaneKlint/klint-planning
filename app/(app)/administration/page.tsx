import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAppSettings, getPermissions, getSecuritySettings } from "@/lib/actions/appSettings";
import { listConnectionLogs } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { AdministrationClient } from "./AdministrationClient";

export const metadata = { title: "Administration — Klint Planning" };

export default async function AdministrationPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/plannings");

  const [appCfg, permissions, securitySettings, connLogs, allUsers] = await Promise.all([
    getAppSettings(),
    getPermissions(),
    getSecuritySettings(),
    listConnectionLogs(200),
    db.select({
      id:         users.id,
      name:       users.name,
      email:      users.email,
      role:       users.role,
      disabledAt: users.disabledAt,
      createdAt:  users.createdAt,
    }).from(users).orderBy(asc(users.name)),
  ]);

  return (
    <AdministrationClient
      appCfg={appCfg}
      permissions={permissions}
      securitySettings={securitySettings}
      connLogs={connLogs}
      allUsers={allUsers}
    />
  );
}
