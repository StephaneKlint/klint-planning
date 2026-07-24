"use client";

import { useState, useTransition } from "react";
import styles from "./Parametres.module.css";
import type { SecuritySettings } from "@/lib/actions/appSettings";
import { saveSecuritySettings } from "@/lib/actions/appSettings";
import { Icon } from "@/components/ui/Icon";

export function GeoSecuriteSection({ securitySettings }: { securitySettings: SecuritySettings }) {
  const [, startTransition] = useTransition();
  const [geoEnabled,  setGeoEnabled]  = useState(securitySettings.enabled);
  const [geoCountries, setGeoCountries] = useState(securitySettings.trustedCountries.join(", "));
  const [geoMsg,      setGeoMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [geoPending,  setGeoPending]  = useState(false);

  return (
    <div style={{ maxWidth: 400 }}>
      <p className={styles.fieldLabel} style={{ marginBottom: 6 }}>Géo-sécurité</p>
      <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 12px" }}>
        Bloque la connexion des comptes qui se connectent depuis un pays hors de la liste de confiance
        (sauf comptes autorisés individuellement dans l&apos;onglet Répertoire — icône <Icon name="globe" size={11} aria-hidden />).
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 12, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={geoEnabled}
          onChange={(e) => setGeoEnabled(e.target.checked)}
          disabled={geoPending}
        />
        Bloquer les connexions hors pays de confiance
      </label>

      <div className={styles.field} style={{ marginBottom: 14 }}>
        <label className={styles.fieldLabel} htmlFor="geo-countries-input">
          Pays de confiance (codes ISO à 2 lettres, séparés par des virgules)
        </label>
        <input
          id="geo-countries-input"
          type="text"
          placeholder="FR, BE, CH"
          value={geoCountries}
          onChange={(e) => setGeoCountries(e.target.value)}
          disabled={geoPending}
          style={{
            width: "100%", padding: "9px 12px", fontSize: 13,
            border: "1.5px solid var(--klint-line)", borderRadius: 8,
            fontFamily: "inherit", outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {geoMsg && (
        <p style={{
          fontSize: 13, margin: "0 0 14px",
          color: geoMsg.ok ? "#16A34A" : "#DC2626",
          background: geoMsg.ok ? "#DCFCE7" : "#FEE2E2",
          borderRadius: 6, padding: "8px 12px",
        }}>
          {geoMsg.text}
        </p>
      )}

      <button
        className={styles.addBtn}
        disabled={geoPending}
        onClick={() => {
          const trustedCountries = geoCountries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
          if (geoEnabled && trustedCountries.length === 0) {
            setGeoMsg({ ok: false, text: "Indiquez au moins un pays de confiance, ou désactivez le blocage." });
            return;
          }
          setGeoPending(true);
          startTransition(async () => {
            await saveSecuritySettings({ enabled: geoEnabled, trustedCountries });
            setGeoPending(false);
            setGeoMsg({ ok: true, text: "Paramètres de géo-sécurité enregistrés." });
          });
        }}
      >
        {geoPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
