/**
 * Page Aide — Guide utilisateur mode formation (avec recherche)
 * Couvre l'ensemble des fonctionnalités (Jalons 0-10)
 */
"use client";

import { useState, useMemo } from "react";

const S = {
  page: {
    padding: "32px 40px 60px",
    fontFamily: "var(--font-display, system-ui)",
    color: "var(--klint-navy, #001036)",
    maxWidth: 720,
    lineHeight: "1.6",
  } as React.CSSProperties,
  h1: {
    fontSize: 26,
    fontWeight: 800,
    marginBottom: 6,
    color: "var(--klint-navy)",
  } as React.CSSProperties,
  intro: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    borderBottom: "1px solid var(--klint-line, #E6E8EE)",
    paddingBottom: 20,
  } as React.CSSProperties,
  searchWrap: {
    marginBottom: 28,
    position: "relative",
  } as React.CSSProperties,
  searchInput: {
    width: "100%",
    padding: "9px 14px 9px 38px",
    fontFamily: "var(--font-display, system-ui)",
    fontSize: 14,
    color: "var(--klint-navy)",
    background: "var(--klint-white, #fff)",
    border: "1.5px solid var(--klint-line, #E6E8EE)",
    borderRadius: 10,
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties,
  searchIcon: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9CA3AF",
    fontSize: 15,
    pointerEvents: "none",
  } as React.CSSProperties,
  searchClear: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#9CA3AF",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "2px 4px",
  } as React.CSSProperties,
  noResult: {
    padding: "32px 0",
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
  } as React.CSSProperties,
  section: {
    marginBottom: 36,
  } as React.CSSProperties,
  h2: {
    fontSize: 17,
    fontWeight: 700,
    color: "var(--klint-navy)",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,
  pill: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
    background: "var(--klint-navy, #001036)",
    color: "white",
    letterSpacing: "0.04em",
    verticalAlign: "middle",
  } as React.CSSProperties,
  dl: {
    fontSize: 13,
    lineHeight: "1.7",
    color: "#374151",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  } as React.CSSProperties,
  dt: {
    fontWeight: 700,
    color: "var(--klint-navy)",
    marginBottom: 2,
  } as React.CSSProperties,
  dd: {
    margin: 0,
    color: "#6B7280",
    paddingLeft: 12,
    borderLeft: "2px solid var(--klint-line, #E6E8EE)",
  } as React.CSSProperties,
  kbd: {
    display: "inline-block",
    padding: "1px 6px",
    border: "1px solid #D1D5DB",
    borderRadius: 5,
    background: "#F9FAFB",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    fontWeight: 600,
    color: "#374151",
    lineHeight: "1.6",
    verticalAlign: "middle",
    marginInline: 2,
  } as React.CSSProperties,
  tip: {
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#1D4ED8",
    marginTop: 8,
  } as React.CSSProperties,
  divider: {
    border: "none",
    borderTop: "1px solid var(--klint-line, #E6E8EE)",
    margin: "8px 0 32px",
  } as React.CSSProperties,
  toc: {
    background: "var(--klint-paper, #F6F7FB)",
    border: "1px solid var(--klint-line, #E6E8EE)",
    borderRadius: 10,
    padding: "16px 20px",
    marginBottom: 36,
    fontSize: 13,
  } as React.CSSProperties,
  tocTitle: {
    fontWeight: 700,
    color: "var(--klint-navy)",
    marginBottom: 8,
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
  },
  tocList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "4px 16px",
  },
  tocItem: {
    color: "#3B82F6",
    textDecoration: "none" as const,
    fontSize: 13,
  },
};

function Kbd({ children }: { children: React.ReactNode }) {
  return <span style={S.kbd}>{children}</span>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div style={S.tip}>💡 {children}</div>;
}

// ─── Section data for search matching ────────────────────────────────────────
interface SectionDef {
  id: string;
  num: string;
  title: string;
  keywords: string;  // flat text for search
}

