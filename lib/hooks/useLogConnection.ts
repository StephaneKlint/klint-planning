"use client";

import { useEffect, useRef } from "react";

/**
 * Appelle /api/log-connection une seule fois par session navigateur.
 * Utilise sessionStorage pour éviter les doublons dans le même onglet.
 */
export function useLogConnection(userId: string | null | undefined) {
  const logged = useRef(false);

  useEffect(() => {
    if (!userId) return;
    const key = `conn-logged-${userId}`;
    if (sessionStorage.getItem(key)) return;
    if (logged.current) return;
    logged.current = true;
    sessionStorage.setItem(key, "1");

    fetch("/api/log-connection", { method: "POST" }).catch(console.error);
  }, [userId]);
}
