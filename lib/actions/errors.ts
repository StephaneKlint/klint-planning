"use server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { appErrors, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Réservé aux admins");
  return session;
}

export type AppErrorRow = {
  id: string;
  createdAt: Date;
  source: string;
  level: string;
  message: string;
  details: unknown;
  statusCode: number | null;
  resolved: boolean;
  userName: string | null;
  userEmail: string | null;
};

export async function getErrors(limit = 100): Promise<AppErrorRow[]> {
  await requireAdmin();
  const rows = await db
    .select({
      id: appErrors.id,
      createdAt: appErrors.createdAt,
      source: appErrors.source,
      level: appErrors.level,
      message: appErrors.message,
      details: appErrors.details,
      statusCode: appErrors.statusCode,
      resolved: appErrors.resolved,
      userName: users.name,
      userEmail: users.email,
    })
    .from(appErrors)
    .leftJoin(users, eq(appErrors.userId, users.id))
    .orderBy(desc(appErrors.createdAt))
    .limit(Math.min(limit, 200));
  return rows as AppErrorRow[];
}

export async function resolveError(id: string, resolved: boolean) {
  await requireAdmin();
  await db.update(appErrors).set({ resolved }).where(eq(appErrors.id, id));
  return { ok: true };
}