const SECTIONS: SectionDef[] = [
  { id: "plannings",    num: "1",  title: "Mes plannings",                   keywords: "plannings créer dupliquer archiver liste importer exporter json import export nouveau planning multi mono modele vide renommer supprimer" },
  { id: "gantt",        num: "2",  title: "Vue Gantt",                        keywords: "gantt domaine lot phase jalon navigation zoom coloration affichage filtrer période présence ajouter filtres vide empty état domaine créer supprimer tooltip survol dates" },
  { id: "toolbar",      num: "3",  title: "Barre d'outils",                   keywords: "toolbar barre outils panneau aujourd hui pdf json projets sélection filtrer annuler undo" },
  { id: "edit",         num: "4",  title: "Édition des phases et jalons",     keywords: "éditer phase jalon dates statut avancement couleur note assigné responsable sélection multiple recherche palette commandes ctrl k fermer overlay" },
  { id: "raccourcis",   num: "5",  title: "Raccourcis clavier",               keywords: "raccourcis clavier ctrl k esc flèches zoom selection escape undo annuler ctrl z" },
  { id: "synthese",     num: "6",  title: "Vue Synthèse",                     keywords: "synthèse kpi indicateurs jalons retard risque alertes avancement domaine collapsible ouvrir fermer sous-projets lots chips statuts" },
  { id: "ressources",   num: "7",  title: "Vue Ressources",                   keywords: "ressources membres responsables ajouter modifier supprimer attribution phases planning email initiales couleur picker existant" },
  { id: "parametres",   num: "8",  title: "Paramètres",                       keywords: "paramètres général cadence types phases jalons statuts membres droits apparence logo calendrier fermetures jours fériés" },
  { id: "logo",         num: "9",  title: "Logo & Apparence",                 keywords: "logo apparence navbar png svg favicon changer enregistrer réinitialiser" },
  { id: "pdf",          num: "10", title: "Export PDF A3",                    keywords: "pdf export a3 imprimer impression format paysage capture download télécharger largeur adaptative" },
  { id: "calendrier",   num: "11", title: "Fermetures & Jours fériés",        keywords: "fermetures jours fériés calendrier congés été hiver gel gel-code période custom bande colorée affichage toggle" },
  { id: "historique",   num: "12", title: "Historique & Surveillance connexions", keywords: "historique activité connexions surveillance sécurité alerte ip géolocalisation pays france email resend log" },
  { id: "securite",     num: "13", title: "Sécurité & Mot de passe",              keywords: "sécurité mot de passe connexion login credentials changer modifier oublié administrateur paramètres bcrypt" },
  { id: "portefeuille", num: "14", title: "Vue Portefeuille",                    keywords: "portefeuille dashboard multi-plannings vue globale consolidée jalons à venir dépassés retard risque filtre statut progression cards timeline cross-planning" },
];

