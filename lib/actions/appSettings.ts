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
import { type PermissionMatrix, type RolePermRow, DEFAULT_PERMISSIONS } from "@/lib/permissions";

const GLOBAL_KEY = "global";

export type AppSettings = {
  logoDataUrl:    string | null;
  logoAlt:        string;
  faviconDataUrl: string | null;
};

export async function getPermissions(): Promise<PermissionMatrix> {
  const rows = await db
    .select({ permissionsJson: appSettings.permissionsJson })
    .from(appSettings)
    .where(eq(appSettings.key, GLOBAL_KEY))
    .limit(1);

  if (!rows.length || !rows[0].permissionsJson) return DEFAULT_PERMISSIONS;

  const s = rows[0].permissionsJson as Partial<PermissionMatrix>;
  const mr = (def: RolePermRow, src?: Partial<RolePermRow>): RolePermRow => ({ ...def, ...(src ?? {}) });

  return {
    platform: { ...DEFAULT_PERMISSIONS.platform, ...(s.platform ?? {}) },
    tabs:     { ...DEFAULT_PERMISSIONS.tabs,     ...(s.tabs     ?? {}) },
    planning_actions: {
      edit_settings: mr(DEFAULT_PERMISSIONS.planning_actions.edit_settings, s.planning_actions?.edit_settings),
      archive:       mr(DEFAULT_PERMISSIONS.planning_actions.archive,       s.planning_actions?.archive),
      delete:        mr(DEFAULT_PERMISSIONS.planning_actions.delete,        s.planning_actions?.delete),
      duplicate:     mr(DEFAULT_PERMISSIONS.planning_actions.duplicate,     s.planning_actions?.duplicate),
      template:      mr(DEFAULT_PERMISSIONS.planning_actions.template,      s.planning_actions?.template),
      export:        mr(DEFAULT_PERMISSIONS.planning_actions.export,        s.planning_actions?.export),
      share:         mr(DEFAULT_PERMISSIONS.planning_actions.share,         s.planning_actions?.share),
    },
    gantt_actions: {
      phase_create: mr(DEFAULT_PERMISSIONS.gantt_actions.phase_create, s.gantt_actions?.phase_create),
      phase_edit:   mr(DEFAULT_PERMISSIONS.gantt_actions.phase_edit,   s.gantt_actions?.phase_edit),
      phase_move:   mr(DEFAULT_PERMISSIONS.gantt_actions.phase_move,   s.gantt_actions?.phase_move),
      phase_delete: mr(DEFAULT_PERMISSIONS.gantt_actions.phase_delete, s.gantt_actions?.phase_delete),
      ms_create:    mr(DEFAULT_PERMISSIONS.gantt_actions.ms_create,    s.gantt_actions?.ms_create),
      ms_edit:      mr(DEFAULT_PERMISSIONS.gantt_actions.ms_edit,      s.gantt_actions?.ms_edit),
      ms_delete:    mr(DEFAULT_PERMISSIONS.gantt_actions.ms_delete,    s.gantt_actions?.ms_delete),
    },
    member_actions: {
      add:    mr(DEFAULT_PERMISSIONS.member_actions.add,    s.member_actions?.add),
      remove: mr(DEFAULT_PERMISSIONS.member_actions.remove, s.member_actions?.remove),
      manage: mr(DEFAULT_PERMISSIONS.member_actions.manage, s.member_actions?.manage),
    },
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
