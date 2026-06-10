/**
 * Page Aide — Guide utilisateur mode formation
 * Couvre l'ensemble des fonctionnalités (Jalons 0-6)
 */

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
    marginBottom: 36,
    borderBottom: "1px solid var(--klint-line, #E6E8EE)",
    paddingBottom: 20,
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

export default function AidePage() {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Guide utilisateur</h1>
      <p style={S.intro}>
        Bienvenue dans Klint Planning — votre outil de gestion Gantt collaboratif.
        Ce guide présente l&apos;ensemble des fonctionnalités disponibles.
      </p>

      {/* Table des matières */}
      <div style={S.toc}>
        <p style={S.tocTitle}>Sommaire</p>
        <ul style={S.tocList}>
          {[
            ["#plannings", "1. Mes plannings"],
            ["#gantt", "2. Vue Gantt"],
            ["#toolbar", "3. Barre d'outils"],
            ["#edit", "4. Édition"],
            ["#raccourcis", "5. Raccourcis"],
            ["#synthese", "6. Synthèse"],
            ["#ressources", "7. Ressources"],
            ["#parametres", "8. Paramètres"],
            ["#logo", "9. Logo & Apparence"],
            ["#pdf", "10. Export PDF A3"],
          ].map(([href, label]) => (
            <li key={href}>
              <a href={href} style={S.tocItem}>{label}</a>
            </li>
          ))}
        </ul>
      </div>

      {/* ── 1. Mes plannings ── */}
      <section style={S.section} id="plannings">
        <h2 style={S.h2}><span style={S.pill}>1</span> Mes plannings</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Accéder à la liste</dt>
            <dd style={S.dd}>
              Cliquez sur <strong>Plannings</strong> dans le rail de navigation gauche pour voir tous vos plannings actifs sous forme de cartes.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Créer un planning</dt>
            <dd style={S.dd}>
              Cliquez sur <strong>+ Nouveau planning</strong>. Choisissez le type :<br />
              — <strong>Multi-projets</strong> : plusieurs domaines et projets en parallèle (portefeuille, plan de transformation).<br />
              — <strong>Mono-projet</strong> : un seul projet avec ses phases (CRM, applicatif unique).
              <br />Renseignez le nom, l&apos;année et les dates de début/fin de la vue.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Dupliquer un planning</dt>
            <dd style={S.dd}>
              Depuis la liste, cliquez sur <strong>⧉ Dupliquer</strong>. Une copie complète est créée (domaines, lots, phases, jalons, paramètres) avec le suffixe « (copie) ». Vous êtes automatiquement redirigé vers le nouveau planning.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Archiver un planning</dt>
            <dd style={S.dd}>
              Cliquez sur <strong>Archive</strong> (bouton rouge au survol) pour masquer le planning de la liste. Les données sont conservées en base. L&apos;archivage est irréversible depuis l&apos;interface (réversible en base de données).
            </dd>
          </div>
        </dl>
      </section>

      <hr style={S.divider} />

      {/* ── 2. Vue Gantt ── */}
      <section style={S.section} id="gantt">
        <h2 style={S.h2}><span style={S.pill}>2</span> Vue Gantt</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Naviguer dans le temps</dt>
            <dd style={S.dd}>
              Faites défiler horizontalement avec la molette ou le trackpad. Utilisez les boutons <strong>‹ ›</strong> de la barre d&apos;outils pour avancer ou reculer d&apos;une période entière.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Niveaux de zoom</dt>
            <dd style={S.dd}>
              Choisissez parmi <strong>1m · 3m · 6m · 12m</strong> dans la barre d&apos;outils. Le zoom 12m affiche l&apos;année complète ; le zoom 1m permet de voir le détail semaine par semaine.
            </dd>
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
            <dd style={S.dd}>
              Cliquez sur <strong>Affichage</strong> dans la barre d&apos;outils pour activer/désactiver les bandes de couleur des domaines.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Filtrer par période</dt>
            <dd style={S.dd}>
              Utilisez les champs <strong>Du … au …</strong> dans la barre d&apos;outils pour restreindre la plage affichée. Une croix apparaît pour effacer le filtre.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Ajouter un domaine, un lot ou une phase</dt>
            <dd style={S.dd}>
              Dans le panneau gauche, survolez un titre de domaine : le bouton <strong>+</strong> apparaît pour ajouter un lot à ce domaine. Survolez un lot : le bouton <strong>+</strong> pointillé permet d&apos;ajouter une phase.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Présence des collaborateurs</dt>
            <dd style={S.dd}>
              Les avatars en haut à droite indiquent les membres connectés en temps réel (mis à jour toutes les 30 s).
            </dd>
          </div>
        </dl>
      </section>

      <hr style={S.divider} />

      {/* ── 3. Barre d'outils ── */}
      <section style={S.section} id="toolbar">
        <h2 style={S.h2}><span style={S.pill}>3</span> Barre d&apos;outils</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Masquer / afficher le panneau latéral</dt>
            <dd style={S.dd}>
              Le bouton <strong>couches</strong> (icône tout à gauche) réduit ou affiche le panneau gauche des domaines/lots. Utile pour maximiser la zone Gantt.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Aller à Aujourd&apos;hui</dt>
            <dd style={S.dd}>
              Cliquez sur <strong>Aujourd&apos;hui</strong> pour recentrer la vue sur la date du jour, indiquée par une ligne bleue verticale.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Export PDF A3</dt>
            <dd style={S.dd}>
              Cliquez sur <strong>PDF A3</strong> (bouton marine, en haut à droite). Le Gantt affiché est capturé et téléchargé en format A3 paysage.
              Voir la section <a href="#pdf" style={{ color: "#3B82F6" }}>Export PDF</a> pour les conseils.
            </dd>
          </div>
        </dl>
      </section>

      <hr style={S.divider} />

      {/* ── 4. Édition ── */}
      <section style={S.section} id="edit">
        <h2 style={S.h2}><span style={S.pill}>4</span> Édition des phases et jalons</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Éditer une phase</dt>
            <dd style={S.dd}>
              Cliquez sur une phase dans le Gantt pour ouvrir le panneau d&apos;édition à droite. Vous pouvez modifier le type, le libellé, les dates, le statut, l&apos;avancement, les responsables assignés et la note interne.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Éditer un jalon</dt>
            <dd style={S.dd}>
              Cliquez sur le drapeau ou le losange d&apos;un jalon dans le Gantt pour afficher ses détails dans le panneau d&apos;édition (type, date, couleur, note).
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Sélection multiple de phases</dt>
            <dd style={S.dd}>
              <Kbd>⌘</Kbd>+clic (Mac) ou <Kbd>Ctrl</Kbd>+clic (Windows) pour sélectionner plusieurs phases. La barre en bas de l&apos;écran permet de changer leur statut en une seule action.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Recherche rapide ⌘K</dt>
            <dd style={S.dd}>
              Appuyez sur <Kbd>⌘K</Kbd> (Mac) ou <Kbd>Ctrl+K</Kbd> (Windows) pour ouvrir la palette de commandes. Tapez le nom d&apos;un lot, d&apos;une phase ou d&apos;un jalon pour y accéder directement.
            </dd>
          </div>
        </dl>
        <Tip>
          Après toute modification, le Gantt se met à jour automatiquement. Les autres collaborateurs voient les changements dans les 10 secondes.
        </Tip>
      </section>

      <hr style={S.divider} />

      {/* ── 5. Raccourcis ── */}
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
              [<><Kbd>⌘</Kbd>+clic / <Kbd>Ctrl</Kbd>+clic</>, "Sélection multiple de phases"],
              [<><Kbd>[</Kbd></>, "Masquer / afficher le panneau latéral"],
              [<><Kbd>Esc</Kbd></>, "Fermer le panneau d'édition ou la palette"],
              [<><Kbd>←</Kbd> <Kbd>→</Kbd></>, "Période précédente / suivante (zoom < 12m)"],
            ].map(([shortcut, desc], i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                <td style={{ padding: "8px 12px 8px 0", whiteSpace: "nowrap" }}>{shortcut}</td>
                <td style={{ padding: "8px 0", color: "#6B7280" }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <hr style={S.divider} />

      {/* ── 6. Synthèse ── */}
      <section style={S.section} id="synthese">
        <h2 style={S.h2}><span style={S.pill}>6</span> Vue Synthèse</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Tableau de bord KPI</dt>
            <dd style={S.dd}>
              La vue Synthèse affiche des indicateurs clés : nombre de phases en cours, en retard, à risque, terminées. Des jauges d&apos;avancement par domaine sont également visibles.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Jalons à horizon J+30 / J+60 / J+90</dt>
            <dd style={S.dd}>
              Trois colonnes listent les jalons dont la date est dans les 30, 60 ou 90 prochains jours, pour anticiper les livrables à venir.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Alertes retard et risque</dt>
            <dd style={S.dd}>
              Les phases dont la date de fin est dépassée (statut « En retard ») ou marquées « À risque » apparaissent en rouge/orange avec leur domaine et leur responsable.
            </dd>
          </div>
        </dl>
      </section>

      <hr style={S.divider} />

      {/* ── 7. Ressources ── */}
      <section style={S.section} id="ressources">
        <h2 style={S.h2}><span style={S.pill}>7</span> Vue Ressources</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Liste des membres</dt>
            <dd style={S.dd}>
              La vue Ressources présente tous les membres du planning avec leurs initiales, leur couleur d&apos;avatar et leur email. Les phases qui leur sont assignées sont regroupées par domaine.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Ajouter un responsable</dt>
            <dd style={S.dd}>
              Cliquez sur <strong>+ Nouveau responsable</strong> en haut de la vue. Renseignez le nom, l&apos;email, les initiales et choisissez une couleur d&apos;avatar dans la palette.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Modifier ou supprimer un membre</dt>
            <dd style={S.dd}>
              Survolez la carte d&apos;un membre pour faire apparaître les boutons <strong>✎ Modifier</strong> et <strong>× Supprimer</strong>. La suppression est immédiate (confirmation requise).
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Multi-planning</dt>
            <dd style={S.dd}>
              Si vous gérez plusieurs plannings, des onglets de sélection apparaissent en haut de la page pour basculer entre eux sans recharger.
            </dd>
          </div>
        </dl>
      </section>

      <hr style={S.divider} />

      {/* ── 8. Paramètres ── */}
      <section style={S.section} id="parametres">
        <h2 style={S.h2}><span style={S.pill}>8</span> Paramètres</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Onglet Général</dt>
            <dd style={S.dd}>
              Consultez et modifiez les réglages du planning : passage automatique en retard, notification sur retard, délai de clôture automatique après mise en production.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Onglet Cadence</dt>
            <dd style={S.dd}>
              Configurez les délais en jours ouvrés entre la livraison et chaque type de jalon automatique (Livraison REC3, Pré-MEP, CAB, MEP), domaine par domaine.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Onglets Types de phases / Jalons</dt>
            <dd style={S.dd}>
              Créez, renommez ou supprimez les types de phases (ex. Cadrage, Développement, Recette) et les types de jalons (ex. Livraison, CAB, MEP) propres à ce planning.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Onglet Statuts</dt>
            <dd style={S.dd}>
              Consultez les statuts disponibles (Planifiée, En cours, En revue, Terminée, À risque, En retard) et leur aperçu coloré. L&apos;édition libre sera disponible dans une prochaine version.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Onglet Membres & Droits</dt>
            <dd style={S.dd}>
              Gérez les niveaux d&apos;accès de chaque membre à ce planning :<br />
              — <strong>Propriétaire</strong> : accès total, peut tout modifier.<br />
              — <strong>Éditeur</strong> : peut modifier le contenu (phases, jalons, membres).<br />
              — <strong>Lecteur</strong> : consultation uniquement, aucune modification.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Onglet Apparence</dt>
            <dd style={S.dd}>
              Personnalisez le logo affiché dans la barre de navigation. Voir la section <a href="#logo" style={{ color: "#3B82F6" }}>Logo &amp; Apparence</a>.
            </dd>
          </div>
        </dl>
        <Tip>
          Lorsque plusieurs plannings existent, des onglets de sélection apparaissent en haut des Paramètres pour basculer entre eux.
        </Tip>
      </section>

      <hr style={S.divider} />

      {/* ── 9. Logo ── */}
      <section style={S.section} id="logo">
        <h2 style={S.h2}><span style={S.pill}>9</span> Logo &amp; Apparence</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Changer le logo dans la barre de navigation</dt>
            <dd style={S.dd}>
              Accédez à <strong>Paramètres → onglet Apparence</strong>. Cliquez sur <strong>Choisir un logo…</strong> et sélectionnez un fichier PNG, SVG, JPEG ou WebP.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Format recommandé</dt>
            <dd style={S.dd}>
              SVG ou PNG carré (1:1) avec fond transparent. Taille maximale : <strong>200 Ko</strong>. Le logo est redimensionné automatiquement à 44 × 44 px dans le rail.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Enregistrer ou réinitialiser</dt>
            <dd style={S.dd}>
              Après avoir sélectionné un logo, cliquez sur <strong>Enregistrer</strong> pour l&apos;appliquer à tous les utilisateurs. Cliquez sur <strong>Réinitialiser (logo Klint)</strong> pour revenir au logo par défaut.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Portée du logo</dt>
            <dd style={S.dd}>
              Le logo est global à l&apos;application (pas par planning). Il est visible immédiatement après enregistrement pour tous les utilisateurs connectés.
            </dd>
          </div>
        </dl>
        <Tip>
          Le logo est stocké en base de données (encodage base64). Aucun serveur de fichiers n&apos;est requis. La taille de 200 Ko est suffisante pour un logo SVG ou PNG optimisé.
        </Tip>
      </section>

      <hr style={S.divider} />

      {/* ── 10. Export PDF ── */}
      <section style={S.section} id="pdf">
        <h2 style={S.h2}><span style={S.pill}>10</span> Export PDF A3</h2>
        <dl style={S.dl}>
          <div>
            <dt style={S.dt}>Lancer l&apos;export</dt>
            <dd style={S.dd}>
              Cliquez sur le bouton <strong>PDF A3</strong> (marine, en haut à droite de la barre d&apos;outils). Le message « Export… » s&apos;affiche pendant la génération. Le fichier se télécharge automatiquement au format <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>NomDuPlanning_planning_A3.pdf</code>.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Format du document</dt>
            <dd style={S.dd}>
              PDF A3 paysage (420 × 297 mm). La capture inclut l&apos;intégralité du Gantt affiché : panneau latéral + timeline, sur toute la hauteur et la largeur du contenu.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Conseils pour un meilleur résultat</dt>
            <dd style={S.dd}>
              — Sélectionnez le zoom <strong>12m</strong> pour avoir l&apos;année complète sur une page.<br />
              — Utilisez le filtre de dates pour restreindre la période si le planning est très long.<br />
              — Masquez le panneau latéral (bouton couches) si vous ne souhaitez capturer que la timeline.<br />
              — Attendez que le Gantt soit entièrement chargé avant de lancer l&apos;export.
            </dd>
          </div>
          <div>
            <dt style={S.dt}>Limites connues</dt>
            <dd style={S.dd}>
              L&apos;export est réalisé côté navigateur (pas de serveur). Sur des plannings très denses (&gt; 100 phases), l&apos;opération peut prendre quelques secondes. Si l&apos;export échoue, réduisez le zoom ou la période affichée.
            </dd>
          </div>
        </dl>
        <Tip>
          Pour imprimer en A3 : ouvrez le PDF, choisissez « Format A3 paysage », décochez « Ajuster à la page » et réglez les marges à zéro pour un rendu optimal.
        </Tip>
      </section>

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid var(--klint-line, #E6E8EE)", fontSize: 12, color: "#9CA3AF" }}>
        Klint Planning v1.0 — Jalons 0–6 · Klint Consulting © 2026
      </div>
    </div>
  );
}
