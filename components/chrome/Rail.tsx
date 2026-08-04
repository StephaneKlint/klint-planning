"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon } from "@/components/ui/Icon";
import { changePassword } from "@/lib/actions/authActions";
import styles from "./Rail.module.css";
import type { IconName } from "@/components/ui/Icon";

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next,    setNext]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setPending(true); setError("");
    const res = await changePassword({ currentPassword: current, newPassword: next });
    setPending(false);
    if (!res.success) { setError(res.error ?? "Erreur"); return; }
    setSuccess(true);
  }

  const inputStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 6, border: "1px solid #D1D5DB",
    fontSize: 13, color: "#111827", outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 12, width: 400, maxWidth: "calc(100vw - 32px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: "16px 20px 14px", borderBottom: "1px solid #E5E7EB",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0F2746" }}>Changer mon mot de passe</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "1px solid #D1D5DB", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {success ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#16A34A" }}>Mot de passe modifié avec succès.</p>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, background: "#2563EB", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Fermer</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>Mot de passe actuel</label>
                <input required type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>Nouveau mot de passe</label>
                <input required type="password" value={next} onChange={(e) => setNext(e.target.value)} style={inputStyle} placeholder="8 caractères minimum" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>Confirmer le nouveau mot de passe</label>
                <input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
              </div>
              {error && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{error}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
                <button type="button" onClick={onClose} style={{ padding: "7px 14px", borderRadius: 6, background: "transparent", border: "1px solid #D1D5DB", cursor: "pointer", fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={pending} style={{ padding: "7px 16px", borderRadius: 6, background: "#2563EB", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  {pending ? "Modification…" : "Modifier"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
}

// Pages that should receive ?planningId= when navigating from a planning
const PLANNING_AWARE = new Set(["/synthese", "/ressources", "/parametres", "/administration"]);

const TOP_NAV: NavItem[] = [
  { href: "/plannings",    icon: "layers",    label: "Plannings"    },
  { href: "/portefeuille", icon: "grid",      label: "Portefeuille" },
  { href: "/p",            icon: "calendar",  label: "Gantt"        },
  { href: "/synthese",     icon: "chartLine", label: "Synthèse"     },
];

const BOTTOM_NAV: NavItem[] = [
  { href: "/presentation", icon: "presenting", label: "Présentation" },
  { href: "/aide",         icon: "info",       label: "Aide"         },
];

interface RailProps {
  avatarInitials?: string;
  avatarColor?: string;
  logoDataUrl?: string | null;
  logoAlt?: string;
  isAdmin?: boolean;
}

export function Rail({ avatarInitials = "?", avatarColor = "#001D63", logoDataUrl, logoAlt = "Klint", isAdmin = false }: RailProps) {
  const pathname = usePathname();
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);

  // Extract planningId from current URL (e.g. /p/[planningId]/...)
  const pathPlanningId = pathname.startsWith("/p/") ? pathname.split("/")[2] : null;

  const isActive = (href: string) =>
    href === "/p"
      ? pathname.startsWith("/p") && !pathname.startsWith("/plannings")
      : pathname.startsWith(href);

  // Inject ?planningId= for context-aware pages when a planning is active
  const resolveHref = (href: string) =>
    pathPlanningId && PLANNING_AWARE.has(href) ? `${href}?planningId=${pathPlanningId}` : href;

  return (
    <nav className={styles.rail} aria-label="Navigation principale">
      {/* Logo */}
      <div className={styles.brand} aria-hidden>
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoDataUrl} alt={logoAlt} className={styles.customLogo} />
        ) : (
          <div className={styles.brandMark}>
            <span className={styles.brandK}>K</span>
            <span className={styles.brandSub}>LINT</span>
          </div>
        )}
      </div>

      <div className={styles.topNav}>
        {TOP_NAV.map((item) => (
          <Link
            key={item.href}
            href={resolveHref(item.href)}
            prefetch={false}
            className={`${styles.railBtn} ${isActive(item.href) ? styles.active : ""}`}
            aria-label={item.label}
            data-label={item.label}
          >
            <Icon name={item.icon} size={18} />
          </Link>
        ))}
        {/* Single settings/admin entry — shield for admins, settings gear for others */}
        {(() => {
          const href = isAdmin ? "/administration" : "/parametres";
          const label = isAdmin ? "Administration" : "Paramètres";
          const icon: IconName = isAdmin ? "shield" : "settings";
          return (
            <Link
              href={resolveHref(href)}
              prefetch={false}
              className={`${styles.railBtn} ${isActive(href) ? styles.active : ""}`}
              aria-label={label}
              data-label={label}
            >
              <Icon name={icon} size={18} />
            </Link>
          );
        })()}
      </div>

      <div className={styles.spacer} />

      <div className={styles.bottomNav}>
        {BOTTOM_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`${styles.railBtn} ${isActive(item.href) ? styles.active : ""}`}
            aria-label={item.label}
            data-label={item.label}
          >
            <Icon name={item.icon} size={18} />
          </Link>
        ))}

        <div style={{ position: "relative" }}>
          <button
            className={styles.railAvatar}
            aria-label="Menu profil"
            data-label="Profil"
            style={{ background: avatarColor }}
            onClick={() => setProfileOpen((o) => !o)}
          >
            {avatarInitials.slice(0, 2).toUpperCase()}
          </button>
          {profileOpen && (
            <div className={styles.profileMenu}>
              <div className={styles.profileInitials} style={{ background: avatarColor }}>
                {avatarInitials.slice(0, 2).toUpperCase()}
              </div>
              <button
                className={styles.profileMenuItem}
                onClick={() => { setProfileOpen(false); setChangePassOpen(true); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Changer mon mot de passe
              </button>
              <button
                className={styles.profileMenuItem}
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
      {changePassOpen && <ChangePasswordModal onClose={() => setChangePassOpen(false)} />}
    </nav>
  );
}

export default Rail;