export default function AidePage() {
  const [search, setSearch] = useState("");

  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set(SECTIONS.map((s) => s.id));
    return new Set(
      SECTIONS
        .filter((s) =>
          s.title.toLowerCase().includes(q) ||
          s.keywords.toLowerCase().includes(q)
        )
        .map((s) => s.id)
    );
  }, [search]);

  const hasResults = visibleIds.size > 0;

  function show(id: string) { return visibleIds.has(id); }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Guide utilisateur</h1>
      <p style={S.intro}>
        Bienvenue dans Klint Planning — votre outil de gestion Gantt collaboratif.
        Ce guide présente l&apos;ensemble des fonctionnalités disponibles.
      </p>

      {/* ── Recherche ── */}
      <div style={S.searchWrap}>
        <span style={S.searchIcon}>🔍</span>
        <input
          style={S.searchInput}
          type="text"
          placeholder="Rechercher dans l'aide… (ex. import, undo, PDF, raccourci)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher dans l'aide"
        />
        {search && (
          <button style={S.searchClear} onClick={() => setSearch("")} aria-label="Effacer la recherche">×</button>
        )}
      </div>

      {/* Table des matières — masquée si recherche active */}
      {!search && (
        <div style={S.toc}>
          <p style={S.tocTitle}>Sommaire</p>
          <ul style={S.tocList}>
            {SECTIONS.map(({ id, num, title }) => (
              <li key={id}>
                <a href={`#${id}`} style={S.tocItem}>{num}. {title}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasResults && (
        <p style={S.noResult}>Aucune section trouvée pour &laquo; {search} &raquo;.</p>
      )}

      {/* ── 1. Mes plannings ── */}
      {show("plannings") && (
        <section style={S.section} id="plannings">
          <h2 style={S.h2}><span style={S.pill}>1</span> Mes plannings</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Accéder à la liste</dt>
              <dd style={S.dd}>Cliquez sur <strong>Plannings</strong> dans le rail de navigation gauche pour voir tous vos plannings actifs sous forme de cartes.</dd>
            </div>
            <div>
              <dt style={S.dt}>Créer un planning — 3 modes</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>+ Nouveau planning</strong>. Choisissez un point de départ :<br />
                — <strong>Planning vide</strong> : crée un planning vierge. Choisissez le type (Multi-projets ou Mono-projet), le nom, l&apos;année et les dates. Le planning s&apos;ouvrira avec un état vide vous invitant à créer votre premier domaine.<br />
                — <strong>Dupliquer un planning</strong> : copie complète d&apos;un planning existant (domaines, lots, phases, jalons, paramètres). Disponible depuis la liste des plannings (bouton dédié sur la carte) ou depuis <strong>Nouveau planning → Dupliquer</strong>. Sélectionnez le planning source, personnalisez le nom, puis cliquez sur « Dupliquer ».<br />
                — <strong>Depuis un modèle</strong> : même fonctionnement que la duplication, mais à partir d&apos;un planning de référence servant de modèle.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Renommer un planning</dt>
              <dd style={S.dd}>Sur la liste des plannings, cliquez sur le bouton <strong>✎</strong> à droite du nom de la carte pour ouvrir une modale. Vous pouvez y modifier le nom, l&apos;année et les dates du planning, puis enregistrer.</dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer un planning</dt>
              <dd style={S.dd}>Sur la carte du planning dans la liste, cliquez sur le bouton <strong>🗑</strong>. Une confirmation est demandée. La suppression est définitive : tous les domaines, projets, phases et jalons associés sont effacés.</dd>
            </div>
            <div>
              <dt style={S.dt}>Exporter en JSON</dt>
              <dd style={S.dd}>Depuis la liste, cliquez sur <strong>⬇ JSON</strong> pour télécharger un export complet du planning (structure, phases, jalons, paramètres). Depuis la vue Gantt, utilisez le bouton <strong>JSON</strong> dans la barre d&apos;outils.</dd>
            </div>
            <div>
              <dt style={S.dt}>Importer un JSON</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>⬆ Importer JSON</strong>. Après sélection du fichier, une fenêtre vous propose deux options :<br />
                — <strong>Créer un nouveau planning</strong> : importe la structure complète comme planning indépendant.<br />
                — <strong>Mettre à jour un planning existant</strong> : met à jour les dates, statuts et notes des phases/jalons correspondants (par code domaine + nom lot + type &amp; libellé). Les éléments non trouvés sont ajoutés. Aucune suppression.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Archiver un planning</dt>
              <dd style={S.dd}>Cliquez sur <strong>Archive</strong> pour masquer le planning. Les données sont conservées en base.</dd>
            </div>
          </dl>
        </section>
      )}

      {show("plannings") && show("gantt") && <hr style={S.divider} />}

      {/* ── 2. Vue Gantt ── */}
      {show("gantt") && (
        <section style={S.section} id="gantt">
          <h2 style={S.h2}><span style={S.pill}>2</span> Vue Gantt</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Planning vide — créer le premier domaine</dt>
              <dd style={S.dd}>
                Lorsqu&apos;un planning ne contient encore aucun domaine, le panneau gauche affiche un état vide avec un bouton <strong>+ Créer un domaine</strong>. Cliquez dessus (ou sur <strong>+ Domaine</strong> en haut du panneau) pour ouvrir le formulaire de création.<br />
                Choisissez une <strong>couleur</strong> parmi les 8 palettes prédéfinies, saisissez le <strong>nom</strong> du domaine (le code est généré automatiquement), puis validez. Répétez pour chaque domaine, puis ajoutez les projets (lots) et les phases.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Naviguer dans le temps</dt>
              <dd style={S.dd}>Faites défiler horizontalement avec la molette ou le trackpad. Utilisez les boutons <strong>‹ ›</strong> de la barre d&apos;outils pour avancer ou reculer d&apos;une période entière.</dd>
            </div>
            <div>
              <dt style={S.dt}>Niveaux de zoom</dt>
              <dd style={S.dd}>Choisissez parmi <strong>1m · 3m · 6m · 12m</strong> dans la barre d&apos;outils. Le zoom 12m affiche l&apos;année complète.</dd>
            </div>
            <div>
              <dt style={S.dt}>Coloration des phases</dt>
              <dd style={S.dd}>
                Cliquez sur le bouton de coloration pour alterner entre trois modes :<br />
                — <strong>Domaine</strong> : chaque domaine a sa propre couleur.<br />
                — <strong>Statut</strong> : la couleur reflète l&apos;état d&apos;avancement.<br />
                — <strong>Personne</strong> : la couleur correspond au responsable assigné.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Afficher / masquer des domaines</dt>
              <dd style={S.dd}>Cliquez sur <strong>Affichage</strong> dans la barre d&apos;outils pour activer/désactiver les bandes de couleur des domaines.</dd>
            </div>
            <div>
              <dt style={S.dt}>Filtrer les projets visibles</dt>
              <dd style={S.dd}>Cliquez sur <strong>Projets</strong> dans la barre d&apos;outils pour ouvrir le sélecteur de visibilité. Cochez ou décochez chaque lot (sous-projet) pour l&apos;afficher ou le masquer dans le Gantt. Utilisez « Tout afficher » / « Tout masquer » pour réinitialiser.</dd>
            </div>
            <div>
              <dt style={S.dt}>Filtrer par période</dt>
              <dd style={S.dd}>Utilisez les champs <strong>Du … au …</strong> dans la barre d&apos;outils pour restreindre la plage affichée.</dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer un domaine</dt>
              <dd style={S.dd}>Cliquez sur l&apos;en-tête du domaine dans le panneau gauche pour ouvrir son panneau d&apos;édition, puis cliquez sur le bouton <strong>🗑</strong> dans le footer (à gauche). La suppression efface le domaine et tout son contenu : projets (lots), phases et jalons.</dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer un projet (lot)</dt>
              <dd style={S.dd}>Cliquez sur la ligne du projet dans le panneau gauche pour ouvrir son panneau d&apos;édition, puis cliquez sur le bouton <strong>🗑</strong> dans le footer (à gauche). Toutes les phases et jalons du lot sont supprimés.</dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer une phase</dt>
              <dd style={S.dd}>Ouvrez la phase en cliquant dessus dans le Gantt (panneau d&apos;édition à droite), puis cliquez sur le bouton <strong>🗑</strong> en bas du panneau.</dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer un jalon</dt>
              <dd style={S.dd}>Cliquez sur le jalon dans le Gantt pour afficher son panneau, puis cliquez sur le bouton <strong>🗑</strong> dans le footer du panneau.</dd>
            </div>
            <div>
              <dt style={S.dt}>Présence des collaborateurs</dt>
              <dd style={S.dd}>Les avatars en haut à droite indiquent les membres connectés en temps réel (mis à jour toutes les 30 s).</dd>
            </div>
          </dl>
        </section>
      )}

      {show("gantt") && show("toolbar") && <hr style={S.divider} />}

      {/* ── 3. Barre d'outils ── */}
      {show("toolbar") && (
        <section style={S.section} id="toolbar">
          <h2 style={S.h2}><span style={S.pill}>3</span> Barre d&apos;outils</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Masquer / afficher le panneau latéral</dt>
              <dd style={S.dd}>Le bouton <strong>couches</strong> réduit ou affiche le panneau gauche des domaines/lots.</dd>
            </div>
            <div>
              <dt style={S.dt}>Aller à Aujourd&apos;hui</dt>
              <dd style={S.dd}>Cliquez sur <strong>Aujourd&apos;hui</strong> pour recentrer la vue sur la date du jour.</dd>
            </div>
            <div>
              <dt style={S.dt}>Œil (Affichage)</dt>
              <dd style={S.dd}>Active ou désactive les <strong>bandes de couleur de fond</strong> affichées derrière chaque domaine dans la timeline. Utile pour alléger l&apos;affichage ou le rendre plus lisible à l&apos;impression.</dd>
            </div>
            <div>
              <dt style={S.dt}>Domaine / Statut / Personne</dt>
              <dd style={S.dd}>Bascule le mode de coloration des barres de phases entre trois options :<br />
                — <strong>Domaine</strong> : couleur propre à chaque domaine.<br />
                — <strong>Statut</strong> : couleur reflétant l&apos;état d&apos;avancement (planifiée, en cours, terminée, à risque…).<br />
                — <strong>Personne</strong> : couleur du responsable assigné à la phase.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Projets (filtre de visibilité)</dt>
              <dd style={S.dd}>Le bouton <strong>Projets</strong> ouvre le sélecteur de visibilité des lots. Cochez ou décochez chaque lot (sous-projet) pour l&apos;afficher ou le masquer dans le Gantt. Utilisez « Tout afficher » / « Tout masquer » pour réinitialiser rapidement.</dd>
            </div>
            <div>
              <dt style={S.dt}>Exporter en JSON</dt>
              <dd style={S.dd}>Le bouton <strong>JSON</strong> déclenche le téléchargement de l&apos;export complet du planning au format JSON.</dd>
            </div>
            <div>
              <dt style={S.dt}>Export PDF A3</dt>
              <dd style={S.dd}>Cliquez sur <strong>PDF A3</strong> pour ouvrir la boîte de dialogue d&apos;impression. Voir la section <a href="#pdf" style={{ color: "#3B82F6" }}>Export PDF</a>.</dd>
            </div>
            <div>
              <dt style={S.dt}>Annuler (Ctrl+Z)</dt>
              <dd style={S.dd}>Le bouton <strong>↩</strong> (ou <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> / <Kbd>⌘Z</Kbd>) annule la dernière action : modification de date, statut, avancement, couleur, note d&apos;une phase ou d&apos;un jalon, et suppression de membre. Jusqu&apos;à 30 niveaux d&apos;annulation.</dd>
            </div>
          </dl>
        </section>
      )}

      {show("toolbar") && show("edit") && <hr style={S.divider} />}

      {/* ── 4. Édition ── */}
      {show("edit") && (
        <section style={S.section} id="edit">
          <h2 style={S.h2}><span style={S.pill}>4</span> Édition des phases et jalons</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Éditer une phase</dt>
              <dd style={S.dd}>Cliquez sur une phase dans le Gantt pour ouvrir le panneau d&apos;édition à droite. Vous pouvez modifier le type, le libellé, les dates, le statut, l&apos;avancement, les responsables assignés et la note interne.</dd>
            </div>
            <div>
              <dt style={S.dt}>Éditer un jalon</dt>
              <dd style={S.dd}>Cliquez sur le drapeau ou le losange d&apos;un jalon dans le Gantt pour afficher ses détails (type, date, couleur, note).</dd>
            </div>
            <div>
              <dt style={S.dt}>Annuler une modification</dt>
              <dd style={S.dd}>Toute modification d&apos;une phase (dates, statut, avancement, couleur, note, libellé) ou d&apos;un jalon est annulable via <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> ou le bouton ↩ dans la barre d&apos;outils.</dd>
            </div>
            <div>
              <dt style={S.dt}>Sélection multiple de phases</dt>
              <dd style={S.dd}><Kbd>⌘</Kbd>+clic (Mac) ou <Kbd>Ctrl</Kbd>+clic (Windows) pour sélectionner plusieurs phases. La barre en bas de l&apos;écran permet de changer leur statut en une seule action.</dd>
            </div>
            <div>
              <dt style={S.dt}>Recherche rapide ⌘K</dt>
              <dd style={S.dd}>Appuyez sur <Kbd>⌘K</Kbd> (Mac) ou <Kbd>Ctrl+K</Kbd> (Windows) pour ouvrir la palette de commandes.</dd>
            </div>
          </dl>
          <Tip>Après toute modification, le Gantt se met à jour automatiquement. Les autres collaborateurs voient les changements dans les 10 secondes.</Tip>
        </section>
      )}

      {show("edit") && show("raccourcis") && <hr style={S.divider} />}

      {/* ── 5. Raccourcis ── */}
      {show("raccourcis") && (
        <section style={S.section} id="raccourcis">
          <h2 style={S.h2}><span style={S.pill}>5</span> Raccourcis clavier</h2>
          <table style={{ fontSize: 13, borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                <th style={{ textAlign: "left", padding: "4px 12px 8px 0", color: "#9CA3AF", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Raccourci</th>
                <th style={{ textAlign: "left", padding: "4px 0 8px", color: "#9CA3AF", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                [<><Kbd>⌘K</Kbd> / <Kbd>Ctrl+K</Kbd></>, "Ouvrir la palette de commandes"],
                [<><Kbd>⌘Z</Kbd> / <Kbd>Ctrl+Z</Kbd></>, "Annuler la dernière action (undo)"],
                [<><Kbd>⌘</Kbd>+clic / <Kbd>Ctrl</Kbd>+clic</>, "Sélection multiple de phases"],
                [<><Kbd>[</Kbd></>, "Masquer / afficher le panneau latéral"],
                [<><Kbd>Esc</Kbd></>, "Fermer le panneau d'édition ou la palette"],
                [<><Kbd>←</Kbd> <Kbd>→</Kbd></>, "Période précédente / suivante (zoom < 12m)"],
                [<><Kbd>F</Kbd> (présentation)</>, "Activer / quitter le plein écran"],
              ].map(([shortcut, desc], i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                  <td style={{ padding: "8px 12px 8px 0", whiteSpace: "nowrap" }}>{shortcut}</td>
                  <td style={{ padding: "8px 0", color: "#6B7280" }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {show("raccourcis") && show("synthese") && <hr style={S.divider} />}

      {/* ── 6. Synthèse ── */}
      {show("synthese") && (
        <section style={S.section} id="synthese">
          <h2 style={S.h2}><span style={S.pill}>6</span> Vue Synthèse</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Tableau de bord KPI</dt>
              <dd style={S.dd}>La vue Synthèse affiche des indicateurs clés : nombre de phases en cours, en retard, à risque, terminées. Des jauges d&apos;avancement par domaine sont également visibles.</dd>
            </div>
            <div>
              <dt style={S.dt}>Avancement par domaine — section interactive</dt>
              <dd style={S.dd}>
                La section <strong>Avancement par domaine</strong> est interactive. Cliquez sur un domaine pour afficher ou masquer ses sous-projets (▶ fermé / ▼ ouvert). Chaque sous-projet affiche sa propre barre de progression ainsi que des chips de statuts.<br />
                Utilisez les boutons <strong>Tout ouvrir</strong> / <strong>Tout fermer</strong> (en haut de la section) pour développer ou replier tous les domaines en une seule action.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Jalons à horizon J+30 / J+60 / J+90</dt>
              <dd style={S.dd}>Trois colonnes listent les jalons dont la date est dans les 30, 60 ou 90 prochains jours.</dd>
            </div>
            <div>
              <dt style={S.dt}>Alertes retard et risque</dt>
              <dd style={S.dd}>Les phases dont la date de fin est dépassée ou marquées « À risque » apparaissent en rouge/orange.</dd>
            </div>
          </dl>
        </section>
      )}

      {show("synthese") && show("ressources") && <hr style={S.divider} />}

      {/* ── 7. Ressources ── */}
      {show("ressources") && (
        <section style={S.section} id="ressources">
          <h2 style={S.h2}><span style={S.pill}>7</span> Vue Ressources</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Liste des membres</dt>
              <dd style={S.dd}>La vue Ressources présente tous les membres du planning avec leurs initiales, leur couleur d&apos;avatar et leur email.</dd>
            </div>
            <div>
              <dt style={S.dt}>Ajouter un responsable</dt>
              <dd style={S.dd}>Cliquez sur <strong>+ Nouveau responsable</strong>. Renseignez le prénom, le nom, l&apos;email, les initiales et choisissez une couleur d&apos;avatar.</dd>
            </div>
            <div>
              <dt style={S.dt}>Modifier un membre</dt>
              <dd style={S.dd}>Cliquez sur le bouton <strong>✎</strong> pour ouvrir la modale. L&apos;email est affiché en lecture seule (non modifiable). Vous pouvez changer le nom, les initiales et la couleur.</dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer un membre</dt>
              <dd style={S.dd}>Cliquez sur <strong>×</strong> (confirmation requise). La suppression est annulable via <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> depuis la vue Gantt.</dd>
            </div>
            <div>
              <dt style={S.dt}>Attribution des phases</dt>
              <dd style={S.dd}>Cliquez sur <strong>Attribuer</strong> pour ouvrir la modale d&apos;attribution par domaine et lot.</dd>
            </div>
          </dl>
        </section>
      )}

      {show("ressources") && show("parametres") && <hr style={S.divider} />}

      {/* ── 8. Paramètres ── */}
      {show("parametres") && (
        <section style={S.section} id="parametres">
          <h2 style={S.h2}><span style={S.pill}>8</span> Paramètres</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Onglet Général</dt>
              <dd style={S.dd}>Passage automatique en retard, notification sur retard, délai de clôture automatique après mise en production.</dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Cadence</dt>
              <dd style={S.dd}>Configurez les délais en jours ouvrés entre la livraison et chaque type de jalon automatique, domaine par domaine.</dd>
            </div>
            <div>
              <dt style={S.dt}>Onglets Types de phases / Jalons</dt>
              <dd style={S.dd}>Créez, renommez ou supprimez les types de phases et les types de jalons propres à ce planning.</dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Statuts</dt>
              <dd style={S.dd}>Consultez les statuts disponibles (Planifiée, En cours, En revue, Terminée, À risque, En retard) et leur aperçu coloré.</dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Membres &amp; Droits</dt>
              <dd style={S.dd}>
                Gérez les niveaux d&apos;accès :<br />
                — <strong>Propriétaire</strong> : accès total.<br />
                — <strong>Éditeur</strong> : peut modifier le contenu.<br />
                — <strong>Lecteur</strong> : consultation uniquement.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Apparence</dt>
              <dd style={S.dd}>Personnalisez le logo. Voir la section <a href="#logo" style={{ color: "#3B82F6" }}>Logo &amp; Apparence</a>.</dd>
            </div>
          </dl>
          <Tip>Lorsque plusieurs plannings existent, des onglets de sélection apparaissent en haut des Paramètres pour basculer entre eux.</Tip>
        </section>
      )}

      {show("parametres") && show("logo") && <hr style={S.divider} />}

      {/* ── 9. Logo ── */}
      {show("logo") && (
        <section style={S.section} id="logo">
          <h2 style={S.h2}><span style={S.pill}>9</span> Logo &amp; Apparence</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Changer le logo dans la barre de navigation</dt>
              <dd style={S.dd}>Accédez à <strong>Paramètres → onglet Apparence</strong>. Cliquez sur <strong>Choisir un logo…</strong> et sélectionnez un fichier PNG, SVG, JPEG ou WebP.</dd>
            </div>
            <div>
              <dt style={S.dt}>Format recommandé</dt>
              <dd style={S.dd}>SVG ou PNG carré (1:1) avec fond transparent. Taille maximale : <strong>200 Ko</strong>. Le logo est redimensionné automatiquement à 44 × 44 px.</dd>
            </div>
            <div>
              <dt style={S.dt}>Enregistrer ou réinitialiser</dt>
              <dd style={S.dd}>Après avoir sélectionné un logo, cliquez sur <strong>Enregistrer</strong> pour l&apos;appliquer. Cliquez sur <strong>Réinitialiser (logo Klint)</strong> pour revenir au logo par défaut.</dd>
            </div>
          </dl>
          <Tip>Le logo est global à l&apos;application (pas par planning). Il est visible immédiatement après enregistrement pour tous les utilisateurs connectés.</Tip>
        </section>
      )}

      {show("logo") && show("pdf") && <hr style={S.divider} />}

      {/* ── 10. Export PDF / PNG ── */}
      {show("pdf") && (
        <section style={S.section} id="pdf">
          <h2 style={S.h2}><span style={S.pill}>10</span> Export PDF A3 &amp; Image PNG</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Export PDF A3 — pour impression</dt>
              <dd style={S.dd}>Cliquez sur <strong>PDF A3</strong> dans la barre d&apos;outils. Une fenêtre d&apos;impression s&apos;ouvre avec un aperçu du Gantt. Cliquez sur <strong>Imprimer / PDF</strong> pour enregistrer. Format A3 paysage (420 × 297 mm), résolution 1,5×.</dd>
            </div>
            <div>
              <dt style={S.dt}>Export PNG — pour PowerPoint et présentations</dt>
              <dd style={S.dd}>Cliquez sur <strong>PNG</strong> dans la barre d&apos;outils. L&apos;image est capturée en haute résolution (3×) et téléchargée directement sans fenêtre popup. Idéale pour être collée dans PowerPoint, Keynote ou tout outil de présentation : la qualité est nettement supérieure à celle du PDF importé.</dd>
            </div>
            <div>
              <dt style={S.dt}>Conseils pour un meilleur résultat</dt>
              <dd style={S.dd}>
                — Sélectionnez le zoom <strong>12m</strong> pour avoir l&apos;année complète sur une seule capture.<br />
                — Utilisez le filtre de dates pour restreindre la période si le planning est très long.<br />
                — Utilisez le bouton <strong>Projets</strong> pour masquer les lots non pertinents.<br />
                — Attendez que le Gantt soit entièrement chargé avant de lancer l&apos;export.
              </dd>
            </div>
          </dl>
          <Tip>Pour PowerPoint, préférez le bouton <strong>PNG</strong> : le fichier se télécharge directement et peut être inséré en tant qu&apos;image haute définition dans votre diapositive.</Tip>
        </section>
      )}

      {show("pdf") && show("calendrier") && <hr style={S.divider} />}

      {/* ── 11. Fermetures & Jours fériés ── */}
      {show("calendrier") && (
        <section style={S.section} id="calendrier">
          <h2 style={S.h2}><span style={S.pill}>11</span> Fermetures &amp; Jours fériés</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Accéder au calendrier</dt>
              <dd style={S.dd}>Allez dans <strong>Paramètres → onglet Fermetures / Jours fériés</strong>. Vous pouvez configurer ici les périodes de fermeture de votre entreprise ainsi que les jours fériés à afficher sur le Gantt.</dd>
            </div>
            <div>
              <dt style={S.dt}>Deux types de périodes</dt>
              <dd style={S.dd}>
                — <strong>Jours fériés</strong> (type <em>holiday</em>) : jours légaux ou conventionnels. Affichés avec une teinte colorée sur le Gantt.<br />
                — <strong>Fermetures / Gel de production</strong> (type <em>custom</em>) : congés d&apos;été, gel de fin d&apos;année, maintenance, etc. Configurables librement avec un label, une plage de dates et une couleur.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Afficher ou masquer dans le Gantt</dt>
              <dd style={S.dd}>Dans la barre d&apos;outils, cliquez sur <strong>Affichage</strong> puis activez / désactivez les cases <strong>Jours fériés</strong> et <strong>Fermetures / Gel</strong>. Les bandes colorées disparaissent ou réapparaissent instantanément.</dd>
            </div>
            <div>
              <dt style={S.dt}>Activer / désactiver une période</dt>
              <dd style={S.dd}>Dans l&apos;onglet Paramètres, chaque période possède un interrupteur. Désactiver une période la retire de l&apos;affichage sans la supprimer.</dd>
            </div>
          </dl>
          <Tip>Les bandes de fermeture sont visibles à l&apos;export PDF et PNG : pensez à les afficher si votre planning doit illustrer les contraintes calendaires à vos interlocuteurs.</Tip>
        </section>
      )}

      {show("calendrier") && show("historique") && <hr style={S.divider} />}

      {/* ── 12. Historique & Surveillance connexions ── */}
      {show("historique") && (
        <section style={S.section} id="historique">
          <h2 style={S.h2}><span style={S.pill}>12</span> Historique &amp; Surveillance connexions</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Journal d&apos;activité</dt>
              <dd style={S.dd}>Accédez à <strong>Historique</strong> depuis le rail de navigation. L&apos;onglet <strong>Activité</strong> liste les 200 dernières actions réalisées sur le planning (modifications de phases, jalons, membres, paramètres) avec la date, l&apos;auteur et la description de l&apos;action.</dd>
            </div>
            <div>
              <dt style={S.dt}>Surveillance des connexions</dt>
              <dd style={S.dd}>L&apos;onglet <strong>Connexions</strong> affiche l&apos;historique des connexions à l&apos;application : email, adresse IP, pays de connexion (avec drapeau), ville et type de navigateur. Chaque entrée est horodatée.</dd>
            </div>
            <div>
              <dt style={S.dt}>Alertes de sécurité</dt>
              <dd style={S.dd}>Toute connexion détectée depuis un pays autre que la France déclenche automatiquement un email d&apos;alerte à l&apos;administrateur (via Resend). Ces connexions sont signalées par un badge <strong>⚠ Alerte</strong> dans la colonne Pays du tableau.</dd>
            </div>
            <div>
              <dt style={S.dt}>Géolocalisation des connexions</dt>
              <dd style={S.dd}>La localisation (pays, ville) est déterminée à partir de l&apos;adresse IP via le service ip-api.com. Si la géolocalisation échoue (IP locale, VPN, erreur réseau), la ligne s&apos;affiche sans localisation.</dd>
            </div>
          </dl>
          <Tip>En cas de connexion suspecte depuis un pays inattendu, vérifiez l&apos;historique et changez le mot de passe du compte concerné. Les alertes sont envoyées à l&apos;adresse email configurée dans votre compte Resend.</Tip>
        </section>
      )}

      {show("historique") && show("securite") && <hr style={S.divider} />}

      {/* ── 13. Sécurité & Mot de passe ── */}
      {show("securite") && (
        <section style={S.section} id="securite">
          <h2 style={S.h2}><span style={S.pill}>13</span> Sécurité &amp; Mot de passe</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Connexion par email et mot de passe</dt>
              <dd style={S.dd}>L&apos;accès à Klint Planning se fait désormais avec votre <strong>adresse e-mail</strong> et un <strong>mot de passe</strong>. Aucun lien magique n&apos;est envoyé. Si vous vous connectez pour la première fois, utilisez le mot de passe temporaire communiqué par votre administrateur.</dd>
            </div>
            <div>
              <dt style={S.dt}>Changer son mot de passe</dt>
              <dd style={S.dd}>Allez dans <strong>Paramètres → onglet Sécurité</strong>. Saisissez votre mot de passe actuel, puis le nouveau mot de passe deux fois pour confirmation. Le nouveau mot de passe doit contenir <strong>au moins 8 caractères</strong>. Le changement est effectif immédiatement.</dd>
            </div>
            <div>
              <dt style={S.dt}>Mot de passe oublié</dt>
              <dd style={S.dd}>Contactez votre administrateur Klint Planning. Il pourra réinitialiser votre mot de passe via le script de migration ou directement en base de données. Il n&apos;existe pas de procédure automatique d&apos;envoi d&apos;email de réinitialisation.</dd>
            </div>
            <div>
              <dt style={S.dt}>Politique de sécurité recommandée</dt>
              <dd style={S.dd}>
                — Minimum 8 caractères<br />
                — Mélangez lettres, chiffres et symboles<br />
                — Ne réutilisez pas un mot de passe déjà utilisé sur un autre service<br />
                — Changez votre mot de passe temporaire dès la première connexion
              </dd>
            </div>
          </dl>
          <Tip>Après un changement de mot de passe, votre session reste active. La prochaine connexion (depuis un autre appareil ou après déconnexion) utilisera le nouveau mot de passe.</Tip>
        </section>
      )}

      {show("securite") && show("portefeuille") && <hr style={S.divider} />}

      {/* ── 14. Vue Portefeuille ── */}
      {show("portefeuille") && (
        <section style={S.section} id="portefeuille">
          <h2 style={S.h2}><span style={S.pill}>14</span> Vue Portefeuille</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Accéder au Portefeuille</dt>
              <dd style={S.dd}>Cliquez sur l&apos;icône <strong>grille</strong> (deuxième icône du rail, entre Plannings et Planning) pour ouvrir le tableau de bord consolidé. Il affiche tous vos plannings actifs en un coup d&apos;œil.</dd>
            </div>
            <div>
              <dt style={S.dt}>Cards de statut</dt>
              <dd style={S.dd}>
                Chaque planning est représenté par une card indiquant :<br />
                — <strong>Statut automatique</strong> : <em>En retard</em> (rouge) si une phase est dépassée ou un jalon n&apos;est pas encore marqué terminé ; <em>À risque</em> (orange) si un jalon arrive dans moins de 7 jours ; <em>Dans les temps</em> (vert) sinon.<br />
                — <strong>Barre de progression</strong> : moyenne de l&apos;avancement de toutes les phases du planning.<br />
                — <strong>Compteurs</strong> : nombre de phases, jalons, et phases en retard le cas échéant.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Jalons dépassés et à venir</dt>
              <dd style={S.dd}>Chaque card liste les jalons dont la date est dépassée (fond rouge, date en rouge) et les jalons prévus dans les 30 prochains jours. Cliquez sur <strong>Ouvrir le planning →</strong> pour naviguer directement vers le Gantt correspondant.</dd>
            </div>
            <div>
              <dt style={S.dt}>Filtres par statut</dt>
              <dd style={S.dd}>Les onglets <strong>Tous / En retard / À risque / Dans les temps</strong> filtrent les cards affichées. Le compteur dans chaque onglet indique combien de plannings correspondent.</dd>
            </div>
            <div>
              <dt style={S.dt}>Timeline globale</dt>
              <dd style={S.dd}>En bas de la page, la section <strong>Tous les jalons — 30 prochains jours</strong> liste l&apos;ensemble des jalons à venir sur tous vos plannings, triés par date, avec le nom du planning associé. Utile pour une revue hebdomadaire croisée avant un COPIL.</dd>
            </div>
          </dl>
          <Tip>Le statut d&apos;un planning est calculé à chaque chargement de la page. Il n&apos;existe pas de statut manuel : c&apos;est toujours le reflet des données réelles du planning.</Tip>
        </section>
      )}

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid var(--klint-line, #E6E8EE)", fontSize: 12, color: "#9CA3AF" }}>
        Klint Planning v1.0 — Jalons 0–16 · Klint Consulting © 2026
      </div>
    </div>
  );
}
