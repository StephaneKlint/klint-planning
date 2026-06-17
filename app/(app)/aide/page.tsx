/**
 * Page Aide — Guide de formation complet
 * Mode d'emploi détaillé de toutes les fonctionnalités Klint Planning
 */
"use client";

import { useState, useMemo } from "react";

const S = {
  page: {
    padding: "32px 40px 60px",
    fontFamily: "var(--font-display, system-ui)",
    color: "var(--klint-navy, #001036)",
    maxWidth: 760,
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
  h3: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--klint-navy)",
    marginTop: 20,
    marginBottom: 8,
    borderBottom: "1px solid var(--klint-line, #E6E8EE)",
    paddingBottom: 6,
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
  warn: {
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#92400E",
    marginTop: 8,
  } as React.CSSProperties,
  steps: {
    margin: "8px 0 0 0",
    paddingLeft: 20,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: "1.9",
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
  return <div style={S.tip}>&#x1F4A1; {children}</div>;
}

function Warn({ children }: { children: React.ReactNode }) {
  return <div style={S.warn}>&#x26A0;&#xFE0F; {children}</div>;
}

// ─── Section data for search matching ────────────────────────────────────────
interface SectionDef {
  id: string;
  num: string;
  title: string;
  keywords: string;
}

const SECTIONS: SectionDef[] = [
  { id: "plannings",    num: "1",  title: "Mes plannings",                       keywords: "plannings créer dupliquer archiver liste importer exporter json import export nouveau planning multi mono modele vide renommer supprimer corbeille restaurer soft delete template bibliothèque" },
  { id: "structure",    num: "2",  title: "Structure d'un planning",             keywords: "domaine lot sous-projet phase jalon hiérarchie structure organisation créer ajouter type cadrage dev développement recette formation personnalisé ordre réordonner" },
  { id: "gantt",        num: "3",  title: "Vue Gantt — navigation et affichage", keywords: "gantt domaine lot phase jalon navigation zoom coloration affichage filtrer période présence ajouter filtres vide empty état domaine créer supprimer tooltip survol dates stacking pile track hauteur week-end fermeture bandes baseline" },
  { id: "drag",         num: "4",  title: "Glisser-déposer (drag & drop)",       keywords: "drag drop glisser déposer déplacer phase jalon inter-lot horizontale verticale date resize redimensionner bord gauche droit annuler undo ctrl z fantôme ghost" },
  { id: "edit",         num: "5",  title: "Édition phases et jalons",            keywords: "éditer phase jalon dates statut avancement couleur note assigné responsable sélection multiple recherche palette commandes ctrl k fermer overlay dupliquer duplication copier" },
  { id: "bulkbar",      num: "6",  title: "Sélection multiple et actions groupées", keywords: "sélection multiple phases jalons bulkbar barre actions groupées ctrl clic multi select statut dupliquer vers lot confirmer désélectionner" },
  { id: "raccourcis",   num: "7",  title: "Raccourcis clavier",                  keywords: "raccourcis clavier ctrl k esc flèches zoom selection escape undo annuler ctrl z" },
  { id: "baseline",     num: "8",  title: "Plan de référence (Baseline)",        keywords: "baseline plan référence comparaison barre bleue dates décalées snapshot toggle afficher masquer créer supprimer" },
  { id: "share",        num: "9",  title: "Lien de partage (lecture seule)",     keywords: "partager partage lien url lecture seule share token public sans connexion révoquer copier bannière" },
  { id: "synthese",     num: "10", title: "Vue Synthèse",                        keywords: "synthèse kpi indicateurs jalons retard risque alertes avancement domaine collapsible ouvrir fermer sous-projets lots chips statuts J+30 J+60 J+90" },
  { id: "ressources",   num: "11", title: "Vue Ressources",                      keywords: "ressources membres responsables ajouter modifier supprimer attribution phases planning email initiales couleur picker existant" },
  { id: "portefeuille", num: "12", title: "Vue Portefeuille",                    keywords: "portefeuille dashboard multi-plannings vue globale consolidée jalons à venir dépassés retard risque filtre statut progression cards timeline cross-planning" },
  { id: "parametres",   num: "13", title: "Paramètres",                          keywords: "paramètres général cadence types phases jalons statuts membres droits apparence logo calendrier fermetures jours fériés modèle template" },
  { id: "logo",         num: "14", title: "Logo & Apparence",                    keywords: "logo apparence navbar png svg favicon changer enregistrer réinitialiser" },
  { id: "exports",      num: "15", title: "Exports (PDF, PNG, Excel, JSON)",     keywords: "pdf export a3 imprimer impression format paysage capture download télécharger png powerpoint excel xlsx json données visuels dropdown exporter" },
  { id: "presentation", num: "16", title: "Mode Présentation",                   keywords: "présentation plein écran fullscreen tout afficher fit-view zoom hauteur lignes capture export" },
  { id: "calendrier",   num: "17", title: "Fermetures & Jours fériés",           keywords: "fermetures jours fériés calendrier congés été hiver gel gel-code période custom bande colorée affichage toggle" },
  { id: "historique",   num: "18", title: "Historique & Surveillance connexions",keywords: "historique activité connexions surveillance sécurité alerte ip géolocalisation pays france email resend log" },
  { id: "securite",     num: "19", title: "Sécurité & Mot de passe",             keywords: "sécurité mot de passe connexion login credentials changer modifier oublié administrateur paramètres bcrypt" },
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
      <h1 style={S.h1}>Guide de formation — Klint Planning</h1>
      <p style={S.intro}>
        Mode d&apos;emploi complet de la solution. Chaque section détaille une fonctionnalité avec le contexte, les étapes et les bonnes pratiques. Utilisez la recherche pour trouver rapidement un sujet.
      </p>

      {/* ── Recherche ── */}
      <div style={S.searchWrap}>
        <span style={S.searchIcon}>&#128269;</span>
        <input
          style={S.searchInput}
          type="text"
          placeholder="Rechercher dans l&apos;aide… (ex. baseline, drag, duplication, PDF)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher dans l'aide"
        />
        {search && (
          <button style={S.searchClear} onClick={() => setSearch("")} aria-label="Effacer">&#215;</button>
        )}
      </div>

      {/* Table des matières */}
      {!search && (
        <div style={S.toc}>
          <p style={S.tocTitle}>Sommaire</p>
          <ul style={S.tocList}>
            {SECTIONS.map(({ id, num, title }) => (
              <li key={id}><a href={`#${id}`} style={S.tocItem}>{num}. {title}</a></li>
            ))}
          </ul>
        </div>
      )}

      {!hasResults && (
        <p style={S.noResult}>Aucune section pour &laquo; {search} &raquo;.</p>
      )}

      {/* ══════════════════════════════════════════════════════
          1. MES PLANNINGS
      ══════════════════════════════════════════════════════ */}
      {show("plannings") && (
        <section style={S.section} id="plannings">
          <h2 style={S.h2}><span style={S.pill}>1</span> Mes plannings</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            La page <strong>Plannings</strong> est le point d&apos;entrée de l&apos;application. Elle liste tous vos plannings actifs sous forme de cartes. Depuis cette page vous pouvez créer, dupliquer, exporter, archiver ou supprimer un planning.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Créer un planning vide</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>+ Nouveau planning</strong> puis choisissez <strong>Planning vide</strong>.<br />
                Renseignez : le <strong>nom</strong>, le <strong>type</strong> (Multi-projets pour plusieurs domaines ou Mono-projet pour un seul), l&apos;<strong>année de référence</strong> et les dates de début/fin.<br />
                Le planning s&apos;ouvre dans un état vide avec un message vous invitant à créer votre premier domaine.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Dupliquer un planning existant</dt>
              <dd style={S.dd}>
                Sur la carte d&apos;un planning, cliquez sur le bouton <strong>Dupliquer</strong>, ou passez par <strong>Nouveau planning → Dupliquer un planning existant</strong>.<br />
                Sélectionnez le planning source, personnalisez le nom, puis validez. La copie est complète : domaines, projets (lots), phases, jalons, paramètres et types. Les membres et l&apos;historique ne sont pas copiés.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Créer depuis un modèle (bibliothèque)</dt>
              <dd style={S.dd}>
                Choisissez <strong>Depuis un modèle</strong>. Sélectionnez un planning marqué comme modèle, indiquez la <strong>date de début souhaitée</strong> : toutes les phases et jalons sont automatiquement décalés pour conserver les durées et l&apos;espacement relatifs du modèle.<br />
                Un planning peut être marqué comme modèle dans <strong>Paramètres → Général → Utiliser comme modèle</strong>.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Renommer un planning</dt>
              <dd style={S.dd}>
                Sur la liste, cliquez sur le bouton <strong>&#9998;</strong> à droite du nom de la carte. Vous pouvez modifier le nom, l&apos;année et les dates, puis enregistrer.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Archiver un planning</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>Archive</strong> pour masquer le planning de la liste principale. Les données sont conservées. Vous pouvez désarchiver depuis la liste des plannings archivés.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer un planning (et la corbeille)</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>&#128465;</strong> sur la carte. La suppression est une <strong>suppression douce</strong> : le planning est mis à la corbeille et conservé pendant <strong>30 jours</strong>. L&apos;onglet <strong>Corbeille</strong> apparaît automatiquement sur la liste dès qu&apos;il contient au moins un planning.<br />
                Depuis la corbeille, vous pouvez :<br />
                — <strong>Restaurer</strong> : le planning revient dans la liste active.<br />
                — <strong>Supprimer définitivement</strong> : suppression irréversible de toutes les données.<br />
                Les plannings non restaurés après 30 jours sont supprimés automatiquement.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Importer un JSON</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>&#8593; Importer JSON</strong>. Deux options :<br />
                — <strong>Créer un nouveau planning</strong> : importe la structure complète comme planning indépendant.<br />
                — <strong>Mettre à jour un planning existant</strong> : met à jour les dates, statuts et notes des éléments identifiés par code domaine + nom lot + type et libellé. Les éléments non trouvés sont ajoutés. Aucune suppression.
              </dd>
            </div>
          </dl>
          <Tip>Pour un démarrage rapide sur un nouveau projet MCO, dupliquez un planning existant de même nature plutôt que de repartir de zéro. Vous gardez la structure des domaines, les types de jalons et la cadence configurée.</Tip>
        </section>
      )}

      {show("plannings") && show("structure") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          2. STRUCTURE D'UN PLANNING
      ══════════════════════════════════════════════════════ */}
      {show("structure") && (
        <section style={S.section} id="structure">
          <h2 style={S.h2}><span style={S.pill}>2</span> Structure d&apos;un planning</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            Un planning Klint s&apos;organise sur <strong>4 niveaux hiérarchiques</strong> : Domaine &#8594; Projet (lot) &#8594; Phase &#8594; Jalon. Cette structure reflète l&apos;organisation type d&apos;un projet CRM : les domaines regroupent des périmètres fonctionnels (Marketing, Service Client…), les projets sont les chantiers, les phases les étapes de travail, et les jalons les échéances clés.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Domaine</dt>
              <dd style={S.dd}>
                Regroupement de projets par périmètre métier ou technique (ex. &quot;Dynamics CRM&quot;, &quot;Marketing Cloud&quot;). Chaque domaine a une <strong>couleur unique</strong> visible en bande de fond sur le Gantt et une abréviation (code) générée automatiquement.<br />
                Pour créer le premier domaine : cliquez sur <strong>+ Créer un domaine</strong> dans le panneau latéral gauche (bouton visible sur l&apos;état vide ou en haut du panneau). Choisissez une couleur parmi les 8 palettes et saisissez le nom.<br />
                Pour <strong>éditer</strong> un domaine : cliquez sur son en-tête dans le panneau gauche.<br />
                Pour <strong>supprimer</strong> un domaine : ouvrez son panneau d&apos;édition, cliquez sur <strong>&#128465;</strong> dans le footer. La suppression efface également tous ses projets, phases et jalons.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Projet (lot)</dt>
              <dd style={S.dd}>
                Ligne de travail au sein d&apos;un domaine (ex. &quot;MCO S1 2026&quot;). Chaque projet apparaît sur une ligne dans le panneau gauche et dans la grille Gantt.<br />
                Pour créer un projet : cliquez sur <strong>+ Projet</strong> sous un domaine dans le panneau gauche.<br />
                Pour <strong>éditer</strong> un projet (nom, sous-titre) : cliquez sur la ligne dans le panneau gauche.<br />
                Pour <strong>réordonner</strong> : glissez les projets dans le panneau gauche.<br />
                Pour <strong>supprimer</strong> : ouvrez le panneau d&apos;édition, cliquez sur <strong>&#128465;</strong> dans le footer. Phases et jalons associés sont supprimés.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Phase</dt>
              <dd style={S.dd}>
                Barre temporelle représentant une étape de travail dans un projet (Cadrage, Développement, Recette, Formation…).<br />
                Pour créer une phase : depuis le panneau d&apos;édition d&apos;un projet, cliquez sur <strong>+ Phase</strong>. Choisissez le type, les dates de début et fin, puis enregistrez.<br />
                Plusieurs phases d&apos;un même projet peuvent se chevaucher dans le temps : elles s&apos;empilent automatiquement sur plusieurs lignes dans la même rangée du projet.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Jalon</dt>
              <dd style={S.dd}>
                Échéance ponctuelle représentée par un losange et un drapeau (ex. Livraison, PMEP, CAB, MEP).<br />
                Pour créer un jalon : depuis le panneau d&apos;édition d&apos;un projet, cliquez sur <strong>+ Jalon</strong>. Choisissez le type, la date, le libellé et la position du drapeau (au-dessus, en-dessous ou automatique).<br />
                Les jalons s&apos;affichent avec leur libellé en drapeau coloré. L&apos;algorithme de mise en page les répartit automatiquement pour éviter les chevauchements de libellés (maximum 3 niveaux de stacking).
              </dd>
            </div>
          </dl>
          <Tip>Pour un projet MCO typique, la séquence standard est : Cadrage &#8594; Développement &#8594; Recette &#8594; Formation &#8594; jalons Livraison / PMEP / CAB / MEP. La cadence des jalons (jours ouvrés entre chaque étape) se configure dans Paramètres &#8594; Cadence.</Tip>
        </section>
      )}

      {show("structure") && show("gantt") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          3. VUE GANTT
      ══════════════════════════════════════════════════════ */}
      {show("gantt") && (
        <section style={S.section} id="gantt">
          <h2 style={S.h2}><span style={S.pill}>3</span> Vue Gantt — Navigation et affichage</h2>

          <h3 style={S.h3}>Navigation temporelle</h3>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Défiler dans le temps</dt>
              <dd style={S.dd}>Faites défiler la timeline <strong>horizontalement</strong> avec la molette ou le trackpad. Le panneau gauche reste fixe.</dd>
            </div>
            <div>
              <dt style={S.dt}>Niveaux de zoom</dt>
              <dd style={S.dd}>
                Choisissez parmi <strong>1m · 3m · 6m · 12m</strong> dans la barre d&apos;outils. Le zoom 1m affiche les jours individuels, le 12m l&apos;année entière.<br />
                L&apos;en-tête de la timeline affiche <strong>trois lignes</strong> :<br />
                — <strong>Mois</strong> : le premier mois visible et chaque janvier incluent l&apos;année (ex. « Janv. 2026 »). Un léger fond marqué indique les frontières d&apos;année.<br />
                — <strong>Semaine</strong> : numéros ISO, libellé adaptatif selon la place (« Semaine 25 », « Sem. 25 » ou « S25 »).<br />
                — <strong>Jour</strong> : numéro du jour en 1m/3m ; date du lundi de la semaine en 6m/12m.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Aller à Aujourd&apos;hui</dt>
              <dd style={S.dd}>Cliquez sur <strong>Aujourd&apos;hui</strong> dans la barre d&apos;outils pour recentrer la timeline sur la date du jour (ligne rouge verticale).</dd>
            </div>
            <div>
              <dt style={S.dt}>Avancer / reculer d&apos;une période</dt>
              <dd style={S.dd}>Les boutons <strong>&#8249; &#8250;</strong> dans la barre d&apos;outils décalent la vue d&apos;une période entière (1 mois, 3 mois, etc. selon le zoom actif). Raccourcis : <Kbd>&#8592;</Kbd> et <Kbd>&#8594;</Kbd>.</dd>
            </div>
            <div>
              <dt style={S.dt}>Filtrer par période</dt>
              <dd style={S.dd}>Utilisez les champs <strong>Du … au …</strong> dans la barre d&apos;outils pour restreindre la plage affichée. Cliquez sur &#215; pour réinitialiser.</dd>
            </div>
          </dl>

          <h3 style={S.h3}>Affichage et coloration</h3>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Modes de coloration des phases</dt>
              <dd style={S.dd}>
                Le bouton de coloration dans la barre d&apos;outils bascule entre trois modes :<br />
                — <strong>Domaine</strong> : couleur propre à chaque domaine (défaut).<br />
                — <strong>Statut</strong> : la couleur reflète l&apos;état (Planifiée, En cours, Terminée, À risque, En retard…).<br />
                — <strong>Personne</strong> : la couleur correspond au premier responsable assigné.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Apparence visuelle des phases selon l&apos;état</dt>
              <dd style={S.dd}>
                Indépendamment du mode de coloration, les phases affichent un indicateur visuel de leur état d&apos;avancement :<br />
                — <strong>Phase terminée</strong> : fond strié (hachures diagonales) pour indiquer qu&apos;elle est clôturée.<br />
                — <strong>Phase non commencée</strong> : contour en pointillés (dashed) pour indiquer qu&apos;elle n&apos;a pas encore démarré.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Bandes de couleur de domaine</dt>
              <dd style={S.dd}>Activez ou désactivez les bandes de fond colorées dans <strong>Affichage &#8594; Bandes domaines</strong>. Utile pour alléger l&apos;affichage ou préparer l&apos;export.</dd>
            </div>
            <div>
              <dt style={S.dt}>Tooltip des dates d&apos;une phase</dt>
              <dd style={S.dd}>Survolez une phase dans le Gantt avec la souris : un tooltip apparaît avec le <strong>libellé</strong>, les <strong>dates de début et fin</strong> de la phase.</dd>
            </div>
            <div>
              <dt style={S.dt}>Phases empilées (stacking)</dt>
              <dd style={S.dd}>Quand plusieurs phases d&apos;un même projet se chevauchent dans le temps, elles s&apos;affichent sur des lignes superposées au sein de la rangée du projet. La hauteur de la rangée s&apos;adapte automatiquement.</dd>
            </div>
            <div>
              <dt style={S.dt}>Filtrer les projets visibles</dt>
              <dd style={S.dd}>Le bouton <strong>Projets</strong> ouvre le sélecteur de visibilité. Cochez ou décochez chaque lot pour l&apos;afficher ou le masquer. Utilisez <strong>Tout afficher / Tout masquer</strong> pour réinitialiser rapidement. Les lots masqués disparaissent du Gantt et des exports.</dd>
            </div>
            <div>
              <dt style={S.dt}>Présence des collaborateurs</dt>
              <dd style={S.dd}>Les avatars colorés en haut à droite indiquent les membres actuellement connectés sur ce planning (mise à jour toutes les 30 secondes).</dd>
            </div>
          </dl>
          <Tip>Sur un grand planning, combinez le filtre Projets (pour masquer les lots terminés) et le zoom 12m pour avoir une vue de synthèse propre avant un COPIL ou pour l&apos;export PDF.</Tip>
        </section>
      )}

      {show("gantt") && show("drag") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          4. DRAG & DROP
      ══════════════════════════════════════════════════════ */}
      {show("drag") && (
        <section style={S.section} id="drag">
          <h2 style={S.h2}><span style={S.pill}>4</span> Glisser-déposer (drag &amp; drop)</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            Le glisser-déposer permet de modifier les dates et l&apos;affectation des phases et jalons directement sur le Gantt, sans ouvrir de panneau d&apos;édition. Toutes les actions sont <strong>annulables</strong> avec <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd>.
          </p>

          <h3 style={S.h3}>Déplacer une phase</h3>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Déplacer horizontalement (décaler les dates)</dt>
              <dd style={S.dd}>
                Cliquez-glissez le <strong>corps de la phase</strong> (pas les bords) vers la gauche ou la droite. La phase entière se déplace, la durée est conservée. Les nouvelles dates s&apos;affichent en temps réel sous la phase pendant le glissement.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Modifier la date de début (redimensionner à gauche)</dt>
              <dd style={S.dd}>
                Positionnez le curseur sur le <strong>bord gauche</strong> de la phase (le curseur change). Glissez vers la gauche pour reculer la date de début, vers la droite pour l&apos;avancer.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Modifier la date de fin (redimensionner à droite)</dt>
              <dd style={S.dd}>
                Positionnez le curseur sur le <strong>bord droit</strong> de la phase. Glissez pour ajuster la date de fin.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Déplacer vers un autre projet (inter-lot)</dt>
              <dd style={S.dd}>
                Pendant le glissement, déplacez la souris <strong>verticalement</strong> vers la rangée d&apos;un autre projet. Une <strong>bande bleue en pointillés</strong> indique le projet cible. Relâchez pour rattacher la phase à ce projet. Les dates sont conservées.
              </dd>
            </div>
          </dl>

          <h3 style={S.h3}>Déplacer un jalon</h3>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Changer la date d&apos;un jalon</dt>
              <dd style={S.dd}>
                Cliquez-glissez le <strong>losange</strong> du jalon horizontalement. Un losange fantôme suit le curseur. Relâchez pour appliquer la nouvelle date.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Déplacer vers un autre projet</dt>
              <dd style={S.dd}>
                Glissez le jalon verticalement vers un autre projet pendant le déplacement. La bande bleue indique la cible.
              </dd>
            </div>
          </dl>

          <Warn>Le glisser-déposer ne fonctionne que si vous avez les droits d&apos;édition (<strong>Éditeur</strong> ou <strong>Propriétaire</strong>). Les Lecteurs voient le planning en lecture seule.</Warn>
          <Tip>Toutes les actions de glisser-déposer sont annulables : utilisez <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> immédiatement après un déplacement accidentel pour revenir à la position précédente.</Tip>
        </section>
      )}

      {show("drag") && show("edit") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          5. ÉDITION PHASES ET JALONS
      ══════════════════════════════════════════════════════ */}
      {show("edit") && (
        <section style={S.section} id="edit">
          <h2 style={S.h2}><span style={S.pill}>5</span> Édition des phases et jalons</h2>

          <h3 style={S.h3}>Panneau d&apos;édition d&apos;une phase</h3>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Ouvrir le panneau</dt>
              <dd style={S.dd}>Cliquez sur une phase dans le Gantt. Le panneau s&apos;ouvre à droite. Cliquez en dehors du panneau (sur la zone grisée) ou appuyez sur <Kbd>Esc</Kbd> pour le fermer.</dd>
            </div>
            <div>
              <dt style={S.dt}>Champs modifiables</dt>
              <dd style={S.dd}>
                — <strong>Type</strong> : catégorie de la phase (Cadrage, Développement, Recette, Formation, Personnalisé).<br />
                — <strong>Libellé</strong> : nom libre. Si vide, le type est affiché dans le Gantt.<br />
                — <strong>Dates de début et fin</strong> : modifiables via les champs date ou via le glisser-déposer dans le Gantt.<br />
                — <strong>Statut</strong> : Planifiée, En cours, En revue, Terminée, À risque, En retard.<br />
                — <strong>Avancement</strong> : pourcentage d&apos;avancement (0 – 100 %).<br />
                — <strong>Responsables</strong> : sélectionnez un ou plusieurs membres du planning.<br />
                — <strong>Note interne</strong> : champ libre pour les commentaires d&apos;équipe.<br />
                — <strong>Couleur personnalisée</strong> : surcharge la couleur du domaine pour cette phase uniquement.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Dupliquer une phase</dt>
              <dd style={S.dd}>
                Dans le footer du panneau d&apos;édition, cliquez sur <strong>Dupliquer</strong> (icône couches). Une section s&apos;ouvre pour choisir le projet cible. Sélectionnez le projet et confirmez. La phase dupliquée conserve le type, le libellé, les dates, le statut, l&apos;avancement et la note.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer une phase</dt>
              <dd style={S.dd}>Cliquez sur le bouton <strong>&#128465;</strong> dans le footer du panneau. Une confirmation est demandée.</dd>
            </div>
          </dl>

          <h3 style={S.h3}>Panneau d&apos;édition d&apos;un jalon</h3>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Ouvrir le panneau</dt>
              <dd style={S.dd}>Cliquez sur le <strong>drapeau</strong> (libellé coloré) ou sur le <strong>losange</strong> d&apos;un jalon dans le Gantt.</dd>
            </div>
            <div>
              <dt style={S.dt}>Champs modifiables</dt>
              <dd style={S.dd}>
                — <strong>Type</strong> : catégorie du jalon (Livraison, PMEP, CAB, MEP, etc. selon la configuration).<br />
                — <strong>Libellé</strong> : nom affiché sur le drapeau.<br />
                — <strong>Date</strong> : modifiable via le champ date ou via le drag du losange.<br />
                — <strong>Position du drapeau</strong> : Au-dessus, En-dessous ou Automatique.<br />
                — <strong>Couleur</strong> : surcharge la couleur du type de jalon.<br />
                — <strong>Note</strong> : champ libre.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Dupliquer un jalon</dt>
              <dd style={S.dd}>
                Dans le footer du panneau d&apos;édition, cliquez sur <strong>Dupliquer</strong>. Choisissez le projet cible dans la liste et confirmez. Utile pour les jalons MEP ou Livraison partagés entre plusieurs projets MCO liés.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer un jalon</dt>
              <dd style={S.dd}>Cliquez sur <strong>&#128465;</strong> dans le footer du panneau.</dd>
            </div>
          </dl>

          <h3 style={S.h3}>Palette de commandes (recherche rapide)</h3>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Ouvrir la palette</dt>
              <dd style={S.dd}>Appuyez sur <Kbd>&#8984;K</Kbd> (Mac) ou <Kbd>Ctrl+K</Kbd> (Windows). Une barre de recherche apparaît au centre de l&apos;écran.</dd>
            </div>
            <div>
              <dt style={S.dt}>Trouver une phase ou un jalon</dt>
              <dd style={S.dd}>Tapez une partie du libellé, du type ou du nom de projet. Cliquez sur le résultat pour ouvrir directement son panneau d&apos;édition et centrer la vue sur l&apos;élément dans le Gantt.</dd>
            </div>
          </dl>

          <Tip>Après toute modification, le Gantt se met à jour immédiatement. Les autres collaborateurs voient les changements dans les 10 secondes (polling automatique).</Tip>
        </section>
      )}

      {show("edit") && show("bulkbar") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          6. SÉLECTION MULTIPLE ET ACTIONS GROUPÉES
      ══════════════════════════════════════════════════════ */}
      {show("bulkbar") && (
        <section style={S.section} id="bulkbar">
          <h2 style={S.h2}><span style={S.pill}>6</span> Sélection multiple et actions group&#233;es</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            La BulkBar est la barre d&apos;actions flottante qui apparaît en bas de l&apos;écran dès que vous sélectionnez plusieurs phases et/ou jalons. Elle permet d&apos;effectuer des actions sur l&apos;ensemble de la sélection en une seule opération.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Sélectionner plusieurs phases</dt>
              <dd style={S.dd}>
                Maintenez <Kbd>&#8984;</Kbd> (Mac) ou <Kbd>Ctrl</Kbd> (Windows) et cliquez sur les phases dans le Gantt. Chaque phase sélectionnée s&apos;affiche avec un contour marqué. Les phases non sélectionnées sont légèrement atténuées.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Sélectionner plusieurs jalons</dt>
              <dd style={S.dd}>
                Maintenez <Kbd>&#8984;</Kbd> ou <Kbd>Ctrl</Kbd> et cliquez sur le <strong>drapeau</strong> ou le <strong>losange</strong> d&apos;un jalon. Le losange des jalons sélectionnés affiche un <strong>anneau bleu</strong>. Vous pouvez mélanger phases et jalons dans la même sélection.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Compteur de sélection</dt>
              <dd style={S.dd}>
                La BulkBar affiche le détail de la sélection :<br />
                — Phases seules : « 3 phases sélectionnées »<br />
                — Jalons seuls : « 2 jalons sélectionnés »<br />
                — Sélection mixte : « 3 phases + 2 jalons »
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Changer le statut (phases uniquement)</dt>
              <dd style={S.dd}>
                Si la sélection contient des phases, la section <strong>Statut</strong> propose les 6 statuts disponibles. Cliquez sur un statut pour l&apos;appliquer à toutes les phases sélectionnées simultanément.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Dupliquer vers un autre projet</dt>
              <dd style={S.dd}>
                La section <strong>Dupliquer vers :</strong> est toujours visible dans la BulkBar (phases et jalons). Sélectionnez le <strong>projet cible</strong> dans le menu déroulant, puis cliquez sur <strong>Confirmer</strong>. Toutes les phases et jalons sélectionnés sont dupliqués dans le projet cible en une seule opération.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Désélectionner</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>&#215; Désélectionner</strong> dans la BulkBar, ou cliquez sur une zone vide du Gantt. La BulkBar disparaît.
              </dd>
            </div>
          </dl>
          <Tip>Cas d&apos;usage typique MCO : des jalons MEP ou Livraison identiques entre plusieurs projets d&apos;un même domaine. Sélectionnez-les tous avec Ctrl+clic, puis dupliquez-les vers le nouveau projet en une seule action.</Tip>
        </section>
      )}

      {show("bulkbar") && show("raccourcis") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          7. RACCOURCIS CLAVIER
      ══════════════════════════════════════════════════════ */}
      {show("raccourcis") && (
        <section style={S.section} id="raccourcis">
          <h2 style={S.h2}><span style={S.pill}>7</span> Raccourcis clavier</h2>
          <table style={{ fontSize: 13, borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                <th style={{ textAlign: "left", padding: "4px 12px 8px 0", color: "#9CA3AF", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Raccourci</th>
                <th style={{ textAlign: "left", padding: "4px 0 8px", color: "#9CA3AF", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                [<><Kbd>&#8984;K</Kbd> / <Kbd>Ctrl+K</Kbd></>, "Ouvrir la palette de commandes (recherche rapide)"],
                [<><Kbd>&#8984;Z</Kbd> / <Kbd>Ctrl+Z</Kbd></>, "Annuler la dernière action (jusqu'à 30 niveaux)"],
                [<><Kbd>&#8984;</Kbd>+clic / <Kbd>Ctrl</Kbd>+clic</>, "Sélection multiple de phases ou jalons"],
                [<><Kbd>Esc</Kbd></>, "Fermer le panneau d'édition / la palette / la sélection"],
                [<><Kbd>&#8592;</Kbd> <Kbd>&#8594;</Kbd></>, "Période précédente / suivante (boutons ‹ ›)"],
                [<><Kbd>[</Kbd></>, "Masquer / afficher le panneau latéral gauche"],
                [<><Kbd>F</Kbd> (présentation)</>, "Activer / quitter le plein écran (vue Présentation)"],
              ].map(([shortcut, desc], i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
                  <td style={{ padding: "8px 12px 8px 0", whiteSpace: "nowrap" }}>{shortcut}</td>
                  <td style={{ padding: "8px 0", color: "#6B7280" }}>{desc as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {show("raccourcis") && show("baseline") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          8. BASELINE
      ══════════════════════════════════════════════════════ */}
      {show("baseline") && (
        <section style={S.section} id="baseline">
          <h2 style={S.h2}><span style={S.pill}>8</span> Plan de r&#233;f&#233;rence (Baseline)</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            La Baseline est un <strong>snapshot du planning à un instant T</strong>. Elle vous permet de comparer visuellement le planning actuel avec le plan initial : les phases dont les dates ont bougé depuis la baseline affichent une <strong>barre bleue</strong> en dessous d&apos;elles dans le Gantt.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Créer une baseline</dt>
              <dd style={S.dd}>
                Dans la barre d&apos;outils, cliquez sur <strong>Affichage &#8594; Baseline &#8594; Créer une baseline</strong>. L&apos;état de toutes les phases (dates de début et fin) est sauvegardé. Chaque planning ne peut avoir qu&apos;une seule baseline à la fois.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Afficher la comparaison</dt>
              <dd style={S.dd}>
                Activez le toggle <strong>Afficher la baseline</strong> dans Affichage. Les phases dont les dates ont été modifiées depuis la baseline affichent une <strong>barre bleue fine</strong> (4 px) juste en dessous. La position de cette barre indique l&apos;étendue des dates d&apos;origine.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Interpréter la barre bleue</dt>
              <dd style={S.dd}>
                — Barre bleue <strong>plus courte et décalée à gauche</strong> par rapport à la phase actuelle : la phase a été décalée et/ou allongée.<br />
                — Barre bleue <strong>plus longue</strong> : la phase a été raccourcie.<br />
                — <strong>Pas de barre</strong> : la phase n&apos;a pas bougé depuis la baseline.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer la baseline</dt>
              <dd style={S.dd}>Dans Affichage &#8594; Baseline &#8594; Supprimer la baseline. La suppression est définitive.</dd>
            </div>
          </dl>
          <Tip>Créez une baseline au moment du kick-off projet ou après validation du planning initial par le sponsor. Vous pourrez alors mesurer les glissements à tout moment en activant l&apos;affichage de la baseline lors des COPIL.</Tip>
        </section>
      )}

      {show("baseline") && show("share") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          9. LIEN DE PARTAGE
      ══════════════════════════════════════════════════════ */}
      {show("share") && (
        <section style={S.section} id="share">
          <h2 style={S.h2}><span style={S.pill}>9</span> Lien de partage (lecture seule)</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            Le lien de partage permet de donner accès à un planning en <strong>lecture seule sans connexion</strong> requise. Idéal pour partager avec des équipes externes, des clients ou des interlocuteurs métier qui n&apos;ont pas de compte Klint Planning.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Générer le lien</dt>
              <dd style={S.dd}>
                Dans la barre d&apos;outils, cliquez sur <strong>Partager</strong>. La modale génère un lien unique (URL). Cliquez sur <strong>Copier</strong> pour le copier dans le presse-papier.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Ce que voit le destinataire</dt>
              <dd style={S.dd}>
                L&apos;ouverture du lien affiche le Gantt complet du planning en lecture seule, avec une <strong>bannière bleue</strong> indiquant le mode consultation. Le destinataire peut naviguer (zoom, scroll), mais aucune modification n&apos;est possible. Aucune connexion ni création de compte n&apos;est nécessaire.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Révoquer le lien</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>Révoquer le lien</strong> dans la modale de partage. L&apos;URL précédente devient immédiatement invalide. Vous pouvez générer un nouveau lien à tout moment.
              </dd>
            </div>
          </dl>
          <Warn>Le lien de partage donne accès au planning sans authentification. Ne partagez pas ce lien avec des personnes extérieures si votre planning contient des informations confidentielles (noms de clients, budgets, données internes sensibles).</Warn>
        </section>
      )}

      {show("share") && show("synthese") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          10. VUE SYNTHÈSE
      ══════════════════════════════════════════════════════ */}
      {show("synthese") && (
        <section style={S.section} id="synthese">
          <h2 style={S.h2}><span style={S.pill}>10</span> Vue Synth&#232;se</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            La vue Synthèse donne une vue d&apos;ensemble de l&apos;état du planning sans afficher le Gantt. Elle est conçue pour les revues de pilotage, les points de suivi hebdomadaires et les présentations de statut.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Indicateurs KPI (en-tête)</dt>
              <dd style={S.dd}>Nombre total de phases par statut (Planifiées, En cours, Terminées, À risque, En retard), nombre de jalons et avancement global moyen.</dd>
            </div>
            <div>
              <dt style={S.dt}>Avancement par domaine — section interactive</dt>
              <dd style={S.dd}>
                Chaque domaine est affiché avec sa progression globale. Cliquez sur un domaine pour afficher (&#9660;) ou masquer (&#9658;) la liste de ses projets.<br />
                Chaque projet affiche sa barre de progression et des <strong>chips de statuts</strong> (nombre de phases dans chaque état).<br />
                Boutons <strong>Tout ouvrir / Tout fermer</strong> en haut de la section pour développer/replier en une action.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Jalons à horizon J+30 / J+60 / J+90</dt>
              <dd style={S.dd}>Trois colonnes listent les jalons dont la date est dans les 30, 60 ou 90 prochains jours, avec le nom du projet et le type de jalon.</dd>
            </div>
            <div>
              <dt style={S.dt}>Phases en retard et à risque</dt>
              <dd style={S.dd}>Les phases dépassées ou marquées &#171; À risque &#187; sont signalées en rouge/orange. Ces alertes servent de base pour les actions correctives en COPIL.</dd>
            </div>
          </dl>
        </section>
      )}

      {show("synthese") && show("ressources") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          11. VUE RESSOURCES
      ══════════════════════════════════════════════════════ */}
      {show("ressources") && (
        <section style={S.section} id="ressources">
          <h2 style={S.h2}><span style={S.pill}>11</span> Vue Ressources</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            La vue Ressources gère les membres du planning : chefs de projet, consultants, développeurs, testeurs. Une fois ajoutés, les membres peuvent être assignés aux phases dans le panneau d&apos;édition.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Ajouter un responsable</dt>
              <dd style={S.dd}>Cliquez sur <strong>+ Nouveau responsable</strong>. Renseignez le prénom, le nom, l&apos;email, les initiales (2 à 3 caractères) et choisissez une couleur d&apos;avatar. Enregistrez.</dd>
            </div>
            <div>
              <dt style={S.dt}>Modifier un membre</dt>
              <dd style={S.dd}>Cliquez sur <strong>&#9998;</strong> sur la ligne du membre. L&apos;email est affiché en lecture seule. Vous pouvez modifier le nom, les initiales et la couleur.</dd>
            </div>
            <div>
              <dt style={S.dt}>Supprimer un membre</dt>
              <dd style={S.dd}>Cliquez sur <strong>&#215;</strong> (confirmation requise). Les assignations existantes du membre sont supprimées. Cette action est annulable avec <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> depuis la vue Gantt.</dd>
            </div>
            <div>
              <dt style={S.dt}>Assigner un membre à une phase</dt>
              <dd style={S.dd}>Ouvrez le panneau d&apos;édition d&apos;une phase (clic sur la phase dans le Gantt), puis sélectionnez un ou plusieurs responsables dans la section <strong>Responsables</strong>. Les initiales s&apos;affichent dans la barre de phase si l&apos;affichage est activé (<strong>Affichage &#8594; Responsables</strong>).</dd>
            </div>
          </dl>
        </section>
      )}

      {show("ressources") && show("portefeuille") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          12. VUE PORTEFEUILLE
      ══════════════════════════════════════════════════════ */}
      {show("portefeuille") && (
        <section style={S.section} id="portefeuille">
          <h2 style={S.h2}><span style={S.pill}>12</span> Vue Portefeuille</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            La vue Portefeuille offre un tableau de bord consolidé de tous vos plannings actifs sur une seule page. Elle est conçue pour les responsables qui gèrent plusieurs projets en parallèle et ont besoin d&apos;une vision transversale avant un COPIL multi-projets.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Accéder au Portefeuille</dt>
              <dd style={S.dd}>Cliquez sur l&apos;icône <strong>grille</strong> dans le rail de navigation gauche (entre Plannings et le Gantt actif).</dd>
            </div>
            <div>
              <dt style={S.dt}>Cards de statut automatique</dt>
              <dd style={S.dd}>
                Chaque planning est représenté par une card. Le statut est calculé automatiquement :<br />
                — <strong>En retard</strong> (rouge) : une phase est dépassée sans être terminée, ou un jalon est passé.<br />
                — <strong>À risque</strong> (orange) : un jalon arrive dans moins de 7 jours.<br />
                — <strong>Dans les temps</strong> (vert) : aucun retard ni risque imminent.<br />
                Chaque card affiche aussi la barre de progression globale et le nombre de phases / jalons.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Jalons dépassés et à venir</dt>
              <dd style={S.dd}>Sur chaque card, les jalons passés sont signalés en rouge et les jalons dans les 30 prochains jours sont listés. Cliquez sur <strong>Ouvrir le planning &#8594;</strong> pour naviguer directement vers le Gantt.</dd>
            </div>
            <div>
              <dt style={S.dt}>Filtres par statut</dt>
              <dd style={S.dd}>Les onglets <strong>Tous / En retard / À risque / Dans les temps</strong> filtrent les cards. Le compteur dans chaque onglet indique combien de plannings correspondent.</dd>
            </div>
            <div>
              <dt style={S.dt}>Timeline globale 30 jours</dt>
              <dd style={S.dd}>En bas de page, la section liste tous les jalons à venir dans les 30 prochains jours sur l&apos;ensemble de vos plannings, triés par date, avec le nom du planning associé. Idéal pour préparer une revue hebdomadaire transverse.</dd>
            </div>
          </dl>
          <Tip>Le statut d&apos;un planning est calculé en temps réel à chaque chargement de la page — il reflète toujours l&apos;état réel des données, sans statut manuel à maintenir.</Tip>
        </section>
      )}

      {show("portefeuille") && show("parametres") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          13. PARAMÈTRES
      ══════════════════════════════════════════════════════ */}
      {show("parametres") && (
        <section style={S.section} id="parametres">
          <h2 style={S.h2}><span style={S.pill}>13</span> Param&#232;tres</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            Les Paramètres se configurent par planning. Si plusieurs plannings existent, des onglets de sélection apparaissent en haut de la page pour basculer entre eux.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Onglet Général</dt>
              <dd style={S.dd}>
                — <strong>Passage automatique en retard</strong> : active la détection automatique des phases dont la date de fin est dépassée sans être marquées terminées.<br />
                — <strong>Délai de clôture automatique</strong> : nombre de jours après la MEP au-delà duquel toutes les phases du lot passent automatiquement en &quot;Terminé&quot;.<br />
                — <strong>Utiliser comme modèle</strong> : marque ce planning comme modèle réutilisable lors de la création d&apos;un nouveau planning.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Cadence</dt>
              <dd style={S.dd}>
                Configure les délais en jours ouvrés entre la <strong>date de livraison dev</strong> et chaque type de jalon automatique (PMEP, CAB, MEP), domaine par domaine. Ces délais sont utilisés lors de la génération automatique des jalons à la création d&apos;un lot.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Onglets Types de phases / Jalons</dt>
              <dd style={S.dd}>Créez, renommez ou supprimez les types de phases (Cadrage, Développement, Recette…) et les types de jalons (Livraison, PMEP, CAB, MEP…) propres à ce planning.</dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Statuts</dt>
              <dd style={S.dd}>Consultez les 6 statuts disponibles et leur aperçu coloré. Les statuts ne sont pas personnalisables.</dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Membres &amp; Droits</dt>
              <dd style={S.dd}>
                Gérez les niveaux d&apos;accès des membres au planning :<br />
                — <strong>Propriétaire</strong> : accès total (création, modification, suppression, paramètres).<br />
                — <strong>Éditeur</strong> : peut modifier le contenu (phases, jalons, statuts) mais pas les paramètres globaux.<br />
                — <strong>Lecteur</strong> : consultation uniquement, aucune modification possible.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Apparence</dt>
              <dd style={S.dd}>Personnalisez le logo de l&apos;application. Voir la section <a href="#logo" style={{ color: "#3B82F6" }}>Logo &amp; Apparence</a>.</dd>
            </div>
            <div>
              <dt style={S.dt}>Onglet Fermetures / Jours fériés</dt>
              <dd style={S.dd}>Configurez les périodes de fermeture et les jours fériés. Voir la section <a href="#calendrier" style={{ color: "#3B82F6" }}>Fermetures &amp; Jours fériés</a>.</dd>
            </div>
          </dl>
        </section>
      )}

      {show("parametres") && show("logo") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          14. LOGO & APPARENCE
      ══════════════════════════════════════════════════════ */}
      {show("logo") && (
        <section style={S.section} id="logo">
          <h2 style={S.h2}><span style={S.pill}>14</span> Logo &amp; Apparence</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Changer le logo de la barre de navigation</dt>
              <dd style={S.dd}>
                Accédez à <strong>Paramètres &#8594; onglet Apparence</strong>. Cliquez sur <strong>Choisir un logo…</strong> et sélectionnez un fichier PNG, SVG, JPEG ou WebP (max 200 Ko). Un aperçu s&apos;affiche. Cliquez sur <strong>Enregistrer</strong> pour appliquer.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Format recommandé</dt>
              <dd style={S.dd}>SVG ou PNG carré (ratio 1:1) avec fond transparent. Le logo est redimensionné à 44 × 44 px dans la barre de navigation.</dd>
            </div>
            <div>
              <dt style={S.dt}>Réinitialiser</dt>
              <dd style={S.dd}>Cliquez sur <strong>Réinitialiser (logo Klint)</strong> pour revenir au logo Klint par défaut.</dd>
            </div>
          </dl>
          <Tip>Le logo est global à l&apos;application (pas spécifique à un planning). Il est visible immédiatement après enregistrement pour tous les utilisateurs connectés.</Tip>
        </section>
      )}

      {show("logo") && show("exports") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          15. EXPORTS
      ══════════════════════════════════════════════════════ */}
      {show("exports") && (
        <section style={S.section} id="exports">
          <h2 style={S.h2}><span style={S.pill}>15</span> Exports (PDF, PNG, Excel, JSON)</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            Tous les formats d&apos;export sont regroupés dans le bouton <strong>Exporter &#9660;</strong> de la barre d&apos;outils. Deux catégories : <strong>Visuels</strong> (PDF et PNG) et <strong>Données</strong> (Excel et JSON).
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Export PDF A3 paysage</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>Exporter &#8594; PDF A3 paysage</strong>. Une fenêtre d&apos;aperçu avant impression s&apos;ouvre. Cliquez sur <strong>Imprimer / Enregistrer en PDF</strong>. Format A3 paysage (420 &#215; 297 mm), résolution 1,5&#215;. Capture l&apos;intégralité du planning sans coupure.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Export PNG haute résolution (PowerPoint)</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>Exporter &#8594; PNG &#215;3 — PowerPoint</strong>. Le fichier est téléchargé directement (pas de fenêtre pop-up). Résolution triple (3&#215;) : optimisée pour insertion dans PowerPoint ou Keynote sans perte de qualité.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Export Excel .xlsx</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>Exporter &#8594; Excel .xlsx</strong>. Le fichier contient deux feuilles :<br />
                — <strong>Phases</strong> : domaine, lot, type, libellé, début, fin, durée, statut, avancement (%), responsables, note.<br />
                — <strong>Jalons</strong> : domaine, lot, type, libellé, date, note.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Export JSON</dt>
              <dd style={S.dd}>
                Cliquez sur <strong>Exporter &#8594; JSON</strong>. Télécharge la structure complète du planning (domaines, lots, phases, jalons, paramètres). Ce fichier peut être réimporté via <strong>&#8593; Importer JSON</strong> sur n&apos;importe quel autre planning.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Conseils pour un meilleur export</dt>
              <dd style={S.dd}>
                — Zoom <strong>12m</strong> pour capturer l&apos;année entière.<br />
                — Utilisez le filtre <strong>Projets</strong> pour masquer les lots non pertinents avant l&apos;export.<br />
                — Activez les <strong>bandes de fermeture</strong> si le planning doit illustrer les contraintes calendaires.<br />
                — Attendez que le Gantt soit entièrement chargé avant de lancer l&apos;export.
              </dd>
            </div>
          </dl>
          <Tip>Pour PowerPoint, préférez le PNG : il se télécharge directement et s&apos;insère en haute définition dans la diapositive. Le PDF est recommandé pour l&apos;impression physique A3.</Tip>
        </section>
      )}

      {show("exports") && show("presentation") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          16. MODE PRÉSENTATION
      ══════════════════════════════════════════════════════ */}
      {show("presentation") && (
        <section style={S.section} id="presentation">
          <h2 style={S.h2}><span style={S.pill}>16</span> Mode Pr&#233;sentation</h2>

          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
            Le mode Présentation est une vue optimisée pour projeter le Gantt en réunion ou en COPIL. Le panneau d&apos;édition est masqué, l&apos;interface est épurée.
          </p>

          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Accéder au mode Présentation</dt>
              <dd style={S.dd}>Cliquez sur l&apos;icône <strong>Présentation</strong> dans le rail de navigation (en bas). Le Gantt s&apos;affiche en lecture seule avec une barre de contrôle minimaliste.</dd>
            </div>
            <div>
              <dt style={S.dt}>Plein écran</dt>
              <dd style={S.dd}>Cliquez sur <strong>&#9633; Plein écran</strong> (ou appuyez sur <Kbd>F</Kbd>) pour passer en plein écran navigateur. Le fond passe en bleu marine. Appuyez à nouveau sur <Kbd>F</Kbd> ou cliquez sur <strong>&#8855; Quitter</strong> pour revenir.</dd>
            </div>
            <div>
              <dt style={S.dt}>Tout afficher — compression des lignes</dt>
              <dd style={S.dd}>Si le planning comporte de nombreux projets nécessitant un scroll vertical, cliquez sur <strong>&#8597; Tout afficher</strong> pour compresser automatiquement la hauteur des lignes afin que tout tienne sans scroll. Cliquez sur <strong>&#8597; Normal</strong> pour revenir.</dd>
            </div>
          </dl>
        </section>
      )}

      {show("presentation") && show("calendrier") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          17. FERMETURES & JOURS FÉRIÉS
      ══════════════════════════════════════════════════════ */}
      {show("calendrier") && (
        <section style={S.section} id="calendrier">
          <h2 style={S.h2}><span style={S.pill}>17</span> Fermetures &amp; Jours f&#233;ri&#233;s</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Configurer les périodes</dt>
              <dd style={S.dd}>
                Allez dans <strong>Paramètres &#8594; Fermetures / Jours fériés</strong>. Deux types :<br />
                — <strong>Jours fériés</strong> (<em>holiday</em>) : jours légaux ou conventionnels.<br />
                — <strong>Fermetures / Gel</strong> (<em>custom</em>) : congés d&apos;été, gel de fin d&apos;année, maintenance. Configurez le label, les dates et la couleur.
              </dd>
            </div>
            <div>
              <dt style={S.dt}>Afficher / masquer dans le Gantt</dt>
              <dd style={S.dd}>Dans la barre d&apos;outils, <strong>Affichage &#8594; Jours fériés</strong> et <strong>Fermetures / Gel</strong>. Les bandes colorées disparaissent ou réapparaissent instantanément. Chaque période peut aussi être désactivée individuellement dans les Paramètres.</dd>
            </div>
          </dl>
          <Tip>Les bandes de fermeture sont visibles à l&apos;export PDF et PNG. Pensez à les afficher si votre planning doit illustrer les contraintes calendaires à vos interlocuteurs.</Tip>
        </section>
      )}

      {show("calendrier") && show("historique") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          18. HISTORIQUE & SURVEILLANCE
      ══════════════════════════════════════════════════════ */}
      {show("historique") && (
        <section style={S.section} id="historique">
          <h2 style={S.h2}><span style={S.pill}>18</span> Historique &amp; Surveillance connexions</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Journal d&apos;activité</dt>
              <dd style={S.dd}>Accédez à <strong>Historique</strong> dans le rail. L&apos;onglet <strong>Activité</strong> liste les 200 dernières actions (modifications de phases, jalons, membres, paramètres) avec la date, l&apos;auteur et la description.</dd>
            </div>
            <div>
              <dt style={S.dt}>Surveillance des connexions</dt>
              <dd style={S.dd}>L&apos;onglet <strong>Connexions</strong> affiche l&apos;historique des connexions : email, IP, pays (drapeau), ville, navigateur, horodatage.</dd>
            </div>
            <div>
              <dt style={S.dt}>Alertes de sécurité</dt>
              <dd style={S.dd}>Toute connexion depuis un pays autre que la France déclenche un email d&apos;alerte à l&apos;administrateur. Ces connexions sont signalées par un badge <strong>&#9888; Alerte</strong> dans le tableau.</dd>
            </div>
          </dl>
        </section>
      )}

      {show("historique") && show("securite") && <hr style={S.divider} />}

      {/* ══════════════════════════════════════════════════════
          19. SÉCURITÉ & MOT DE PASSE
      ══════════════════════════════════════════════════════ */}
      {show("securite") && (
        <section style={S.section} id="securite">
          <h2 style={S.h2}><span style={S.pill}>19</span> S&#233;curit&#233; &amp; Mot de passe</h2>
          <dl style={S.dl}>
            <div>
              <dt style={S.dt}>Connexion</dt>
              <dd style={S.dd}>L&apos;accès se fait avec votre <strong>adresse e-mail</strong> et un <strong>mot de passe</strong>. Si vous vous connectez pour la première fois, utilisez le mot de passe temporaire communiqué par votre administrateur (<code>Klint2026!</code> par défaut).</dd>
            </div>
            <div>
              <dt style={S.dt}>Changer son mot de passe</dt>
              <dd style={S.dd}>Allez dans <strong>Paramètres &#8594; onglet Sécurité</strong>. Saisissez votre mot de passe actuel, puis le nouveau deux fois. Minimum 8 caractères. Le changement est immédiat.</dd>
            </div>
            <div>
              <dt style={S.dt}>Mot de passe oublié</dt>
              <dd style={S.dd}>Contactez votre administrateur Klint Planning. Il n&apos;existe pas de procédure automatique d&apos;envoi d&apos;email de réinitialisation.</dd>
            </div>
          </dl>
          <Warn>Changez le mot de passe temporaire dès votre première connexion. Ne réutilisez pas un mot de passe utilisé sur un autre service.</Warn>
        </section>
      )}

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid var(--klint-line, #E6E8EE)", fontSize: 12, color: "#9CA3AF" }}>
        Klint Planning v1.0 — Jalons 0&#8211;20 &#183; Klint Consulting &#169; 2026
      </div>
    </div>
  );
}
