"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import styles from "./Rail.module.css";
import type { IconName } from "@/components/ui/Icon";

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
}

const TOP_NAV: NavItem[] = [
  { href: "/p",          icon: "calendar",  label: "Planning"   },
  { href: "/synthese",   icon: "chartLine", label: "Synthèse"   },
  { href: "/ressources", icon: "users",     label: "Ressources" },
  { href: "/parametres", icon: "settings",  label: "Paramètres" },
  { href: "/historique", icon: "history",   label: "Historique" },
];

const BOTTOM_NAV: NavItem[] = [
  { href: "/presentation", icon: "presenting", label: "Présentation" },
  { href: "/aide",         icon: "info",       label: "Aide"         },
];

interface RailProps {
  avatarInitials?: string;
  avatarColor?: string;
}

export function Rail({ avatarInitials = "?", avatarColor = "#001D63" }: RailProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/p" ? pathname.startsWith("/p") : pathname.startsWith(href);

  return (
    <nav className={styles.rail} aria-label="Navigation principale">
      <div className={styles.brand} aria-hidden>
        <span className={styles.brandK}>K</span>
      </div>

      <div className={styles.topNav}>
        {TOP_NAV.map((item) => (
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

        <button
          className={styles.railAvatar}
          aria-label="Menu profil"
          data-label="Profil"
          style={{ background: avatarColor }}
        >
          {avatarInitials.slice(0, 2).toUpperCase()}
        </button>
      </div>
    </nav>
  );
}

export default Rail;
