import { db } from "@/lib/db";
import { appErrors } from "@/lib/db/schema";

export async function logError(opts: {
  source: string;
  message: string;
  details?: Record<string, unknown>;
  userId?: string;
  statusCode?: number;
  level?: "error" | "warn";
}): Promise<void> {
  try {
    const { source, message, details, userId, statusCode, level = "error" } = opts;
    console.error(`[${source}] ${message}`, details ?? "");
    await db.insert(appErrors).values({
      source,
      level,
      message,
      details: details ?? null,
      userId: userId ?? null,
      statusCode: statusCode ?? null,
    });
  } catch {
    // never let logging break the app
  }
}
