"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icon } from "@/components/ui/Icon";
import styles from "./Rail.module.css";
import type { IconName } from "@/components/ui/Icon";

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
}

// Pages that should receive ?planningId= when navigating from a planning
const PLANNING_AWARE = new Set(["/synthese", "/ressources", "/parametres"]);

const TOP_NAV: NavItem[] = [
  { href: "/plannings",    icon: "layers",    label: "Plannings"    },
  { href: "/portefeuille", icon: "grid",      label: "Portefeuille" },
  { href: "/p",            icon: "calendar",  label: "Planning"     },
  { href: "/synthese",     icon: "chartLine", label: "Synthèse"     },
  { href: "/parametres",   icon: "settings",  label: "Paramètres"   },
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
}

export function Rail({ avatarInitials = "?", avatarColor = "#001D63", logoDataUrl, logoAlt = "Klint" }: RailProps) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);

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
    </nav>
  );
}

export default Rail;
