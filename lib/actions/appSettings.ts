"use server";
/**
 * lib/actions/appSettings.ts
 * Gestion des paramètres globaux de l'application (logo, favicon, permissions)
 * Table singleton : clé = "global"
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GLOBAL_KEY = "global";

export type AppSettings = {
  logoDataUrl:    string | null;
  logoAlt:        string;
  faviconDataUrl: string | null;
};

// ── Matrice de permissions par rôle ───────────────────────────────────────────

export type PermissionMatrix = {
  user: {
    tab_general:      boolean;
    tab_cadence:      boolean;
    tab_phases:       boolean;
    tab_jalons:       boolean;
    tab_statuts:      boolean;
    "tab_répertoire": boolean;
    tab_historique:   boolean;
    tab_apparence:    boolean;
    tab_calendrier:   boolean;
    tab_securite:     boolean;
    create_planning:  boolean;
    export:           boolean;
    share:            boolean;
  };
};

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  user: {
    tab_general:      true,
    tab_cadence:      true,
    tab_phases:       true,
    tab_jalons:       true,
    tab_statuts:      true,
    "tab_répertoire": false,
    tab_historique:   false,
    tab_apparence:    false,
    tab_calendrier:   true,
    tab_securite:     false,
    create_planning:  true,
    export:           true,
    share:            true,
  },
};

export async function getPermissions(): Promise<PermissionMatrix> {
  const rows = await db
    .select({ permissionsJson: appSettings.permissionsJson })
    .from(appSettings)
    .where(eq(appSettings.key, GLOBAL_KEY))
    .limit(1);

  if (!rows.length || !rows[0].permissionsJson) return DEFAULT_PERMISSIONS;
  const stored = rows[0].permissionsJson as { user?: Partial<PermissionMatrix["user"]> };
  return {
    user: { ...DEFAULT_PERMISSIONS.user, ...(stored.user ?? {}) },
  };
}

export async function savePermissions(permissions: PermissionMatrix) {
  await db
    .insert(appSettings)
    .values({ key: GLOBAL_KEY, permissionsJson: permissions, logoAlt: "Klint" })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { permissionsJson: permissions },
    });

  revalidatePath("/parametres");
}

/** Retourne les paramètres globaux */
export async function getAppSettings(): Promise<AppSettings> {
  const rows = await db
    .select({
      logoDataUrl:    appSettings.logoDataUrl,
      logoAlt:        appSettings.logoAlt,
      faviconDataUrl: appSettings.faviconDataUrl,
    })
    .from(appSettings)
    .where(eq(appSettings.key, GLOBAL_KEY))
    .limit(1);

  if (rows.length === 0) return { logoDataUrl: null, logoAlt: "Klint", faviconDataUrl: null };
  return {
    logoDataUrl:    rows[0].logoDataUrl    ?? null,
    logoAlt:        rows[0].logoAlt        ?? "Klint",
    faviconDataUrl: rows[0].faviconDataUrl ?? null,
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

/** Sauvegarde le favicon (dataUrl = null pour revenir au favicon par défaut) */
export async function saveAppFavicon(faviconDataUrl: string | null) {
  await db
    .insert(appSettings)
    .values({ key: GLOBAL_KEY, faviconDataUrl, logoAlt: "Klint" })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { faviconDataUrl },
    });

  // Le favicon est dans le <head> du layout racine
  revalidatePath("/", "layout");
}
