/**
 * Topbar — 56px, 3 zones: left (planning selector) | center (breadcrumb) | right (search + actions)
 */
"use client";

import { Icon } from "@/components/ui/Icon";
import styles from "./Topbar.module.css";

interface TopbarProps {
  planningName?: string;
  planningStats?: string;
  currentView?: string;
  onPlanningClick?: () => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onShareClick?: () => void;
  presenceAvatars?: React.ReactNode;
}

export function Topbar({
  planningName = "Planning CCI 2026",
  planningStats = "23 lots · 72 phases · 9 domaines",
  currentView = "Gantt",
  onPlanningClick,
  onSearchClick,
  onNotificationsClick,
  onShareClick,
  presenceAvatars,
}: TopbarProps) {
  return (
    <header className={styles.topbar} role="banner">
      {/* Zone gauche — Sélecteur de planning */}
      <div className={styles.left}>
        <button
          className={styles.planningSelector}
          onClick={onPlanningClick}
          aria-label="Sélectionner un planning"
        >
          <span className={styles.planningBadge} aria-hidden>K</span>
          <span className={styles.planningInfo}>
            <span className={styles.planningName}>{planningName}</span>
            {planningStats && (
              <span className={styles.planningStats}>{planningStats}</span>
            )}
          </span>
          <Icon name="chevron" size={14} className={styles.chevron} />
        </button>
      </div>

      <div className={styles.sep} aria-hidden />

      {/* Zone centre — Fil d'Ariane */}
      <div className={styles.center}>
        <nav aria-label="Fil d'Ariane">
          <ol className={styles.crumbs}>
            <li className={styles.crumb}>
              <Icon name="calendar" size={13} />
              <span>Planning</span>
            </li>
            <li className={styles.crumb}>{currentView}</li>
          </ol>
        </nav>
      </div>

      <div className={styles.sep} aria-hidden />

      {/* Zone droite — Présence + Recherche + Actions */}
      <div className={styles.right}>
        {presenceAvatars && (
          <div className={styles.presence} aria-label="Collaborateurs connectés">
            {presenceAvatars}
          </div>
        )}

        <button
          className={styles.searchTrigger}
          onClick={onSearchClick}
          aria-label="Rechercher (⌘K)"
          title="Rechercher (⌘K)"
        >
          <Icon name="search" size={13} />
          <span className={styles.searchPlaceholder}>Rechercher…</span>
          <kbd className={styles.kbd}>⌘K</kbd>
        </button>

        <div className={styles.actions}>
          <button
            className={styles.iconBtn}
            onClick={onNotificationsClick}
            aria-label="Notifications"
            title="Notifications"
          >
            <Icon name="bell" size={15} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={onShareClick}
            aria-label="Partager"
            title="Partager"
          >
            <Icon name="share" size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
