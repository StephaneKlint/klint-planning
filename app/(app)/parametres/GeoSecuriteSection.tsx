"use client";

import { useState, useTransition } from "react";
import styles from "./Parametres.module.css";
import type { SecuritySettings } from "@/lib/actions/appSettings";
import { saveSecuritySettings } from "@/lib/actions/appSettings";
import { Icon } from "@/components/ui/Icon";

// Common countries with ISO codes for the picker
const COUNTRY_LIST: { code: string; name: string }[] = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albanie" },
  { code: "DZ", name: "Algérie" },
  { code: "DE", name: "Allemagne" },
  { code: "AO", name: "Angola" },
  { code: "SA", name: "Arabie saoudite" },
  { code: "AR", name: "Argentine" },
  { code: "AM", name: "Arménie" },
  { code: "AU", name: "Australie" },
  { code: "AT", name: "Autriche" },
  { code: "AZ", name: "Azerbaïdjan" },
  { code: "BE", name: "Belgique" },
  { code: "BJ", name: "Bénin" },
  { code: "BG", name: "Bulgarie" },
  { code: "BF", name: "Burkina Faso" },
  { code: "KH", name: "Cambodge" },
  { code: "CM", name: "Cameroun" },
  { code: "CA", name: "Canada" },
  { code: "CL", name: "Chili" },
  { code: "CN", name: "Chine" },
  { code: "CO", name: "Colombie" },
  { code: "KM", name: "Comores" },
  { code: "KR", name: "Corée du Sud" },
  { code: "HR", name: "Croatie" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Chypre" },
  { code: "CZ", name: "République tchèque" },
  { code: "DK", name: "Danemark" },
  { code: "EG", name: "Égypte" },
  { code: "AE", name: "Émirats arabes unis" },
  { code: "ES", name: "Espagne" },
  { code: "EE", name: "Estonie" },
  { code: "ET", name: "Éthiopie" },
  { code: "FI", name: "Finlande" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Grèce" },
  { code: "GN", name: "Guinée" },
  { code: "HU", name: "Hongrie" },
  { code: "IN", name: "Inde" },
  { code: "ID", name: "Indonésie" },
  { code: "IQ", name: "Irak" },
  { code: "IR", name: "Iran" },
  { code: "IE", name: "Irlande" },
  { code: "IL", name: "Israël" },
  { code: "IT", name: "Italie" },
  { code: "JP", name: "Japon" },
  { code: "JO", name: "Jordanie" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KW", name: "Koweït" },
  { code: "LV", name: "Lettonie" },
  { code: "LB", name: "Liban" },
  { code: "LY", name: "Libye" },
  { code: "LT", name: "Lituanie" },
  { code: "LU", name: "Luxembourg" },
  { code: "MG", name: "Madagascar" },
  { code: "MY", name: "Malaisie" },
  { code: "ML", name: "Mali" },
  { code: "MA", name: "Maroc" },
  { code: "MX", name: "Mexique" },
  { code: "MD", name: "Moldavie" },
  { code: "MN", name: "Mongolie" },
  { code: "MZ", name: "Mozambique" },
  { code: "NL", name: "Pays-Bas" },
  { code: "NZ", name: "Nouvelle-Zélande" },
  { code: "NG", name: "Nigéria" },
  { code: "NO", name: "Norvège" },
  { code: "PK", name: "Pakistan" },
  { code: "PE", name: "Pérou" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Pologne" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Roumanie" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "RU", name: "Russie" },
  { code: "RW", name: "Rwanda" },
  { code: "SN", name: "Sénégal" },
  { code: "RS", name: "Serbie" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SK", name: "Slovaquie" },
  { code: "SI", name: "Slovénie" },
  { code: "SO", name: "Somalie" },
  { code: "SD", name: "Soudan" },
  { code: "SE", name: "Suède" },
  { code: "CH", name: "Suisse" },
  { code: "TW", name: "Taïwan" },
  { code: "TZ", name: "Tanzanie" },
  { code: "TH", name: "Thaïlande" },
  { code: "TG", name: "Togo" },
  { code: "TN", name: "Tunisie" },
  { code: "TR", name: "Turquie" },
  { code: "UA", name: "Ukraine" },
  { code: "UG", name: "Ouganda" },
  { code: "US", name: "États-Unis" },
  { code: "UY", name: "Uruguay" },
  { code: "VN", name: "Viêt Nam" },
  { code: "YE", name: "Yémen" },
  { code: "ZA", name: "Afrique du Sud" },
  { code: "ZM", name: "Zambie" },
  { code: "ZW", name: "Zimbabwe" },
].sort((a, b) => a.name.localeCompare(b.name, "fr"));

function getCountryName(code: string): string {
  return COUNTRY_LIST.find((c) => c.code === code)?.name ?? code;
}

export function GeoSecuriteSection({ securitySettings }: { securitySettings: SecuritySettings }) {
  const [, startTransition] = useTransition();
  const [geoEnabled,  setGeoEnabled]  = useState(securitySettings.enabled);
  const [selected, setSelected] = useState<string[]>(
    securitySettings.trustedCountries.map((c) => c.trim().toUpperCase()).filter(Boolean)
  );
  const [geoMsg, setGeoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [geoPending, setGeoPending] = useState(false);

  function addCountry(code: string) {
    if (!code || selected.includes(code)) return;
    setSelected((prev) => [...prev, code]);
  }

  function removeCountry(code: string) {
    setSelected((prev) => prev.filter((c) => c !== code));
  }

  const available = COUNTRY_LIST.filter((c) => !selected.includes(c.code));

  return (
    <div style={{ maxWidth: 480 }}>
      <p className={styles.fieldLabel} style={{ marginBottom: 6 }}>Géo-sécurité</p>
      <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 12px" }}>
        Bloque la connexion des comptes qui se connectent depuis un pays hors de la liste de confiance
        (sauf comptes autorisés individuellement dans l&apos;onglet Répertoire — icône <Icon name="globe" size={11} aria-hidden />).
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 16, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={geoEnabled}
          onChange={(e) => setGeoEnabled(e.target.checked)}
          disabled={geoPending}
          style={{ accentColor: "#2563EB" }}
        />
        Bloquer les connexions hors pays de confiance
      </label>

      <div className={styles.field} style={{ marginBottom: 14 }}>
        <label className={styles.fieldLabel}>Pays de confiance</label>

        {/* Tags */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8,
          padding: selected.length > 0 ? "8px" : 0,
          background: selected.length > 0 ? "#F8FAFC" : "transparent",
          borderRadius: 8,
          border: selected.length > 0 ? "1px solid var(--klint-line)" : "none",
          minHeight: selected.length > 0 ? 36 : 0,
        }}>
          {selected.map((code) => (
            <span key={code} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 8px 3px 10px",
              background: "#EFF6FF", color: "#1D4ED8",
              borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: "1px solid #BFDBFE",
            }}>
              {getCountryName(code)} ({code})
              <button
                type="button"
                onClick={() => removeCountry(code)}
                disabled={geoPending}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#60A5FA", padding: 0, lineHeight: 1, fontSize: 14, fontWeight: 700,
                  display: "flex", alignItems: "center",
                }}
                aria-label={`Retirer ${getCountryName(code)}`}
              >
                ×
              </button>
            </span>
          ))}
          {selected.length === 0 && (
            <span style={{ fontSize: 12, color: "#9CA3AF", padding: "4px 2px" }}>Aucun pays sélectionné</span>
          )}
        </div>

        {/* Picker */}
        <select
          value=""
          onChange={(e) => { addCountry(e.target.value); e.target.value = ""; }}
          disabled={geoPending || available.length === 0}
          style={{
            width: "100%", padding: "8px 12px", fontSize: 13,
            border: "1.5px solid var(--klint-line)", borderRadius: 8,
            fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            color: "#374151", background: "#fff", cursor: "pointer",
          }}
        >
          <option value="">Ajouter un pays…</option>
          {available.map((c) => (
            <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
          ))}
        </select>
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
          if (geoEnabled && selected.length === 0) {
            setGeoMsg({ ok: false, text: "Sélectionnez au moins un pays de confiance, ou désactivez le blocage." });
            return;
          }
          setGeoPending(true);
          startTransition(async () => {
            await saveSecuritySettings({ enabled: geoEnabled, trustedCountries: selected });
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
