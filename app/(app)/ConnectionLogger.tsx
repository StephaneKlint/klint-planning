"use client";

import { useLogConnection } from "@/lib/hooks/useLogConnection";

/**
 * Client component isolé — appelle le hook de log de connexion
 * une seule fois par session navigateur.
 * Insérer dans le layout (app) juste après la résolution de session.
 */
export function ConnectionLogger({ userId }: { userId: string | null | undefined }) {
  useLogConnection(userId);
  return null;
}
