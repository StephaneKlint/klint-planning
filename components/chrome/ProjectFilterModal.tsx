"use client";
/**
 * ProjectFilterModal — Sélecteur de visibilité des lots dans le Gantt.
 * Utilise hiddenLotIds du ganttStore pour afficher/masquer les lots.
 */
import { useGanttStore } from "@/store/ganttStore";
import type { DomainRow, LotRow } from "@/lib/db/queries";
import styles from "./ProjectFilter.module.css";

interface Props {
  domains: DomainRow[];
  lots: LotRow[];
  onClose: () => void;
}

export function ProjectFilterModal({ domains, lots, onClose }: Props) {
  const { hiddenLotIds, toggleLotVisibility, setProjectFilterOpen } = useGanttStore();

  const close = () => {
    setProjectFilterOpen(false);
    onClose();
  };

  const allLotIds = lots.map((l) => l.id);
  const allHidden = allLotIds.every((id) => hiddenLotIds.has(id));
  const someHidden = allLotIds.some((id) => hiddenLotIds.has(id));

  const handleSelectAll = () => {
    // Afficher tous (supprimer toutes les entrées hiddenLotIds)
    allLotIds.forEach((id) => {
      if (hiddenLotIds.has(id)) toggleLotVisibility(id);
    });
  };

  const handleDeselectAll = () => {
    // Masquer tous
    allLotIds.forEach((id) => {
      if (!hiddenLotIds.has(id)) toggleLotVisibility(id);
    });
  };

  const handleDomainToggle = (domainId: string) => {
    const domainLots = lots.filter((l) => l.domainId === domainId);
    const allDomainHidden = domainLots.every((l) => hiddenLotIds.has(l.id));
    domainLots.forEach((l) => {
      if (allDomainHidden) {
        // Afficher tous les lots du domaine
        if (hiddenLotIds.has(l.id)) toggleLotVisibility(l.id);
      } else {
        // Masquer tous les lots du domaine
        if (!hiddenLotIds.has(l.id)) toggleLotVisibility(l.id);
      }
    });
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-label="Filtrer les projets affichés"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Projets affichés</span>
          <div className={styles.headerActions}>
            <button
              className={styles.actionBtn}
              onClick={handleSelectAll}
              disabled={!someHidden}
            >
              Tout afficher
            </button>
            <button
              className={styles.actionBtn}
              onClick={handleDeselectAll}
              disabled={allHidden}
            >
              Tout masquer
            </button>
            <button className={styles.closeBtn} onClick={close} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>

        {/* List */}
        <div className={styles.list}>
          {domains.map((domain) => {
            const domainLots = lots.filter((l) => l.domainId === domain.id);
            if (domainLots.length === 0) return null;
            const allDomainHidden = domainLots.every((l) => hiddenLotIds.has(l.id));
            const someDomainHidden = domainLots.some((l) => hiddenLotIds.has(l.id));

            return (
              <div key={domain.id} className={styles.domainBlock}>
                {/* Domain row */}
                <div className={styles.domainRow}>
                  <button
                    className={`${styles.check} ${allDomainHidden ? styles.checkOff : someDomainHidden ? styles.checkMixed : styles.checkOn}`}
                    onClick={() => handleDomainToggle(domain.id)}
                    aria-label={allDomainHidden ? `Afficher ${domain.name}` : `Masquer ${domain.name}`}
                  >
                    {allDomainHidden ? "○" : someDomainHidden ? "◐" : "●"}
                  </button>
                  <span
                    className={styles.domainChip}
                    style={{ background: domain.bg, color: domain.strong }}
                  >
                    {domain.name}
                  </span>
                  <span className={styles.domainCount}>
                    {domainLots.length - domainLots.filter((l) => hiddenLotIds.has(l.id)).length}/{domainLots.length} affiché{domainLots.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Lot rows */}
                <div className={styles.lotList}>
                  {domainLots.map((lot) => {
                    const hidden = hiddenLotIds.has(lot.id);
                    return (
                      <label key={lot.id} className={`${styles.lotRow} ${hidden ? styles.lotRowHidden : ""}`}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={!hidden}
                          onChange={() => toggleLotVisibility(lot.id)}
                        />
                        <span className={styles.lotName}>{lot.name}</span>
                        {lot.subtitle && (
                          <span className={styles.lotSubtitle}>{lot.subtitle}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            {hiddenLotIds.size === 0
              ? "Tous les projets sont affichés"
              : `${hiddenLotIds.size} projet${hiddenLotIds.size > 1 ? "s" : ""} masqué${hiddenLotIds.size > 1 ? "s" : ""}`}
          </span>
          <button className={styles.doneBtn} onClick={close}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
