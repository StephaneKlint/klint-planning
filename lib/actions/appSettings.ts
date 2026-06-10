"use server";
/**
 * lib/actions/appSettings.ts
 * Gestion des paramètres globaux de l'application (logo, etc.)
 * Table singleton : clé = "global"
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GLOBAL_KEY = "global";

export type AppSettings = {
  logoDataUrl: string | null;
  logoAlt: string;
};

/** Retourne les paramètres globaux (peut être null si jamais initialisé) */
export async function getAppSettings(): Promise<AppSettings> {
  const rows = await db
    .select({ logoDataUrl: appSettings.logoDataUrl, logoAlt: appSettings.logoAlt })
    .from(appSettings)
    .where(eq(appSettings.key, GLOBAL_KEY))
    .limit(1);

  if (rows.length === 0) return { logoDataUrl: null, logoAlt: "Klint" };
  return {
    logoDataUrl: rows[0].logoDataUrl ?? null,
    logoAlt: rows[0].logoAlt ?? "Klint",
  };
}

/** Sauvegarde le logo (dataUrl = null pour revenir au logo Klint) */
export async function saveAppLogo(logoDataUrl: string | null, logoAlt: string) {
  await db
    .insert(appSettings)
    .values({ key: GLOBAL_KEY, logoDataUrl, logoAlt })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { logoDataUrl, logoAlt },
    });

  // Invalide le layout entier (Rail est dans le layout)
  revalidatePath("/", "layout");
}
