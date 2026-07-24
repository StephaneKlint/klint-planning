"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./Parametres.module.css";
import type { AppSettings } from "@/lib/actions/appSettings";
import { saveAppLogo, saveAppFavicon } from "@/lib/actions/appSettings";

export function ApparenceSection({ appCfg }: { appCfg: AppSettings }) {
  const router = useRouter();
  const logoInputRef   = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [logoPreview,  setLogoPreview]  = useState<string | null>(appCfg.logoDataUrl ?? null);
  const [logoAlt,      setLogoAlt]      = useState(appCfg.logoAlt || "Klint");
  const [logoUnsaved,  setLogoUnsaved]  = useState(false);
  const [logoSaving,   setLogoSaving]   = useState(false);
  const [logoMsg,      setLogoMsg]      = useState<string | null>(null);

  const [faviconPreview,  setFaviconPreview]  = useState<string | null>(appCfg.faviconDataUrl ?? null);
  const [faviconUnsaved,  setFaviconUnsaved]  = useState(false);
  const [faviconSaving,   setFaviconSaving]   = useState(false);
  const [faviconMsg,      setFaviconMsg]      = useState<string | null>(null);

  return (
    <div className={styles.tabPanel}>
      {/* ─── Logo ─────────────────────────────────────────────────── */}
      <p className={styles.tabDesc}>
        <strong>Logo dans la barre de navigation.</strong> Format recommandé&nbsp;: PNG ou SVG carré,
        fond transparent. Taille max&nbsp;: 200&nbsp;Ko.
      </p>

      <div className={styles.logoSection}>
        <div className={styles.logoPreviewBox}>
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt={logoAlt} className={styles.logoPreviewImg} />
          ) : (
            <div className={styles.logoKlintFallback}>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#5CD696" }}>K</span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>LINT</span>
            </div>
          )}
        </div>

        <div className={styles.logoControls}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Texte alternatif</span>
            <input
              type="text"
              className={styles.addInput}
              value={logoAlt}
              onChange={(e) => { setLogoAlt(e.target.value); setLogoUnsaved(true); }}
              placeholder="ex. Mon Entreprise"
              maxLength={100}
            />
          </div>

          <div className={styles.logoButtonRow}>
            <label
              htmlFor="logo-file-input"
              className={`${styles.addBtn} ${styles.uploadLabel} ${logoSaving ? styles.uploadLabelDisabled : ""}`}
              aria-disabled={logoSaving}
            >
              {logoPreview ? "Changer le logo" : "Choisir un logo…"}
            </label>

            {(logoPreview || logoUnsaved) && (
              <button
                className={styles.saveBtn}
                onClick={async () => {
                  if (!logoPreview) return;
                  setLogoSaving(true);
                  await saveAppLogo(logoPreview, logoAlt || "Klint");
                  setLogoMsg("Logo enregistré ✓");
                  setLogoUnsaved(false);
                  setLogoSaving(false);
                  router.refresh();
                  setTimeout(() => setLogoMsg(null), 3000);
                }}
                disabled={logoSaving || !logoPreview}
              >
                {logoSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            )}

            {logoPreview && (
              <button
                className={`${styles.deleteRowBtn} ${styles.logoResetBtn}`}
                onClick={async () => {
                  setLogoSaving(true);
                  await saveAppLogo(null, "Klint");
                  setLogoPreview(null);
                  setLogoAlt("Klint");
                  setLogoUnsaved(false);
                  setLogoMsg("Logo réinitialisé.");
                  setLogoSaving(false);
                  router.refresh();
                  setTimeout(() => setLogoMsg(null), 3000);
                }}
                disabled={logoSaving}
              >
                Réinitialiser
              </button>
            )}
          </div>

          {logoUnsaved && !logoMsg && (
            <p className={styles.unsavedHint}>Fichier chargé — cliquez sur Enregistrer pour appliquer.</p>
          )}
          {logoMsg && <p className={styles.savedMsg}>{logoMsg}</p>}
        </div>
      </div>

      <input
        id="logo-file-input"
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 200 * 1024) {
            alert("Fichier trop lourd (max 200 Ko). Utilisez un SVG ou un PNG optimisé.");
            e.target.value = "";
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result;
            if (typeof result === "string") {
              setLogoPreview(result);
              setLogoUnsaved(true);
            }
            e.target.value = "";
          };
          reader.onerror = () => {
            alert("Impossible de lire ce fichier. Essayez un autre format.");
            e.target.value = "";
          };
          reader.readAsDataURL(file);
        }}
      />

      <hr style={{ border: "none", borderTop: "1px solid var(--klint-line)", margin: "24px 0" }} />

      {/* ─── Favicon ─────────────────────────────────────────────── */}
      <p className={styles.tabDesc}>
        <strong>Favicon (onglet du navigateur).</strong> Format recommandé&nbsp;: PNG ou SVG carré,
        32×32 px minimum. Taille max&nbsp;: 100&nbsp;Ko. Visible après rechargement de la page.
      </p>

      <div className={styles.logoSection}>
        <div className={styles.faviconPreviewBox}>
          {faviconPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={faviconPreview} alt="Favicon" className={styles.faviconPreviewImg} />
          ) : (
            <div className={styles.logoKlintFallback} style={{ transform: "scale(0.65)" }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#5CD696" }}>K</span>
            </div>
          )}
          <span className={styles.faviconLabel}>32px</span>
        </div>

        <div className={styles.logoControls}>
          <div className={styles.logoButtonRow}>
            <label
              htmlFor="favicon-file-input"
              className={`${styles.addBtn} ${styles.uploadLabel} ${faviconSaving ? styles.uploadLabelDisabled : ""}`}
              aria-disabled={faviconSaving}
            >
              {faviconPreview ? "Changer le favicon" : "Choisir un favicon…"}
            </label>

            {(faviconPreview || faviconUnsaved) && (
              <button
                className={styles.saveBtn}
                onClick={async () => {
                  if (!faviconPreview) return;
                  setFaviconSaving(true);
                  await saveAppFavicon(faviconPreview);
                  setFaviconMsg("Favicon enregistré ✓ (rechargez la page pour voir l'effet)");
                  setFaviconUnsaved(false);
                  setFaviconSaving(false);
                  setTimeout(() => setFaviconMsg(null), 5000);
                }}
                disabled={faviconSaving || !faviconPreview}
              >
                {faviconSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            )}

            {faviconPreview && (
              <button
                className={`${styles.deleteRowBtn} ${styles.logoResetBtn}`}
                onClick={async () => {
                  setFaviconSaving(true);
                  await saveAppFavicon(null);
                  setFaviconPreview(null);
                  setFaviconUnsaved(false);
                  setFaviconMsg("Favicon réinitialisé.");
                  setFaviconSaving(false);
                  setTimeout(() => setFaviconMsg(null), 3000);
                }}
                disabled={faviconSaving}
              >
                Réinitialiser
              </button>
            )}
          </div>

          {faviconUnsaved && !faviconMsg && (
            <p className={styles.unsavedHint}>Fichier chargé — cliquez sur Enregistrer pour appliquer.</p>
          )}
          {faviconMsg && <p className={styles.savedMsg}>{faviconMsg}</p>}
        </div>
      </div>

      <input
        id="favicon-file-input"
        ref={faviconInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 100 * 1024) {
            alert("Fichier trop lourd (max 100 Ko). Utilisez un SVG ou un PNG 32×32.");
            e.target.value = "";
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result;
            if (typeof result === "string") {
              setFaviconPreview(result);
              setFaviconUnsaved(true);
            }
            e.target.value = "";
          };
          reader.onerror = () => {
            alert("Impossible de lire ce fichier.");
            e.target.value = "";
          };
          reader.readAsDataURL(file);
        }}
      />
    </div>
  );
}
