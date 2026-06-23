/**
 * Page Aide — Guide de formation complet
 * Navigation par sections (état React) avec sommaire en grille de cards.
 */
"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";

const S = {
  page: {
    padding: "32px 40px 60px",
    fontFamily: "var(--font-display, system-ui)",
    color: "var(--klint-navy, #001036)",
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
    margin: "8px 0 28px",
  } as React.CSSProperties,
  /* ── TOC card grid ── */
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 10,
    marginBottom: 48,
  } as React.CSSProperties,
  card: {
    background: "#FFFFFF",
    border: "1.5px solid var(--klint-line, #E6E8EE)",
    borderRadius: 12,
    padding: 0,
    overflow: "hidden" as const,
    textAlign: "left" as const,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    fontFamily: "var(--font-display, system-ui)",
    transition: "border-color 120ms, box-shadow 120ms, transform 120ms",
  } as React.CSSProperties,
  cardNum: {
    fontSize: 10,
    fontWeight: 700,
    color: "#9CA3AF",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--klint-navy, #001036)",
    lineHeight: "1.3",
  } as React.CSSProperties,
  /* ── Section view navigation ── */
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: "0 0 20px",
    fontFamily: "var(--font-display, system-ui)",
    letterSpacing: "0",
  } as React.CSSProperties,
  navRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 36,
    paddingTop: 20,
    borderTop: "1px solid var(--klint-line, #E6E8EE)",
    gap: 8,
  } as React.CSSProperties,
  navBtn: {
    background: "var(--klint-paper, #F6F7FB)",
    border: "1.5px solid var(--klint-line, #E6E8EE)",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--klint-navy, #001036)",
    cursor: "pointer",
    fontFamily: "var(--font-display, system-ui)",
    maxWidth: 230,
    lineHeight: "1.3",
  } as React.CSSProperties,
  navCount: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  } as React.CSSProperties,
  footer: {
    marginTop: 48,
    paddingTop: 20,
    borderTop: "1px solid var(--klint-line, #E6E8EE)",
    fontSize: 12,
    color: "#9CA3AF",
  } as React.CSSProperties,
  topNavRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    paddingBottom: 16,
    borderBottom: "1px solid var(--klint-line, #E6E8EE)",
    gap: 8,
  } as React.CSSProperties,
  topNavCenter: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748B",
    textAlign: "center" as const,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  topNavLink: {
    background: "var(--klint-paper, #F6F7FB)",
    border: "1.5px solid var(--klint-line, #E6E8EE)",
    borderRadius: 7,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--klint-navy, #001036)",
    cursor: "pointer",
    fontFamily: "var(--font-display, system-ui)",
    lineHeight: 1.3,
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    display: "block",
    flexShrink: 0,
  } as React.CSSProperties,
  topArrowBtn: {
    background: "var(--klint-paper, #F6F7FB)",
    border: "1.5px solid var(--klint-line, #E6E8EE)",
    borderRadius: 7,
    padding: "5px 11px",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--klint-navy, #001036)",
    cursor: "pointer",
    fontFamily: "var(--font-display, system-ui)",
    lineHeight: 1,
  } as React.CSSProperties,
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
/** Toolbar button chip — icon + label */
function TB({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F1F5F9", border: "1.5px solid #CBD5E1", borderRadius: 7, padding: "2px 9px 2px 6px", fontSize: 12, fontWeight: 700, color: "#0F172A", cursor: "default", verticalAlign: "middle", margin: "0 2px" }}>
      <span>{icon}</span>{children}
    </span>
  );
}
/** Inline UI element reference */
function UI({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline", background: "#EFF6FF", borderRadius: 5, padding: "1px 7px", fontSize: 12, fontWeight: 700, color: "#1D4ED8", border: "1px solid #BFDBFE", whiteSpace: "nowrap" as const }}>{children}</span>
  );
}
/** Numbered action step */
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
      <span style={{ minWidth: 24, height: 24, borderRadius: "50%", background: "#001D63", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>{n}</span>
      <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, paddingTop: 3 }}>{children}</span>
    </div>
  );
}
/** Steps group with title */
function How({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: "14px 0 20px 0" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#001D63", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.08em", opacity: 0.65 }}>{title}</div>
      {children}
    </div>
  );
}
/** Simulated UI capture */
function Mock({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#F8FAFC", border: "1.5px solid #CBD5E1", borderRadius: 10, overflow: "hidden" as const, margin: "16px 0" }}>
      {label && <div style={{ background: "#E2E8F0", padding: "5px 14px", fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.07em", textTransform: "uppercase" as const }}>{label}</div>}
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

interface SectionDef {
  id: string;
  num: string;
  title: string;
  emoji: string;
  keywords: string;
  minRole?: "admin"; // undefined = visible par tous les utilisateurs authentifiés
}

const SECTIONS: SectionDef[] = [
  { id: "plannings",    num: "1",  emoji: "📋", title: "Mes plannings",                       keywords: "plannings créer dupliquer archiver liste importer exporter json import export nouveau planning multi mono modele vide renommer supprimer corbeille restaurer soft delete template bibliothèque" },
  { id: "structure",    num: "2",  emoji: "🏗️", title: "Structure d'un planning",             keywords: "domaine lot sous-projet phase jalon hiérarchie structure organisation créer ajouter type cadrage dev développement recette formation personnalisé ordre réordonner" },
  { id: "gantt",        num: "3",  emoji: "📊", title: "Vue Gantt — navigation et affichage", keywords: "gantt domaine lot phase jalon navigation zoom coloration affichage filtrer période présence ajouter membre toolbar barre outils filtres vide empty état domaine créer supprimer tooltip survol dates stacking pile track hauteur week-end fermeture bandes baseline" },
  { id: "drag",         num: "4",  emoji: "🖱️", title: "Glisser-déposer (drag & drop)",       keywords: "drag drop glisser déposer déplacer phase jalon inter-lot horizontale verticale date resize redimensionner bord gauche droit annuler undo ctrl z fantôme ghost" },
  { id: "edit",         num: "5",  emoji: "✏️", title: "Édition phases et jalons",            keywords: "éditer phase jalon dates statut avancement couleur note assigné responsable sélection multiple recherche palette commandes ctrl k fermer overlay dupliquer duplication copier" },
  { id: "bulkbar",      num: "6",  emoji: "☑️", title: "Sélection multiple et actions groupées", keywords: "sélection multiple phases jalons bulkbar barre actions groupées ctrl clic multi select statut dupliquer vers lot confirmer désélectionner" },
  { id: "raccourcis",   num: "7",  emoji: "⌨️", title: "Raccourcis clavier",                  keywords: "raccourcis clavier ctrl k esc flèches zoom selection escape undo annuler ctrl z" },
  { id: "baseline",     num: "8",  emoji: "📌", title: "Plan de référence (Baseline)",        keywords: "baseline plan référence comparaison barre bleue dates décalées snapshot toggle afficher masquer créer supprimer" },
  { id: "share",        num: "9",  emoji: "🔗", title: "Lien de partage (lecture seule)",     keywords: "partager partage lien url lecture seule share token public sans connexion révoquer copier bannière" },
  { id: "synthese",     num: "10", emoji: "📈", title: "Vue Synthèse",                        keywords: "synthèse kpi indicateurs jalons retard risque alertes avancement domaine collapsible ouvrir fermer sous-projets lots chips statuts J+30 J+60 J+90" },
  { id: "ressources",   num: "11", emoji: "👥", title: "Vue Ressources",                      keywords: "ressources membres responsables ajouter modifier supprimer attribution phases planning email initiales couleur picker existant" },
  { id: "portefeuille", num: "12", emoji: "🗂️", title: "Vue Portefeuille",                    keywords: "portefeuille dashboard multi-plannings vue globale consolidée jalons à venir dépassés retard risque filtre statut progression cards timeline cross-planning" },
  { id: "parametres",   num: "13", emoji: "⚙️", title: "Paramètres",                          keywords: "paramètres général cadence types phases jalons statuts membres droits apparence logo calendrier fermetures jours fériés modèle template répertoire contacts ajouter rôle propriétaire éditeur lecteur inviter lien icônes" },
  { id: "logo",         num: "14", emoji: "🎨", title: "Logo & Apparence",                    keywords: "logo apparence navbar png svg favicon changer enregistrer réinitialiser",   minRole: "admin" },
  { id: "exports",      num: "15", emoji: "📥", title: "Exports (PDF, PNG, Excel, JSON)",     keywords: "pdf export a3 imprimer impression format paysage capture download télécharger png powerpoint excel xlsx json données visuels dropdown exporter" },
  { id: "presentation", num: "16", emoji: "🖥️", title: "Mode Présentation",                   keywords: "présentation plein écran fullscreen tout afficher fit-view zoom hauteur lignes capture export" },
  { id: "calendrier",   num: "17", emoji: "📅", title: "Fermetures & Jours fériés",           keywords: "fermetures jours fériés calendrier congés été hiver gel gel-code période custom bande colorée affichage toggle" },
  { id: "historique",   num: "18", emoji: "📜", title: "Historique & Surveillance connexions", keywords: "historique activité connexions surveillance sécurité alerte ip géolocalisation pays france email resend log",                                                                                                                             minRole: "admin" },
  { id: "securite",     num: "19", emoji: "🔒", title: "Sécurité & Mot de passe",             keywords: "sécurité mot de passe connexion login credentials changer modifier oublié administrateur paramètres bcrypt",                                                                                                                                   minRole: "admin" },
  { id: "droits",       num: "20", emoji: "🛡️", title: "Rôles & droits d'accès",               keywords: "rôles droits admin utilisateur contact propriétaire éditeur lecteur permissions crud accès matrice onglets plateforme planning membres inviter lien invitation ajouter gantt toolbar",                                                        minRole: "admin" },
];

/* ── Section bodies (module scope — purely static JSX) ──────────────────── */
const SECTION_BODIES: Record<string, React.ReactNode> = {

  plannings: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>1</span> Mes plannings</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Page d&apos;accueil de l&apos;application. Liste tous vos plannings actifs sous forme de cartes.
      </p>
      <Mock label="Carte planning">
        <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column" as const, gap: 8, maxWidth: 360 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#001036" }}>CCI Dynamics 2026</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>2026 · Multi-projets · Jan → Déc</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", borderRadius: 5, padding: "2px 8px", border: "1px solid #BFDBFE" }}>Actif</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
            {["🟦 Dynamics CRM", "🟩 Marketing Cloud", "🟧 Data"].map(d => (
              <span key={d} style={{ fontSize: 10, background: "#F1F5F9", borderRadius: 5, padding: "2px 7px", color: "#475569", fontWeight: 600 }}>{d}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, borderTop: "1px solid #F1F5F9", paddingTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 10px", color: "#334155", cursor: "default" }}>Dupliquer</span>
            <span style={{ fontSize: 11, fontWeight: 600, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 10px", color: "#334155", cursor: "default" }}>Archive</span>
            <span style={{ fontSize: 11, fontWeight: 600, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "3px 10px", color: "#DC2626", cursor: "default", marginLeft: "auto" }}>🗑</span>
          </div>
        </div>
      </Mock>
      <How title="Créer un planning vide">
        <Step n={1}>Cliquez sur <UI>+ Nouveau planning</UI>, puis choisissez <UI>Planning vide</UI>.</Step>
        <Step n={2}>Renseignez le <strong>nom</strong>, le <strong>type</strong> (Multi-projets ou Mono-projet), l&apos;<strong>année</strong> et les dates de début/fin.</Step>
        <Step n={3}>Validez — le planning s&apos;ouvre dans un état vide invitant à créer le premier domaine.</Step>
      </How>
      <How title="Dupliquer un planning">
        <Step n={1}>Sur la carte, cliquez sur <UI>Dupliquer</UI>, ou via <UI>Nouveau planning → Dupliquer un planning existant</UI>.</Step>
        <Step n={2}>Sélectionnez le planning source, personnalisez le nom et validez.</Step>
        <Step n={3}>La copie inclut : domaines, projets, phases, jalons, paramètres et types. <em>Les membres et l&apos;historique ne sont pas copiés.</em></Step>
      </How>
      <How title="Créer depuis un modèle">
        <Step n={1}>Choisissez <UI>Depuis un modèle</UI> dans le dialogue de création.</Step>
        <Step n={2}>Sélectionnez un planning marqué comme modèle et indiquez la <strong>date de début souhaitée</strong>.</Step>
        <Step n={3}>Toutes les phases et jalons sont décalés automatiquement en conservant les durées et espacements relatifs.</Step>
      </How>
      <How title="Archiver / Supprimer">
        <Step n={1}>Cliquez sur <UI>Archive</UI> pour masquer un planning (données conservées, désarchivable).</Step>
        <Step n={2}>Cliquez sur <UI>🗑</UI> pour mettre à la <strong>corbeille</strong> (suppression douce — 30 jours avant suppression définitive).</Step>
        <Step n={3}>L&apos;onglet <UI>Corbeille</UI> apparaît automatiquement. Depuis la corbeille : <UI>Restaurer</UI> ou <UI>Supprimer définitivement</UI>.</Step>
      </How>
      <How title="Importer un JSON">
        <Step n={1}>Cliquez sur <TB icon="⬆">Importer JSON</TB> en haut à droite de la liste.</Step>
        <Step n={2}>Choisissez <UI>Créer un nouveau planning</UI> (import complet) ou <UI>Mettre à jour un planning existant</UI> (met à jour les éléments matchés par code domaine + nom lot + type).</Step>
      </How>
      <Tip>Pour un démarrage rapide, dupliquez un planning existant de même nature — vous gardez la structure des domaines, les types de jalons et la cadence configurée.</Tip>
    </section>
  ),

  structure: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>2</span> Structure d&apos;un planning</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Un planning Klint s&apos;organise sur <strong>4 niveaux hiérarchiques</strong> : Domaine → Projet (lot) → Phase → Jalon.
      </p>
      <Mock label="Hiérarchie">
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {[
            { icon: "🟦", label: "Domaine", desc: "périmètre métier (ex. Dynamics CRM, Marketing Cloud)", indent: 0 },
            { icon: "📁", label: "Projet (lot)", desc: "chantier dans le domaine (ex. MCO S1 2026)", indent: 20 },
            { icon: "▬", label: "Phase", desc: "barre temporelle : Cadrage, Dev, Recette, Formation…", indent: 40 },
            { icon: "◆", label: "Jalon", desc: "échéance ponctuelle : Livraison, PMEP, CAB, MEP", indent: 40 },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: r.indent, fontSize: 13 }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <span style={{ fontWeight: 700, color: "#001D63", minWidth: 110 }}>{r.label}</span>
              <span style={{ color: "#6B7280" }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </Mock>
      <How title="Créer un domaine">
        <Step n={1}>Dans le panneau latéral gauche du Gantt, cliquez sur <UI>+ Créer un domaine</UI>.</Step>
        <Step n={2}>Choisissez une couleur parmi les 8 palettes et saisissez le nom.</Step>
        <Step n={3}>Pour <strong>éditer</strong> : cliquez sur son en-tête dans le panneau gauche. Pour <strong>supprimer</strong> : ouvrez l&apos;édition → cliquez sur 🗑 dans le footer <em>(efface aussi tous ses projets, phases et jalons)</em>.</Step>
      </How>
      <How title="Créer un projet (lot)">
        <Step n={1}>Sous un domaine dans le panneau gauche, cliquez sur <UI>+ Projet</UI>.</Step>
        <Step n={2}>Saisissez le nom et un sous-titre optionnel, puis enregistrez.</Step>
        <Step n={3}>Pour <strong>réordonner</strong> : glissez les projets dans le panneau gauche. Pour <strong>supprimer</strong> : ouvrez le panneau d&apos;édition du projet → 🗑.</Step>
      </How>
      <How title="Créer une phase">
        <Step n={1}>Cliquez sur la ligne d&apos;un projet dans le panneau gauche pour ouvrir son panneau d&apos;édition.</Step>
        <Step n={2}>Cliquez sur <UI>+ Phase</UI>, choisissez le type et les dates de début/fin, puis enregistrez.</Step>
        <Step n={3}>Plusieurs phases peuvent se chevaucher dans le temps — elles s&apos;empilent automatiquement sur plusieurs lignes.</Step>
      </How>
      <How title="Créer un jalon">
        <Step n={1}>Depuis le panneau d&apos;édition du projet, cliquez sur <UI>+ Jalon</UI>.</Step>
        <Step n={2}>Choisissez le type, la date, le libellé et la position du drapeau (Au-dessus / En-dessous / Auto).</Step>
      </How>
      <Tip>Séquence type MCO : Cadrage → Développement → Recette → Formation → jalons Livraison / PMEP / CAB / MEP. La cadence (jours ouvrés entre chaque jalon) se configure dans <strong>Paramètres → Cadence</strong>.</Tip>
    </section>
  ),

  gantt: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>3</span> Vue Gantt — Navigation et affichage</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Vue principale du planning. La barre d&apos;outils en haut regroupe toutes les commandes de navigation et d&apos;affichage.
      </p>
      <Mock label="Barre d'outils — navigation">
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, alignItems: "center" }}>
          <TB icon="◀">Préc.</TB>
          <TB icon="▶">Suiv.</TB>
          <TB icon="📅">Aujourd&apos;hui</TB>
          <TB icon="🔍">1m</TB>
          <TB icon="🔍">3m</TB>
          <TB icon="🔍">6m</TB>
          <TB icon="🔍">12m</TB>
          <TB icon="📅">Du … au …</TB>
        </div>
      </Mock>
      <How title="Naviguer dans le temps">
        <Step n={1}><strong>Défiler</strong> : molette ou trackpad horizontalement sur la timeline (le panneau gauche reste fixe).</Step>
        <Step n={2}><strong>Zoom</strong> : cliquez sur <TB icon="🔍">1m</TB> <TB icon="🔍">3m</TB> <TB icon="🔍">6m</TB> ou <TB icon="🔍">12m</TB> dans la barre d&apos;outils.</Step>
        <Step n={3}><strong>Aller à aujourd&apos;hui</strong> : cliquez sur <TB icon="📅">Aujourd&apos;hui</TB> pour recentrer sur la ligne rouge verticale (date du jour).</Step>
        <Step n={4}><strong>Avancer/reculer d&apos;une période</strong> : boutons <UI>‹</UI> et <UI>›</UI>, ou raccourcis <Kbd>←</Kbd> <Kbd>→</Kbd>.</Step>
        <Step n={5}><strong>Filtrer par période</strong> : renseignez les champs <UI>Du … au …</UI> dans la barre d&apos;outils. Cliquez <UI>×</UI> pour réinitialiser.</Step>
      </How>
      <Mock label="Barre d'outils — affichage & membres">
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, alignItems: "center" }}>
          <TB icon="⚙️">Affichage ▾</TB>
          <TB icon="🎨">Coloration ▾</TB>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "3px 8px" }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#001D63", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>AB</span>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#0F766E", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0, marginLeft: -8, border: "2px solid #fff" }}>CD</span>
            <span style={{ marginLeft: 4, fontSize: 13, fontWeight: 700, color: "#3B82F6" }}>+</span>
          </span>
          <TB icon="↩">Annuler</TB>
          <TB icon="📂">Projets ▾</TB>
          <TB icon="📥">Exporter ▾</TB>
          <TB icon="🔗">Partager</TB>
        </div>
      </Mock>
      <How title="Coloration des phases">
        <Step n={1}>Cliquez sur <TB icon="🎨">Coloration ▾</TB> et choisissez :</Step>
        <Step n={2}><strong>Domaine</strong> — couleur propre à chaque domaine (défaut). <strong>Statut</strong> — couleur selon l&apos;état (En cours, À risque…). <strong>Personne</strong> — couleur du premier responsable assigné.</Step>
      </How>
      <How title="Filtrer les projets visibles">
        <Step n={1}>Cliquez sur <TB icon="📂">Projets ▾</TB>.</Step>
        <Step n={2}>Cochez/décochez chaque lot. Utilisez <UI>Tout afficher</UI> / <UI>Tout masquer</UI> pour réinitialiser rapidement.</Step>
        <Step n={3}>Les lots masqués disparaissent du Gantt et des exports.</Step>
      </How>
      <How title="Options du menu Affichage">
        <Step n={1}>Cliquez sur <TB icon="⚙️">Affichage ▾</TB> pour accéder à :</Step>
        <Step n={2}><strong>Bandes domaines</strong> — fonds colorés. <strong>Week-ends</strong> — bandes grises. <strong>Jours fériés / Fermetures</strong> — bandes calendaires. <strong>Responsables</strong> — initiales sur les phases. <strong>Baseline</strong> — barres bleues comparatives.</Step>
      </How>
      <How title="Ajouter un membre depuis le Gantt">
        <Step n={1}>Dans la barre d&apos;outils, cliquez sur le bouton <UI>+</UI> situé à droite des avatars de présence.</Step>
        <Step n={2}>Dans la modale, recherchez un contact par <strong>nom</strong> ou <strong>email</strong> parmi les contacts du Répertoire non encore membres de ce planning.</Step>
        <Step n={3}>Sélectionnez le contact dans la liste, choisissez un rôle (<strong>Responsable planning</strong>, <strong>Contributeur</strong> ou <strong>Observateur</strong>), puis cliquez sur <UI>Ajouter</UI>.</Step>
        <Step n={4}>Le nouveau membre apparaît dans les avatars et dans l&apos;onglet <UI>Répertoire</UI> des Paramètres.</Step>
      </How>
      <Tip>Sur un grand planning : combinez <UI>Projets</UI> (masquer les lots terminés) + zoom 12m pour une vue synthèse propre avant un COPIL ou un export PDF.</Tip>
    </section>
  ),

  drag: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>4</span> Glisser-déposer (drag &amp; drop)</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Modifiez les dates et l&apos;affectation des phases et jalons directement sur le Gantt, sans ouvrir de panneau. Toutes les actions sont annulables avec <Kbd>Ctrl+Z</Kbd>.
      </p>
      <Mock label="Interactions disponibles sur les éléments">
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {/* Phase bar with handles */}
          <div style={{ position: "relative" as const, height: 32 }}>
            <div style={{ position: "absolute" as const, left: 30, width: 220, height: 26, top: 3, background: "linear-gradient(90deg,#3B82F6,#60A5FA)", borderRadius: 5, display: "flex", alignItems: "center" as const, justifyContent: "center" as const }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Développement — glisser pour déplacer</span>
            </div>
            {/* Left resize handle */}
            <div style={{ position: "absolute" as const, left: 29, top: 3, width: 7, height: 26, background: "#1D4ED8", borderRadius: "5px 0 0 5px", cursor: "ew-resize", display: "flex", alignItems: "center" as const, justifyContent: "center" as const }}>
              <span style={{ color: "#fff", fontSize: 8, lineHeight: 1 }}>◂</span>
            </div>
            {/* Right resize handle */}
            <div style={{ position: "absolute" as const, left: 243, top: 3, width: 7, height: 26, background: "#1D4ED8", borderRadius: "0 5px 5px 0", cursor: "ew-resize", display: "flex", alignItems: "center" as const, justifyContent: "center" as const }}>
              <span style={{ color: "#fff", fontSize: 8, lineHeight: 1 }}>▸</span>
            </div>
          </div>
          {/* Drop target indicator for inter-lot */}
          <div style={{ border: "2px dashed #3B82F6", borderRadius: 5, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "#3B82F6", background: "rgba(59,130,246,0.05)" }}>
            ↓ Dépôt inter-lot — bande bleue indiquant le projet cible
          </div>
          {/* Milestone ghost */}
          <div style={{ display: "flex", alignItems: "center" as const, gap: 10 }}>
            <div style={{ width: 16, height: 16, background: "#F59E0B", transform: "rotate(45deg)", opacity: 0.35, border: "2px dashed #D97706" }} />
            <span style={{ fontSize: 11, color: "#6B7280" }}>Jalon — losange fantôme lors du glissement</span>
          </div>
        </div>
      </Mock>
      <How title="Déplacer une phase (décaler les dates)">
        <Step n={1}>Pointez le <strong>corps</strong> de la phase (pas les bords) — le curseur devient une main.</Step>
        <Step n={2}>Cliquez-glissez horizontalement. Les nouvelles dates s&apos;affichent en temps réel sous la phase. La durée est conservée.</Step>
        <Step n={3}>Relâchez pour valider.</Step>
      </How>
      <How title="Redimensionner une phase (modifier les dates)">
        <Step n={1}>Pointez le <strong>bord gauche</strong> de la phase — le curseur change. Glissez pour modifier la <strong>date de début</strong>.</Step>
        <Step n={2}>Pointez le <strong>bord droit</strong> pour modifier la <strong>date de fin</strong>.</Step>
      </How>
      <How title="Déplacer vers un autre projet (inter-lot)">
        <Step n={1}>Commencez un glissement sur la phase.</Step>
        <Step n={2}>Déplacez la souris <strong>verticalement</strong> vers la rangée d&apos;un autre projet — une <strong>bande bleue en pointillés</strong> indique le projet cible.</Step>
        <Step n={3}>Relâchez pour rattacher la phase à ce projet. Les dates sont conservées.</Step>
      </How>
      <How title="Déplacer un jalon">
        <Step n={1}>Cliquez-glissez le <strong>losange</strong> du jalon horizontalement — un losange fantôme suit le curseur.</Step>
        <Step n={2}>Pour changer de projet : déplacez verticalement pendant le glissement (même bande bleue).</Step>
      </How>
      <Warn>Le drag &amp; drop nécessite les droits <strong>Contributeur</strong> ou <strong>Responsable planning</strong>. Les Observateurs voient le planning en lecture seule.</Warn>
      <Tip>Après un déplacement accidentel : appuyez immédiatement sur <Kbd>Ctrl+Z</Kbd> pour annuler.</Tip>
    </section>
  ),

  edit: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>5</span> Édition des phases et jalons</h2>
      <How title="Ouvrir le panneau d'édition d'une phase">
        <Step n={1}>Cliquez sur une phase dans le Gantt — le panneau s&apos;ouvre à droite de l&apos;écran.</Step>
        <Step n={2}>Fermez avec <Kbd>Esc</Kbd> ou en cliquant en dehors du panneau (zone grisée).</Step>
      </How>
      <Mock label="Panneau d'édition phase — champs disponibles">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 12 }}>
          {[
            ["Type", "Cadrage / Dev / Recette / Formation / Personnalisé"],
            ["Libellé", "Nom libre (si vide, le type est affiché dans le Gantt)"],
            ["Dates début/fin", "Champs date ou via drag sur le Gantt"],
            ["Statut", "Planifiée / En cours / En revue / Terminée / À risque / En retard"],
            ["Avancement", "0 – 100 %"],
            ["Responsables", "Membres du planning (multi-sélection)"],
            ["Note interne", "Champ texte libre"],
            ["Couleur", "Surcharge la couleur du domaine pour cette phase"],
          ].map(([k, v]) => (
            <div key={k as string}>
              <span style={{ fontWeight: 700, color: "#001D63" }}>{k}</span>
              <span style={{ color: "#6B7280", fontSize: 11, marginLeft: 6 }}>{v}</span>
            </div>
          ))}
        </div>
      </Mock>
      <How title="Dupliquer une phase">
        <Step n={1}>Dans le footer du panneau, cliquez sur <UI>Dupliquer</UI>.</Step>
        <Step n={2}>Sélectionnez le <strong>projet cible</strong> dans la liste et confirmez.</Step>
        <Step n={3}>La phase dupliquée conserve le type, libellé, dates, statut, avancement et note.</Step>
      </How>
      <How title="Supprimer une phase">
        <Step n={1}>Dans le footer du panneau, cliquez sur <UI>🗑</UI>. Une confirmation est demandée.</Step>
      </How>
      <How title="Éditer un jalon">
        <Step n={1}>Cliquez sur le <strong>drapeau</strong> (libellé coloré) ou le <strong>losange</strong> dans le Gantt.</Step>
        <Step n={2}>Champs disponibles : <strong>Type</strong>, <strong>Libellé</strong>, <strong>Date</strong>, <strong>Position drapeau</strong> (Au-dessus / En-dessous / Auto), <strong>Couleur</strong>, <strong>Note</strong>.</Step>
        <Step n={3}>Dupliquer : cliquez sur <UI>Dupliquer</UI> dans le footer → choisissez le projet cible. Utile pour les jalons MEP ou Livraison partagés entre plusieurs projets.</Step>
      </How>
      <How title="Palette de commandes (recherche rapide)">
        <Step n={1}>Appuyez sur <Kbd>⌘K</Kbd> (Mac) ou <Kbd>Ctrl+K</Kbd> (Windows) — une barre de recherche s&apos;ouvre au centre de l&apos;écran.</Step>
        <Step n={2}>Tapez un libellé, type ou nom de projet. Cliquez sur le résultat pour ouvrir le panneau et centrer la vue sur l&apos;élément dans le Gantt.</Step>
      </How>
      <Tip>Toute modification est enregistrée immédiatement. Les autres collaborateurs voient les changements dans les 10 secondes (polling automatique).</Tip>
    </section>
  ),

  bulkbar: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>6</span> Sélection multiple et actions group&#233;es</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        La <strong>BulkBar</strong> est la barre flottante qui apparaît en bas de l&apos;écran dès que vous sélectionnez plusieurs éléments.
      </p>
      <How title="Sélectionner plusieurs phases ou jalons">
        <Step n={1}>Maintenez <Kbd>⌘</Kbd> (Mac) ou <Kbd>Ctrl</Kbd> (Windows) et cliquez sur les phases dans le Gantt.</Step>
        <Step n={2}>Les phases sélectionnées affichent un contour marqué. Les jalons sélectionnés affichent un <strong>anneau bleu</strong>. Les autres éléments sont atténués.</Step>
        <Step n={3}>La BulkBar apparaît en bas avec le compteur : <em>« 3 phases + 2 jalons »</em>.</Step>
      </How>
      <Mock label="BulkBar — actions disponibles">
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, fontSize: 13 }}>
          <div><strong>Statut</strong> <span style={{ color: "#6B7280" }}>— changer le statut de toutes les phases sélectionnées en 1 clic (phases uniquement)</span></div>
          <div><strong>Dupliquer vers :</strong> <span style={{ color: "#6B7280" }}>— sélectionnez le projet cible → cliquez <UI>Confirmer</UI> pour copier toute la sélection</span></div>
          <div><UI>× Désélectionner</UI> <span style={{ color: "#6B7280" }}>— ou cliquez sur une zone vide du Gantt</span></div>
        </div>
      </Mock>
      <Tip>Cas typique MCO : sélectionnez plusieurs jalons MEP (Ctrl+clic) → dupliquez-les vers un nouveau projet en une seule action.</Tip>
    </section>
  ),

  raccourcis: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>7</span> Raccourcis clavier</h2>
      <table style={{ fontSize: 13, borderCollapse: "collapse" as const, width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
            <th style={{ textAlign: "left" as const, padding: "4px 12px 8px 0", color: "#9CA3AF", fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Raccourci</th>
            <th style={{ textAlign: "left" as const, padding: "4px 0 8px", color: "#9CA3AF", fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {([
            [<><Kbd>⌘K</Kbd> / <Kbd>Ctrl+K</Kbd></>, "Ouvrir la palette de commandes (recherche rapide)"],
            [<><Kbd>⌘Z</Kbd> / <Kbd>Ctrl+Z</Kbd></>, "Annuler la dernière action (jusqu'à 30 niveaux)"],
            [<><Kbd>⌘</Kbd>+clic / <Kbd>Ctrl</Kbd>+clic</>, "Sélection multiple de phases ou jalons"],
            [<><Kbd>Esc</Kbd></>, "Fermer panneau / palette / désélectionner"],
            [<><Kbd>←</Kbd> <Kbd>→</Kbd></>, "Période précédente / suivante"],
            [<><Kbd>[</Kbd></>, "Masquer / afficher le panneau latéral gauche"],
            [<><Kbd>F</Kbd> (présentation)</>, "Activer / quitter le plein écran"],
          ] as [React.ReactNode, string][]).map(([shortcut, desc], i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--klint-line, #E6E8EE)" }}>
              <td style={{ padding: "8px 12px 8px 0", whiteSpace: "nowrap" as const }}>{shortcut}</td>
              <td style={{ padding: "8px 0", color: "#6B7280" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  ),

  baseline: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>8</span> Plan de r&#233;f&#233;rence (Baseline)</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Snapshot du planning à un instant T. Les phases dont les dates ont bougé affichent une <strong>barre bleue fine</strong> en dessous, dans le Gantt.
      </p>
      <Mock label="Comparaison visuelle dans le Gantt">
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, fontSize: 12 }}>
          {/* Phase unchanged */}
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>Phase inchangée — pas de barre baseline</div>
            <div style={{ width: 180, height: 22, background: "#86EFAC", borderRadius: 5 }} />
          </div>
          {/* Phase delayed — baseline to the left */}
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>Phase décalée vers la droite — baseline (bleu) reste à sa position d&apos;origine</div>
            <div style={{ position: "relative" as const, height: 36 }}>
              <div style={{ position: "absolute" as const, left: 30, top: 0, width: 180, height: 22, background: "#FCD34D", borderRadius: 5, display: "flex", alignItems: "center" as const, paddingLeft: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#92400E" }}>Position actuelle</span>
              </div>
              <div style={{ position: "absolute" as const, left: 0, top: 26, width: 160, height: 4, background: "#3B82F6", borderRadius: 2, opacity: 0.8 }} />
            </div>
          </div>
          {/* Phase shortened */}
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>Phase raccourcie — baseline (bleu) plus longue</div>
            <div style={{ position: "relative" as const, height: 36 }}>
              <div style={{ position: "absolute" as const, left: 0, top: 0, width: 100, height: 22, background: "#A5B4FC", borderRadius: 5 }} />
              <div style={{ position: "absolute" as const, left: 0, top: 26, width: 180, height: 4, background: "#3B82F6", borderRadius: 2, opacity: 0.8 }} />
            </div>
          </div>
        </div>
      </Mock>
      <How title="Créer la baseline">
        <Step n={1}>Dans la barre d&apos;outils, cliquez sur <TB icon="⚙️">Affichage ▾</TB>.</Step>
        <Step n={2}>Sélectionnez <UI>Baseline → Créer une baseline</UI>. L&apos;état actuel de toutes les phases est sauvegardé. Un seul snapshot par planning.</Step>
      </How>
      <How title="Afficher et lire la comparaison">
        <Step n={1}>Dans <TB icon="⚙️">Affichage ▾</TB>, activez <UI>Afficher la baseline</UI>.</Step>
        <Step n={2}>Les phases dont les dates ont changé affichent une <strong>barre bleue (4 px)</strong> juste en dessous.</Step>
        <Step n={3}><strong>Barre plus courte décalée à gauche</strong> → phase décalée/allongée. <strong>Barre plus longue</strong> → phase raccourcie. <strong>Pas de barre</strong> → phase inchangée.</Step>
      </How>
      <How title="Supprimer la baseline">
        <Step n={1}><TB icon="⚙️">Affichage ▾</TB> → <UI>Baseline → Supprimer la baseline</UI>. La suppression est définitive.</Step>
      </How>
      <Tip>Créez la baseline au kick-off ou après validation du planning par le sponsor. Activez-la lors des COPIL pour mesurer les glissements d&apos;un coup d&apos;œil.</Tip>
    </section>
  ),

  share: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>9</span> Lien de partage (lecture seule)</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Donnez accès au planning en <strong>lecture seule sans connexion requise</strong>. Idéal pour les équipes externes ou interlocuteurs sans compte Klint Planning.
      </p>
      <Mock label="Modale de partage">
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, maxWidth: 380 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#001036" }}>Partager ce planning</div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, background: "#F1F5F9", border: "1.5px solid #CBD5E1", borderRadius: 7, padding: "7px 10px", fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>
              https://klint-planning.vercel.app/share/tok_…
            </div>
            <span style={{ background: "#001D63", color: "#fff", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "default", whiteSpace: "nowrap" as const }}>Copier</span>
          </div>
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 10, display: "flex", alignItems: "center" as const, justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#6B7280" }}>Lien actif depuis le 14/06/2026</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", cursor: "default", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "4px 10px" }}>Révoquer le lien</span>
          </div>
        </div>
      </Mock>
      <Mock label="Bannière lecture seule (vue du destinataire)">
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 7, padding: "8px 14px", display: "flex", alignItems: "center" as const, gap: 10 }}>
          <span style={{ fontSize: 16 }}>🔗</span>
          <span style={{ fontSize: 12, color: "#1D4ED8", fontWeight: 600 }}>Consultation uniquement — vous visualisez ce planning en lecture seule</span>
        </div>
      </Mock>
      <How title="Générer le lien">
        <Step n={1}>Dans la barre d&apos;outils, cliquez sur <TB icon="🔗">Partager</TB>.</Step>
        <Step n={2}>La modale génère un lien unique. Cliquez sur <UI>Copier</UI> pour le copier dans le presse-papier et le partager par email ou Slack.</Step>
      </How>
      <How title="Ce que voit le destinataire">
        <Step n={1}>L&apos;URL ouvre le Gantt complet avec une <strong>bannière bleue</strong> indiquant le mode consultation.</Step>
        <Step n={2}>Navigation possible (zoom, scroll) — aucune modification. Aucune connexion nécessaire.</Step>
      </How>
      <How title="Révoquer le lien">
        <Step n={1}>Dans la modale de partage, cliquez sur <UI>Révoquer le lien</UI>. L&apos;URL précédente devient immédiatement invalide.</Step>
        <Step n={2}>Vous pouvez générer un nouveau lien à tout moment.</Step>
      </How>
      <Warn>Ne partagez pas ce lien si votre planning contient des données confidentielles — il est accessible sans authentification.</Warn>
    </section>
  ),

  synthese: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>10</span> Vue Synth&#232;se</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Vue d&apos;ensemble de l&apos;état du planning, sans Gantt. Conçue pour les revues de pilotage et points de suivi.
      </p>
      <Mock label="Indicateurs KPI (en-tête)">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
          {["📋 Planifiées", "⏳ En cours", "✅ Terminées", "🔶 À risque", "🔴 En retard"].map((s) => (
            <div key={s} style={{ background: "#F1F5F9", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "#334155" }}>{s}</div>
          ))}
        </div>
      </Mock>
      <How title="Avancement par domaine">
        <Step n={1}>Chaque domaine affiche sa progression globale. Cliquez sur un domaine pour <strong>déplier ▼</strong> ou <strong>replier ▶</strong> la liste de ses projets.</Step>
        <Step n={2}>Chaque projet affiche sa barre de progression et des chips de statuts (nombre de phases par état).</Step>
        <Step n={3}>Cliquez sur <UI>Tout ouvrir</UI> / <UI>Tout fermer</UI> en haut de section pour déplier/replier en une action.</Step>
      </How>
      <How title="Jalons à horizon">
        <Step n={1}>Trois colonnes : <strong>J+30</strong>, <strong>J+60</strong>, <strong>J+90</strong> — jalons dans les 30 / 60 / 90 prochains jours avec le nom du projet et le type de jalon.</Step>
        <Step n={2}>Les phases en retard ou à risque sont signalées en rouge/orange → base pour les actions correctives en COPIL.</Step>
      </How>
    </section>
  ),

  ressources: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>11</span> Vue Ressources</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Gérez les membres du planning (chefs de projet, consultants, développeurs) et leur attribution aux phases. Les droits d&apos;accès se gèrent directement sur chaque carte.
      </p>
      <Mock label="Carte membre">
        <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column" as const, gap: 10, maxWidth: 340 }}>
          <div style={{ display: "flex", alignItems: "center" as const, gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1D4ED8", display: "flex", alignItems: "center" as const, justifyContent: "center" as const, color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>SD</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#001036" }}>Stéphane Durand</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>sdurand@klint-consulting.com</div>
            </div>
            <select style={{ fontSize: 11, fontWeight: 600, color: "#001036", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }} defaultValue="Contributeur">
              <option>Responsable planning</option>
              <option>Contributeur</option>
              <option>Observateur</option>
            </select>
          </div>
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 8, display: "flex", alignItems: "center" as const, justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#6B7280" }}>
              <span style={{ fontWeight: 700, color: "#374151" }}>8 phases ▼</span> assignées sur ce planning
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#3B82F6", cursor: "default" }}>Attribuer…</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
            {["Dynamics CRM · Cadrage", "Dynamics CRM · Développement", "Marketing Cloud · Recette"].map(p => (
              <div key={p} style={{ fontSize: 11, color: "#64748B", background: "#F8FAFC", borderRadius: 5, padding: "3px 8px", display: "flex", alignItems: "center" as const, gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "#3B82F6", flexShrink: 0, display: "inline-block" }} />
                {p}
              </div>
            ))}
          </div>
        </div>
      </Mock>
      <How title="Ajouter un responsable">
        <Step n={1}>Cliquez sur <TB icon="➕">Nouveau responsable</TB> en haut de la page.</Step>
        <Step n={2}>Choisissez un utilisateur existant dans la liste ou <UI>Créer un nouveau contact</UI>.</Step>
        <Step n={3}>Renseignez le nom, l&apos;email, les initiales (2–3 caractères) et une couleur d&apos;avatar. Enregistrez.</Step>
      </How>
      <How title="Attribuer des phases à un responsable">
        <Step n={1}>Sur la carte du membre, cliquez sur <TB icon="📋">Attribuer</TB>.</Step>
        <Step n={2}>La modale liste les phases par domaine et projet. Cochez chaque phase à attribuer, ou cliquez <UI>Tout le lot</UI> pour attribuer tout un projet en une action.</Step>
        <Step n={3}>Les initiales du responsable s&apos;affichent sur les phases dans le Gantt si l&apos;option est activée dans <TB icon="⚙️">Affichage ▾</TB> → <UI>Responsables</UI>.</Step>
      </How>
      <How title="Afficher / réduire les phases d'une carte">
        <Step n={1}>Cliquez sur le compteur de phases sur la carte (ex. <UI>12 phases ▲</UI>) pour réduire la liste et compacter l&apos;affichage.</Step>
        <Step n={2}>Cliquez à nouveau (<UI>12 phases ▼</UI>) pour afficher le détail des phases assignées.</Step>
      </How>
      <How title="Gérer les droits d'accès">
        <Step n={1}>Sur chaque carte membre, le menu déroulant <UI>Responsable planning / Contributeur / Observateur</UI> gère les droits d&apos;accès au planning.</Step>
        <Step n={2}><strong>Responsable planning</strong> : accès total. <strong>Contributeur</strong> : modifie le contenu (pas les paramètres). <strong>Observateur</strong> : consultation uniquement.</Step>
      </How>
      <Tip>Note : les membres sont propres à chaque planning. Un responsable doit être ajouté sur chaque planning où il intervient. Utilisez l&apos;<strong>Annuaire</strong> (icône personnes dans le rail) pour retrouver et réutiliser rapidement un responsable existant.</Tip>
    </section>
  ),

  portefeuille: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>12</span> Vue Portefeuille</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Tableau de bord consolidé de tous vos plannings actifs. Pour les responsables multi-projets qui ont besoin d&apos;une vision transversale avant un COPIL.
      </p>
      <How title="Accéder au Portefeuille">
        <Step n={1}>Cliquez sur l&apos;icône <strong>grille</strong> dans le rail de navigation gauche (entre <UI>Plannings</UI> et <UI>Gantt</UI>).</Step>
      </How>
      <Mock label="Statut automatique des cards">
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, fontSize: 13 }}>
          <div><span style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: 5, padding: "1px 8px", fontWeight: 700, fontSize: 12 }}>En retard</span> <span style={{ color: "#6B7280" }}>— une phase dépassée non terminée, ou un jalon passé</span></div>
          <div><span style={{ background: "#FEF3C7", color: "#D97706", borderRadius: 5, padding: "1px 8px", fontWeight: 700, fontSize: 12 }}>À risque</span> <span style={{ color: "#6B7280" }}>— un jalon dans moins de 7 jours</span></div>
          <div><span style={{ background: "#DCFCE7", color: "#16A34A", borderRadius: 5, padding: "1px 8px", fontWeight: 700, fontSize: 12 }}>Dans les temps</span> <span style={{ color: "#6B7280" }}>— aucun retard ni risque imminent</span></div>
        </div>
      </Mock>
      <How title="Utiliser le Portefeuille">
        <Step n={1}>Filtrez par onglet : <UI>Tous</UI> / <UI>En retard</UI> / <UI>À risque</UI> / <UI>Dans les temps</UI>. Chaque onglet indique le nombre de plannings correspondants.</Step>
        <Step n={2}>Chaque card affiche la barre de progression + jalons dépassés (rouge) + jalons dans les 30 prochains jours.</Step>
        <Step n={3}>Cliquez sur <UI>Ouvrir le planning →</UI> pour naviguer directement vers le Gantt.</Step>
        <Step n={4}>En bas de page, la <strong>timeline globale 30 jours</strong> liste tous les jalons à venir sur l&apos;ensemble de vos plannings, triés par date.</Step>
      </How>
      <Tip>Le statut est calculé en temps réel à chaque chargement — aucun statut manuel à maintenir.</Tip>
    </section>
  ),

  parametres: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>13</span> Param&#232;tres</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Configurés par planning. Si plusieurs plannings existent, des onglets de sélection apparaissent en haut de page pour basculer entre eux. Les onglets visibles dépendent de votre rôle (voir section 20).
      </p>
      <Mock label="Onglets disponibles (admin)">
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
          {["Général", "Cadence", "Types de phases", "Types de jalons", "Statuts", "Répertoire", "Historique", "Apparence", "Calendrier", "Sécurité", "Rôles & droits", "Logs erreurs"].map((t) => (
            <span key={t} style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, color: "#334155" }}>{t}</span>
          ))}
        </div>
      </Mock>
      <How title="Onglet Général">
        <Step n={1}><strong>Passage automatique en retard</strong> — détecte les phases dépassées non terminées et change leur statut automatiquement.</Step>
        <Step n={2}><strong>Délai de clôture automatique</strong> — nombre de jours après la MEP avant clôture automatique de toutes les phases du lot.</Step>
        <Step n={3}><strong>Utiliser comme modèle</strong> — marque ce planning comme réutilisable lors de la création d&apos;un nouveau planning.</Step>
      </How>
      <How title="Onglet Cadence">
        <Step n={1}>Configure les délais en jours ouvrés entre la <strong>date de livraison dev</strong> et chaque jalon automatique (PMEP, CAB, MEP), domaine par domaine.</Step>
        <Step n={2}>Ces délais sont utilisés lors de la génération automatique des jalons à la création d&apos;un lot.</Step>
      </How>
      <How title="Onglets Types de phases / Jalons">
        <Step n={1}>Créez, renommez ou supprimez les types de phases (Cadrage, Développement, Recette…) et de jalons (Livraison, PMEP, CAB, MEP…) propres à ce planning.</Step>
      </How>
      <How title="Onglet Répertoire (contacts & membres)">
        <Step n={1}>Liste tous les contacts de la plateforme avec leur rôle (Admin / Utilisateur / Contact), leur statut actif/inactif et leurs appartenance aux plannings.</Step>
        <Step n={2}>Chaque carte affiche une ligne d&apos;icônes harmonisées : <strong>crayon</strong> (modifier nom/initiales/couleur), <strong>+</strong> (ajouter au planning avec choix du rôle), <strong>×</strong> (retirer du planning actif), <strong>œil/barré</strong> (activer ou désactiver l&apos;accès), <strong>lien</strong> (générer un lien d&apos;invitation), <strong>corbeille</strong> (supprimer définitivement).</Step>
        <Step n={3}>Pour <strong>ajouter un contact au planning actif</strong> : cliquez sur <UI>+</UI> — un panneau s&apos;affiche directement sur la carte pour choisir le rôle (<strong>Responsable planning / Contributeur / Observateur</strong>), puis cliquer sur <UI>Ajouter</UI>.</Step>
        <Step n={4}>Pour <strong>changer le rôle d&apos;un membre existant</strong> : le menu déroulant Responsable planning / Contributeur / Observateur est affiché directement sur la carte, la modification est immédiate.</Step>
        <Step n={5}>Pour <strong>inviter un utilisateur ou admin</strong> : cliquez sur l&apos;icône de lien — un lien d&apos;accès valable 7 jours est généré. Copiez-le et transmettez-le par email.</Step>
      </How>
      <Tip>Vous pouvez aussi ajouter un membre directement depuis la vue <UI>Gantt</UI> via le bouton <UI>+</UI> dans la barre d&apos;outils (à côté des avatars), sans passer par les Paramètres.</Tip>
      <Tip>L&apos;onglet Répertoire est réservé aux admins par défaut. Un admin peut l&apos;activer pour les utilisateurs dans <UI>Rôles &amp; droits</UI>.</Tip>
    </section>
  ),

  logo: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>14</span> Logo &amp; Apparence</h2>
      <How title="Changer le logo de la barre de navigation">
        <Step n={1}>Allez dans <UI>Paramètres → onglet Apparence</UI>.</Step>
        <Step n={2}>Cliquez sur <UI>Choisir un logo…</UI> et sélectionnez un fichier PNG, SVG, JPEG ou WebP (max 200 Ko). Un aperçu s&apos;affiche.</Step>
        <Step n={3}>Cliquez sur <UI>Enregistrer</UI> — le logo est appliqué immédiatement pour tous les utilisateurs.</Step>
        <Step n={4}>Pour revenir au logo Klint par défaut : cliquez sur <UI>Réinitialiser (logo Klint)</UI>.</Step>
      </How>
      <Tip>Format recommandé : SVG ou PNG carré (ratio 1:1) avec fond transparent. Le logo est affiché à 44×44 px dans la barre de navigation.</Tip>
    </section>
  ),

  exports: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>15</span> Exports (PDF, PNG, Excel, JSON)</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Tous les formats d&apos;export sont regroupés dans le bouton <TB icon="📥">Exporter ▾</TB> de la barre d&apos;outils.
      </p>
      <Mock label="Menu Exporter ▾">
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Visuels</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>PDF A3 paysage</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Ouvre l&apos;aperçu impression du navigateur — A3 420×297 mm, résolution 1,5×</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🖼️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>PNG ×3 — PowerPoint</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Téléchargement direct, triple résolution — idéal pour insertion dans une diapositive</div>
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginTop: 4 }}>Données</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Excel .xlsx</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>2 feuilles : Phases (domaine, lot, type, libellé, dates, statut, avancement, responsables, note) + Jalons</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 20 }}>{"{ }"}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>JSON</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Structure complète (domaines, lots, phases, jalons, paramètres) — réimportable sur n&apos;importe quel planning</div>
            </div>
          </div>
        </div>
      </Mock>
      <How title="Conseils pour un bon export">
        <Step n={1}>Passez en zoom <TB icon="🔍">12m</TB> pour capturer l&apos;année entière.</Step>
        <Step n={2}>Utilisez <TB icon="📂">Projets ▾</TB> pour masquer les lots non pertinents.</Step>
        <Step n={3}>Activez les bandes de fermeture dans <TB icon="⚙️">Affichage ▾</TB> si le planning doit illustrer les contraintes calendaires.</Step>
        <Step n={4}>Attendez que le Gantt soit entièrement chargé avant de lancer l&apos;export.</Step>
      </How>
      <Tip>Pour PowerPoint : préférez le PNG (téléchargement direct, haute définition). Pour impression physique : utilisez le PDF A3.</Tip>
    </section>
  ),

  presentation: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>16</span> Mode Pr&#233;sentation</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Vue optimisée pour projeter le Gantt en réunion ou COPIL. Interface épurée, panneau d&apos;édition masqué.
      </p>
      <How title="Activer le mode Présentation">
        <Step n={1}>Cliquez sur l&apos;icône <strong>Présentation</strong> dans le rail de navigation (en bas à gauche). Le Gantt s&apos;affiche en lecture seule avec une barre de contrôle minimaliste.</Step>
      </How>
      <How title="Plein écran">
        <Step n={1}>Cliquez sur <UI>⬜ Plein écran</UI> ou appuyez sur <Kbd>F</Kbd> — le fond passe en bleu marine.</Step>
        <Step n={2}>Appuyez à nouveau sur <Kbd>F</Kbd> ou cliquez sur <UI>⊠ Quitter</UI> pour revenir.</Step>
      </How>
      <How title="Tout afficher (compression des lignes)">
        <Step n={1}>Si le planning nécessite un scroll vertical, cliquez sur <UI>↕ Tout afficher</UI> — la hauteur des lignes est compressée pour que tout tienne à l&apos;écran sans scroll.</Step>
        <Step n={2}>Cliquez sur <UI>↕ Normal</UI> pour revenir à la hauteur standard.</Step>
      </How>
    </section>
  ),

  calendrier: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>17</span> Fermetures &amp; Jours f&#233;ri&#233;s</h2>
      <How title="Configurer les périodes">
        <Step n={1}>Allez dans <UI>Paramètres → onglet Calendrier</UI>.</Step>
        <Step n={2}>Deux types : <strong>Jours fériés</strong> (jours légaux ou conventionnels) et <strong>Fermetures / Gel</strong> (congés d&apos;été, gel de fin d&apos;année, maintenance).</Step>
        <Step n={3}>Pour chaque période : renseignez le libellé, les dates de début/fin et une couleur d&apos;identification.</Step>
      </How>
      <How title="Afficher / masquer dans le Gantt">
        <Step n={1}>Dans la barre d&apos;outils, cliquez sur <TB icon="⚙️">Affichage ▾</TB>.</Step>
        <Step n={2}>Activez/désactivez <UI>Jours fériés</UI> et <UI>Fermetures / Gel</UI> — les bandes colorées disparaissent ou réapparaissent instantanément.</Step>
      </How>
      <Tip>Les bandes de fermeture sont visibles à l&apos;export PDF et PNG. Pensez à les afficher si votre planning doit illustrer les contraintes calendaires.</Tip>
    </section>
  ),

  historique: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>18</span> Historique &amp; Surveillance connexions</h2>
      <How title="Consulter le journal d'activité">
        <Step n={1}>Cliquez sur <UI>Historique</UI> dans le rail de navigation.</Step>
        <Step n={2}>L&apos;onglet <UI>Activité</UI> liste les 200 dernières actions (modifications de phases, jalons, membres, paramètres) avec la date, l&apos;auteur et la description.</Step>
      </How>
      <How title="Surveiller les connexions">
        <Step n={1}>Cliquez sur l&apos;onglet <UI>Connexions</UI>. Il affiche l&apos;historique : email, IP, pays (drapeau), ville, navigateur, horodatage.</Step>
        <Step n={2}>Toute connexion hors France déclenche un email d&apos;alerte à l&apos;administrateur et est signalée par un badge <span style={{ background: "#FEF3C7", color: "#D97706", borderRadius: 4, padding: "0 6px", fontSize: 12, fontWeight: 700 }}>⚠ Alerte</span>.</Step>
      </How>
    </section>
  ),

  droits: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>20</span> R&#244;les &amp; droits d&apos;acc&#232;s</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
        Klint Planning distingue deux niveaux de permissions : le <strong>rôle plateforme</strong> (qui peut se connecter et faire quoi globalement) et le <strong>rôle planning</strong> (ce que l&apos;on peut faire au sein d&apos;un planning précis).
      </p>

      <h3 style={S.h3}>Rôles plateforme</h3>
      <dl style={S.dl}>
        <div><dt style={S.dt}>Administrateur</dt><dd style={S.dd}>Accès complet à tout : tous les plannings, tous les onglets Paramètres, gestion des droits, suppression. Non limitable.</dd></div>
        <div><dt style={S.dt}>Utilisateur</dt><dd style={S.dd}>Accès aux plannings dont il est membre. Les onglets et actions disponibles dépendent de la matrice de droits configurée par l&apos;admin.</dd></div>
        <div><dt style={S.dt}>Contact</dt><dd style={S.dd}>Référencé dans le Répertoire mais sans accès à l&apos;application. Peut être ajouté comme responsable de phases/jalons.</dd></div>
      </dl>

      <h3 style={S.h3}>Rôles dans un planning</h3>
      <dl style={S.dl}>
        <div><dt style={S.dt}>Responsable planning</dt><dd style={S.dd}>Droits complets sur le planning : modifier les paramètres, archiver, gérer les membres, exporter, partager.</dd></div>
        <div><dt style={S.dt}>Contributeur</dt><dd style={S.dd}>Peut créer et modifier phases et jalons, dupliquer, exporter. Ne peut pas supprimer le planning ni gérer les membres.</dd></div>
        <div><dt style={S.dt}>Observateur</dt><dd style={S.dd}>Consultation uniquement. Peut exporter si l&apos;admin le permet.</dd></div>
      </dl>

      <How title="Configurer la matrice de droits (admin uniquement)">
        <Step n={1}>Allez dans <UI>Paramètres → onglet Rôles &amp; droits</UI>.</Step>
        <Step n={2}><strong>Tableau 1 — Accès plateforme</strong> : activez ou désactivez chaque fonctionnalité et chaque onglet Paramètres pour le rôle Utilisateur.</Step>
        <Step n={3}><strong>Tableaux 2-4 — Rôles planning</strong> : pour chaque action (modifier, archiver, supprimer, créer phases…), activez-la pour Responsable planning, Contributeur et/ou Observateur.</Step>
        <Step n={4}>Cliquez sur <UI>Enregistrer</UI> — la matrice est appliquée immédiatement pour tous les utilisateurs connectés.</Step>
      </How>

      <How title="Ajouter un membre depuis le Gantt">
        <Step n={1}>Depuis la vue <strong>Gantt</strong>, cliquez sur le bouton <UI>+</UI> dans la barre d&apos;outils (à droite des avatars de présence).</Step>
        <Step n={2}>La modale liste tous les contacts du Répertoire non encore membres de ce planning. Recherchez par nom ou email.</Step>
        <Step n={3}>Sélectionnez un contact, choisissez son rôle et cliquez <UI>Ajouter</UI>. Le membre est immédiatement actif sur le planning.</Step>
      </How>

      <How title="Inviter un utilisateur ou admin">
        <Step n={1}>Dans <UI>Paramètres → Répertoire</UI>, trouvez le contact (rôle Utilisateur ou Administrateur).</Step>
        <Step n={2}>Cliquez sur l&apos;icône de lien sur sa carte — un lien d&apos;invitation valable 7 jours est généré.</Step>
        <Step n={3}>Copiez le lien et transmettez-le par email. L&apos;invité clique sur le lien, choisit son mot de passe et se connecte.</Step>
      </How>

      <Tip>Les droits de la matrice sont appliqués en plus des rôles planning. Un Contributeur ne peut accéder à un onglet Paramètres désactivé pour les Utilisateurs que si l&apos;admin l&apos;active explicitement.</Tip>
      <Warn>Seul un Admin peut modifier la matrice de droits. Si vous ne voyez pas l&apos;onglet <UI>Rôles &amp; droits</UI>, demandez à votre administrateur.</Warn>
    </section>
  ),

  securite: (
    <section style={S.section}>
      <h2 style={S.h2}><span style={S.pill}>19</span> S&#233;curit&#233; &amp; Mot de passe</h2>
      <How title="Première connexion">
        <Step n={1}>Utilisez l&apos;email et le mot de passe temporaire communiqué par votre administrateur (<code>Klint2026!</code> par défaut).</Step>
        <Step n={2}>Changez ce mot de passe <strong>dès la première connexion</strong>.</Step>
      </How>
      <How title="Changer son mot de passe">
        <Step n={1}>Allez dans <UI>Paramètres → onglet Sécurité</UI>.</Step>
        <Step n={2}>Saisissez votre mot de passe actuel, puis le nouveau deux fois (minimum 8 caractères).</Step>
        <Step n={3}>Cliquez sur <UI>Changer le mot de passe</UI>. Le changement est immédiat.</Step>
      </How>
      <How title="Mot de passe oublié">
        <Step n={1}>Contactez votre administrateur Klint Planning. Il n&apos;existe pas de procédure automatique de réinitialisation par email.</Step>
      </How>
      <Warn>Ne réutilisez pas un mot de passe d&apos;un autre service. Changez le mot de passe temporaire dès la première connexion.</Warn>
    </section>
  ),

};

/* ── Section illustrations map ──────────────────────────────────────────── */
const SECTION_ILLUS: Record<string, { bg: string; el: React.ReactNode }> = {
  plannings: { bg: "linear-gradient(135deg,#3B82F6,#1D4ED8)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="6" width="22" height="14" rx="3" fill="rgba(255,255,255,0.25)"/><rect x="30" y="6" width="22" height="14" rx="3" fill="rgba(255,255,255,0.25)"/><rect x="56" y="6" width="18" height="14" rx="3" fill="rgba(255,255,255,0.18)"/><rect x="4" y="26" width="36" height="16" rx="3" fill="rgba(255,255,255,0.18)"/><rect x="44" y="26" width="30" height="16" rx="3" fill="rgba(255,255,255,0.15)"/><rect x="7" y="10" width="12" height="2" rx="1" fill="rgba(255,255,255,0.8)"/><rect x="7" y="14" width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.45)"/><rect x="33" y="10" width="10" height="2" rx="1" fill="rgba(255,255,255,0.8)"/><rect x="33" y="14" width="14" height="1.5" rx="0.75" fill="rgba(255,255,255,0.45)"/></svg> },
  structure: { bg: "linear-gradient(135deg,#0D9488,#0F766E)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><circle cx="40" cy="10" r="6" fill="rgba(255,255,255,0.9)"/><line x1="40" y1="16" x2="40" y2="22" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/><line x1="22" y1="22" x2="58" y2="22" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/><circle cx="22" cy="28" r="5" fill="rgba(255,255,255,0.75)"/><circle cx="40" cy="28" r="5" fill="rgba(255,255,255,0.75)"/><circle cx="58" cy="28" r="5" fill="rgba(255,255,255,0.75)"/><line x1="22" y1="33" x2="22" y2="39" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/><line x1="15" y1="39" x2="29" y2="39" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/><rect x="10" y="39" width="11" height="5" rx="1.5" fill="rgba(255,255,255,0.35)"/><rect x="23" y="39" width="11" height="5" rx="1.5" fill="rgba(255,255,255,0.35)"/></svg> },
  gantt: { bg: "linear-gradient(135deg,#6366F1,#4338CA)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="7" width="12" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="4" y="14" width="12" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="4" y="21" width="12" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="4" y="28" width="12" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="20" y="7" width="24" height="4" rx="1.5" fill="rgba(255,255,255,0.8)"/><rect x="20" y="14" width="16" height="4" rx="1.5" fill="rgba(255,255,255,0.65)"/><rect x="30" y="21" width="28" height="4" rx="1.5" fill="rgba(255,255,255,0.8)"/><rect x="40" y="28" width="20" height="4" rx="1.5" fill="rgba(255,255,255,0.55)"/><line x1="44" y1="4" x2="44" y2="38" stroke="rgba(255,220,50,0.85)" strokeWidth="1.5" strokeDasharray="3,2"/><rect x="61" y="12" width="7" height="7" rx="1" fill="rgba(255,255,255,0.9)" transform="rotate(45,64.5,15.5)"/></svg> },
  drag: { bg: "linear-gradient(135deg,#8B5CF6,#6D28D9)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="10" width="8" height="4" rx="1.5" fill="rgba(255,255,255,0.3)"/><rect x="4" y="19" width="8" height="4" rx="1.5" fill="rgba(255,255,255,0.3)"/><rect x="4" y="28" width="8" height="4" rx="1.5" fill="rgba(255,255,255,0.3)"/><rect x="18" y="17" width="32" height="8" rx="2.5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeDasharray="3,2"/><rect x="22" y="19" width="32" height="8" rx="2.5" fill="rgba(255,255,255,0.85)"/><circle cx="62" cy="22" r="5" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.7)" strokeWidth="1"/><rect x="59" y="21" width="6" height="1.5" rx="0.75" fill="rgba(255,255,255,0.9)"/><rect x="59" y="24" width="6" height="1.5" rx="0.75" fill="rgba(255,255,255,0.9)"/><path d="M58 8L68 8M65 5L68 8L65 11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M58 38L68 38M65 35L68 38L65 41" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  edit: { bg: "linear-gradient(135deg,#EC4899,#BE185D)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="8" y="4" width="50" height="42" rx="4" fill="rgba(255,255,255,0.15)"/><rect x="12" y="10" width="24" height="4" rx="1.5" fill="rgba(255,255,255,0.7)"/><rect x="12" y="18" width="36" height="4" rx="1.5" fill="rgba(255,255,255,0.45)"/><rect x="12" y="26" width="28" height="4" rx="1.5" fill="rgba(255,255,255,0.45)"/><rect x="12" y="34" width="20" height="4" rx="1.5" fill="rgba(255,255,255,0.3)"/><path d="M64 7L72 15L57 32L49 35L52 27Z" fill="rgba(255,255,255,0.85)"/><path d="M62 9L70 17" stroke="rgba(190,24,93,0.4)" strokeWidth="1.5"/></svg> },
  bulkbar: { bg: "linear-gradient(135deg,#F97316,#C2410C)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="8" y="9" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.85)"/><path d="M9.5 13L11 15L14.5 10.5" stroke="#F97316" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/><rect x="20" y="11" width="32" height="4" rx="1.5" fill="rgba(255,255,255,0.45)"/><rect x="8" y="21" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.85)"/><path d="M9.5 25L11 27L14.5 22.5" stroke="#F97316" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/><rect x="20" y="23" width="24" height="4" rx="1.5" fill="rgba(255,255,255,0.45)"/><rect x="8" y="33" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/><rect x="20" y="35" width="16" height="4" rx="1.5" fill="rgba(255,255,255,0.3)"/><rect x="4" y="44" width="68" height="5" rx="2.5" fill="rgba(255,255,255,0.2)"/><rect x="8" y="45.5" width="16" height="2" rx="1" fill="rgba(255,255,255,0.7)"/><rect x="28" y="45.5" width="20" height="2" rx="1" fill="rgba(255,255,255,0.5)"/></svg> },
  raccourcis: { bg: "linear-gradient(135deg,#475569,#1E293B)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="8" width="18" height="12" rx="2.5" fill="rgba(255,255,255,0.65)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/><text x="13" y="17.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#1E293B">⌘K</text><rect x="26" y="8" width="10" height="12" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/><rect x="40" y="8" width="10" height="12" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/><rect x="54" y="8" width="18" height="12" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/><rect x="4" y="24" width="12" height="12" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/><rect x="20" y="24" width="18" height="12" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/><rect x="42" y="24" width="14" height="12" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/><rect x="60" y="24" width="14" height="12" rx="2.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/><rect x="16" y="40" width="44" height="6" rx="3" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75"/></svg> },
  baseline: { bg: "linear-gradient(135deg,#2563EB,#1E40AF)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="4" width="10" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="18" y="10" width="32" height="7" rx="2" fill="rgba(255,255,255,0.8)"/><rect x="18" y="20" width="20" height="7" rx="2" fill="rgba(255,255,255,0.7)"/><rect x="18" y="30" width="38" height="7" rx="2" fill="rgba(255,255,255,0.75)"/><rect x="14" y="17" width="30" height="3" rx="1" fill="rgba(96,165,250,0.95)"/><rect x="18" y="27" width="26" height="3" rx="1" fill="rgba(96,165,250,0.95)"/><rect x="22" y="37" width="32" height="3" rx="1" fill="rgba(96,165,250,0.8)"/></svg> },
  share: { bg: "linear-gradient(135deg,#10B981,#047857)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="6" y="5" width="46" height="32" rx="4" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/><rect x="10" y="9" width="30" height="4" rx="1.5" fill="rgba(255,255,255,0.6)"/><rect x="10" y="16" width="20" height="3" rx="1" fill="rgba(255,255,255,0.4)"/><rect x="10" y="22" width="28" height="3" rx="1" fill="rgba(255,255,255,0.4)"/><rect x="10" y="29" width="16" height="3" rx="1" fill="rgba(255,255,255,0.3)"/><path d="M52 21L58 21M55 18L58 21L55 24" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><rect x="58" y="10" width="16" height="8" rx="3" fill="rgba(255,255,255,0.85)"/><path d="M62 14L70 14" stroke="#047857" strokeWidth="1.5" strokeLinecap="round"/><path d="M60 12Q58 14 60 16" stroke="#047857" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M72 12Q74 14 72 16" stroke="#047857" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="62" cy="32" r="4" fill="rgba(255,255,255,0.5)"/><circle cx="70" cy="32" r="4" fill="rgba(255,255,255,0.35)"/></svg> },
  synthese: { bg: "linear-gradient(135deg,#7C3AED,#5B21B6)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="4" width="20" height="8" rx="3" fill="rgba(255,255,255,0.8)"/><rect x="28" y="4" width="18" height="8" rx="3" fill="rgba(255,255,255,0.65)"/><rect x="50" y="4" width="24" height="8" rx="3" fill="rgba(255,255,255,0.5)"/><rect x="4" y="16" width="68" height="6" rx="2" fill="rgba(255,255,255,0.2)"/><rect x="4" y="16" width="44" height="6" rx="2" fill="rgba(255,255,255,0.75)"/><rect x="4" y="27" width="8" height="5" rx="1.5" fill="rgba(255,255,255,0.5)"/><rect x="16" y="27.5" width="40" height="4" rx="1.5" fill="rgba(255,255,255,0.25)"/><rect x="16" y="27.5" width="32" height="4" rx="1.5" fill="rgba(255,255,255,0.6)"/><rect x="4" y="36" width="8" height="5" rx="1.5" fill="rgba(255,255,255,0.5)"/><rect x="16" y="36.5" width="28" height="4" rx="1.5" fill="rgba(255,255,255,0.25)"/><rect x="16" y="36.5" width="20" height="4" rx="1.5" fill="rgba(255,255,255,0.55)"/></svg> },
  ressources: { bg: "linear-gradient(135deg,#E11D48,#9F1239)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="4" width="22" height="40" rx="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/><circle cx="15" cy="16" r="7" fill="rgba(255,255,255,0.85)"/><rect x="7" y="27" width="14" height="3" rx="1" fill="rgba(255,255,255,0.5)"/><rect x="9" y="33" width="10" height="2" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="29" y="4" width="22" height="40" rx="4" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/><circle cx="40" cy="16" r="7" fill="rgba(255,255,255,0.65)"/><rect x="32" y="27" width="14" height="3" rx="1" fill="rgba(255,255,255,0.4)"/><rect x="54" y="4" width="22" height="40" rx="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5"/><circle cx="65" cy="16" r="7" fill="rgba(255,255,255,0.4)"/><rect x="57" y="27" width="14" height="3" rx="1" fill="rgba(255,255,255,0.3)"/></svg> },
  portefeuille: { bg: "linear-gradient(135deg,#D97706,#92400E)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="10" y="28" width="62" height="18" rx="4" fill="rgba(255,255,255,0.12)"/><rect x="7" y="22" width="62" height="18" rx="4" fill="rgba(255,255,255,0.18)"/><rect x="4" y="5" width="62" height="25" rx="4" fill="rgba(255,255,255,0.25)"/><rect x="8" y="9" width="30" height="5" rx="2" fill="rgba(255,255,255,0.7)"/><rect x="8" y="17" width="18" height="4" rx="1.5" fill="rgba(255,255,255,0.5)"/><rect x="28" y="17" width="14" height="4" rx="1.5" fill="rgba(255,255,255,0.35)"/><circle cx="52" cy="11" r="3.5" fill="rgba(52,211,153,0.85)"/><circle cx="60" cy="11" r="3.5" fill="rgba(251,191,36,0.85)"/></svg> },
  parametres: { bg: "linear-gradient(135deg,#374151,#111827)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="4" width="18" height="7" rx="2" fill="rgba(255,255,255,0.7)"/><rect x="25" y="4" width="18" height="7" rx="2" fill="rgba(255,255,255,0.3)"/><rect x="46" y="4" width="18" height="7" rx="2" fill="rgba(255,255,255,0.2)"/><rect x="4" y="16" width="40" height="5" rx="1.5" fill="rgba(255,255,255,0.25)"/><rect x="52" y="16" width="18" height="5" rx="2.5" fill="rgba(99,102,241,0.8)"/><circle cx="68" cy="18.5" r="3" fill="rgba(255,255,255,0.9)"/><rect x="4" y="25" width="30" height="5" rx="1.5" fill="rgba(255,255,255,0.25)"/><rect x="42" y="25" width="18" height="5" rx="2.5" fill="rgba(255,255,255,0.2)"/><circle cx="44" cy="27.5" r="3" fill="rgba(255,255,255,0.7)"/><rect x="4" y="34" width="36" height="5" rx="1.5" fill="rgba(255,255,255,0.25)"/><rect x="48" y="34" width="18" height="5" rx="2.5" fill="rgba(255,255,255,0.2)"/><rect x="4" y="43" width="28" height="6" rx="3" fill="rgba(255,255,255,0.5)"/></svg> },
  logo: { bg: "linear-gradient(135deg,#C026D3,#86198F)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="14" y="5" width="36" height="28" rx="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/><rect x="19" y="10" width="26" height="18" rx="3" fill="rgba(255,255,255,0.2)"/><text x="26" y="24" fontSize="14" fontWeight="900" fill="rgba(255,255,255,0.9)">K</text><circle cx="18" cy="42" r="5" fill="rgba(248,113,113,0.8)"/><circle cx="32" cy="42" r="5" fill="rgba(74,222,128,0.8)"/><circle cx="46" cy="42" r="5" fill="rgba(96,165,250,0.8)"/><circle cx="60" cy="42" r="5" fill="rgba(250,204,21,0.8)"/></svg> },
  exports: { bg: "linear-gradient(135deg,#16A34A,#064E3B)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="16" y="3" width="30" height="38" rx="4" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/><path d="M33 3L46 16" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none"/><rect x="33" y="3" width="13" height="13" rx="0" fill="rgba(255,255,255,0.1)"/><rect x="21" y="20" width="20" height="2.5" rx="1" fill="rgba(255,255,255,0.55)"/><rect x="21" y="26" width="16" height="2.5" rx="1" fill="rgba(255,255,255,0.4)"/><rect x="21" y="32" width="18" height="2.5" rx="1" fill="rgba(255,255,255,0.4)"/><path d="M58 14L58 32M52 26L58 34L64 26" stroke="rgba(255,255,255,0.85)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/><rect x="52" y="36" width="12" height="2.5" rx="1" fill="rgba(255,255,255,0.7)"/></svg> },
  presentation: { bg: "linear-gradient(135deg,#1E3A8A,#0C1445)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="5" y="4" width="60" height="36" rx="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/><rect x="9" y="9" width="10" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="23" y="9" width="22" height="4" rx="1.5" fill="rgba(255,255,255,0.7)"/><rect x="9" y="17" width="10" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="19" y="17" width="16" height="4" rx="1.5" fill="rgba(255,255,255,0.55)"/><rect x="9" y="25" width="10" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="27" y="25" width="26" height="4" rx="1.5" fill="rgba(255,255,255,0.65)"/><path d="M8 6L5 6L5 10" stroke="rgba(96,165,250,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M62 6L65 6L65 10" stroke="rgba(96,165,250,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M8 38L5 38L5 34" stroke="rgba(96,165,250,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M62 38L65 38L65 34" stroke="rgba(96,165,250,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round"/><rect x="32" y="40" width="6" height="5" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="26" y="45" width="18" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/></svg> },
  calendrier: { bg: "linear-gradient(135deg,#0284C7,#075985)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="8" y="5" width="58" height="40" rx="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/><rect x="8" y="5" width="58" height="13" rx="4" fill="rgba(255,255,255,0.25)"/><rect x="8" y="14" width="58" height="4" rx="0" fill="rgba(255,255,255,0.1)"/>{[0,1,2,3,4,5,6].map((col)=>[0,1,2,3].map((row)=>{const isH=col===2&&row===1;const isC=(col===5||col===6)&&row<3;return <rect key={`${col}-${row}`} x={11+col*8} y={20+row*7} width={6} height={5} rx={1} fill={isH?"rgba(255,220,50,0.9)":isC?"rgba(255,100,100,0.3)":"rgba(255,255,255,0.25)"}/>;}))}</svg> },
  historique: { bg: "linear-gradient(135deg,#B45309,#78350F)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><line x1="18" y1="4" x2="18" y2="46" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>{[8,16,24,32,40].map((y,i)=><g key={y}><circle cx="18" cy={y} r="4" fill={i===0?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.55)"}/><rect x="26" y={y-3} width={[30,22,28,20,26][i]} height="6" rx="2" fill="rgba(255,255,255,0.18)"/><rect x="26" y={y-2} width={[18,12,20,10,16][i]} height="2.5" rx="1" fill="rgba(255,255,255,0.6)"/></g>)}<rect x="55" y="10" width="18" height="8" rx="3" fill="rgba(255,220,50,0.4)"/><rect x="57" y="13" width="14" height="2.5" rx="1" fill="rgba(255,255,255,0.6)"/></svg> },
  securite: { bg: "linear-gradient(135deg,#DC2626,#991B1B)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="26" y="22" width="28" height="24" rx="5" fill="rgba(255,255,255,0.8)"/><path d="M32 22L32 16Q32 8 40 8Q48 8 48 16L48 22" stroke="rgba(255,255,255,0.8)" strokeWidth="4" fill="none" strokeLinecap="round"/><circle cx="40" cy="32" r="5" fill="rgba(220,38,38,0.7)"/><rect x="38" y="34" width="4" height="8" rx="2" fill="rgba(220,38,38,0.7)"/><rect x="4" y="8" width="14" height="3" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="4" y="16" width="14" height="5" rx="1.5" fill="rgba(255,255,255,0.2)"/><rect x="4" y="26" width="14" height="3" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="4" y="34" width="14" height="5" rx="1.5" fill="rgba(255,255,255,0.2)"/><rect x="62" y="8" width="14" height="3" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="62" y="16" width="14" height="5" rx="1.5" fill="rgba(255,255,255,0.2)"/></svg> },
  droits: { bg: "linear-gradient(135deg,#0F766E,#065F46)", el: <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden><rect x="4" y="4" width="72" height="8" rx="2" fill="rgba(255,255,255,0.2)"/><rect x="6" y="6" width="24" height="4" rx="1" fill="rgba(255,255,255,0.5)"/><rect x="38" y="6" width="10" height="4" rx="1" fill="rgba(255,255,255,0.7)"/><rect x="52" y="6" width="10" height="4" rx="1" fill="rgba(255,255,255,0.4)"/><rect x="64" y="6" width="10" height="4" rx="1" fill="rgba(255,255,255,0.3)"/><rect x="4" y="15" width="72" height="6" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="6" y="16.5" width="18" height="3" rx="0.75" fill="rgba(255,255,255,0.5)"/><rect x="38" y="16.5" width="6" height="3" rx="1.5" fill="rgba(16,185,129,0.9)"/><rect x="52" y="16.5" width="6" height="3" rx="1.5" fill="rgba(16,185,129,0.9)"/><rect x="64" y="16.5" width="6" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/><rect x="4" y="23" width="72" height="6" rx="1" fill="rgba(255,255,255,0.07)"/><rect x="6" y="24.5" width="20" height="3" rx="0.75" fill="rgba(255,255,255,0.4)"/><rect x="38" y="24.5" width="6" height="3" rx="1.5" fill="rgba(16,185,129,0.9)"/><rect x="52" y="24.5" width="6" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/><rect x="64" y="24.5" width="6" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/><rect x="4" y="31" width="72" height="6" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="6" y="32.5" width="14" height="3" rx="0.75" fill="rgba(255,255,255,0.4)"/><rect x="38" y="32.5" width="6" height="3" rx="1.5" fill="rgba(16,185,129,0.9)"/><rect x="52" y="32.5" width="6" height="3" rx="1.5" fill="rgba(16,185,129,0.9)"/><rect x="64" y="32.5" width="6" height="3" rx="1.5" fill="rgba(16,185,129,0.9)"/><rect x="4" y="39" width="28" height="8" rx="3.5" fill="rgba(255,255,255,0.5)"/><rect x="6" y="41.5" width="16" height="3" rx="1.5" fill="rgba(7,89,68,0.8)"/></svg> },
};

/* ── Section card with hover state ─────────────────────────────────────── */
function LockedCard({ section }: { section: SectionDef }) {
  const illus = SECTION_ILLUS[section.id] ?? { bg: "linear-gradient(135deg,#94a3b8,#64748b)", el: null };
  return (
    <div
      style={{
        ...S.card,
        cursor: "default",
        opacity: 0.58,
        filter: "grayscale(55%)",
      }}
      aria-disabled="true"
      title="Réservé aux administrateurs"
    >
      <div style={{
        background: illus.bg,
        height: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
      }}>
        {illus.el}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.38)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{ fontSize: 22 }}>🔒</span>
        </div>
      </div>
      <div style={{ padding: "10px 13px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={S.cardNum}>Section {section.num}</span>
        <span style={S.cardTitle}>{section.title}</span>
        <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, marginTop: 2 }}>
          Réservé aux administrateurs
        </span>
      </div>
    </div>
  );
}

function SectionCard({ section, onClick }: { section: SectionDef; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const illus = SECTION_ILLUS[section.id] ?? { bg: "linear-gradient(135deg,#374151,#111827)", el: null };
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...S.card,
        borderColor: hov ? "#3B82F6" : "var(--klint-line, #E6E8EE)",
        boxShadow: hov ? "0 6px 20px rgba(0,0,0,0.10)" : "none",
        transform: hov ? "translateY(-2px)" : "none",
      }}
    >
      {/* Colored header with illustration */}
      <div style={{
        background: illus.bg,
        height: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {illus.el}
      </div>
      {/* Card body */}
      <div style={{ padding: "10px 13px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={S.cardNum}>Section {section.num}</span>
        <span style={S.cardTitle}>{section.title}</span>
      </div>
    </button>
  );
}

/* ── Nav button with hover state ────────────────────────────────────────── */
function NavBtn({ label, onClick, align }: { label: string; onClick: () => void; align: "left" | "right" }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...S.navBtn,
        textAlign: align,
        borderColor: hov ? "#3B82F6" : "var(--klint-line, #E6E8EE)",
        color: hov ? "#3B82F6" : "var(--klint-navy, #001036)",
        background: hov ? "#EFF6FF" : "var(--klint-paper, #F6F7FB)",
      }}
    >
      {label}
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function AidePage() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  // Sections accessibles (hors admin-only pour les non-admins)
  const accessibleSections = useMemo(
    () => SECTIONS.filter((s) => !s.minRole || isAdmin),
    [isAdmin],
  );

  // Filtrage par recherche — sections inaccessibles toujours exclues
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accessibleSections;
    return accessibleSections.filter((s) =>
      s.title.toLowerCase().includes(q) || s.keywords.toLowerCase().includes(q)
    );
  }, [search, accessibleSections]);

  /* ── Section view ───────────────────────────────────────────────────── */
  if (activeIdx !== null) {
    const sec = SECTIONS[activeIdx];

    // Bloquer l'accès direct à une section admin pour les non-admins
    if (sec.minRole === "admin" && !isAdmin) {
      setActiveIdx(null);
      return null;
    }

    // Prev/next : ignorer les sections verrouillées pour les non-admins
    const prevIdx = [...SECTIONS].slice(0, activeIdx).reduceRight<number>(
      (found, s, i) => found === -1 && (!s.minRole || isAdmin) ? i : found,
      -1,
    );
    const nextIdx = SECTIONS.findIndex((s, i) => i > activeIdx && (!s.minRole || isAdmin));
    const prev = prevIdx >= 0 ? SECTIONS[prevIdx] : null;
    const next = nextIdx >= 0 ? SECTIONS[nextIdx] : null;

    return (
      <div style={{ ...S.page, maxWidth: 760 }}>
        {/* Top navigation */}
        <div style={S.topNavRow}>
          <button onClick={() => setActiveIdx(null)} style={{ ...S.backBtn, padding: 0 }}>
            ← Sommaire
          </button>
          <span style={S.topNavCenter}>
            {sec.emoji}&nbsp;{activeIdx + 1}&nbsp;/&nbsp;{SECTIONS.length}&ensp;—&ensp;{sec.title}
          </span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {prev ? (
              <button
                onClick={() => setActiveIdx(prevIdx)}
                style={S.topNavLink}
                title={`${prev.num}. ${prev.title}`}
              >
                ← {prev.num}. {prev.title}
              </button>
            ) : (
              <span style={{ width: 0 }} />
            )}
            {next ? (
              <button
                onClick={() => setActiveIdx(nextIdx)}
                style={S.topNavLink}
                title={`${next.num}. ${next.title}`}
              >
                {next.num}. {next.title} →
              </button>
            ) : (
              <span style={{ width: 0 }} />
            )}
          </div>
        </div>

        {/* Section content */}
        {SECTION_BODIES[sec.id]}

        {/* Navigation row */}
        <div style={S.navRow}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {prev && (
              <NavBtn
                label={`← ${prev.num}. ${prev.title}`}
                onClick={() => setActiveIdx(prevIdx)}
                align="left"
              />
            )}
          </div>
          <span style={S.navCount}>{activeIdx + 1} / {SECTIONS.length}</span>
          <div style={{ minWidth: 0, flex: 1, display: "flex", justifyContent: "flex-end" }}>
            {next && (
              <NavBtn
                label={`${next.num}. ${next.title} →`}
                onClick={() => setActiveIdx(nextIdx)}
                align="right"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── TOC view ───────────────────────────────────────────────────────── */
  return (
    <div style={S.page}>
      <h1 style={S.h1}>Guide de formation — Klint Planning</h1>
      <p style={S.intro}>
        Mode d&apos;emploi complet. Cliquez sur une section pour la consulter. Utilisez la barre de recherche pour trouver rapidement un sujet.
      </p>

      {/* Search */}
      <div style={S.searchWrap}>
        <span style={S.searchIcon}>&#128269;</span>
        <input
          style={S.searchInput}
          type="text"
          placeholder="Rechercher… (ex. baseline, drag, duplication, PDF)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher dans l'aide"
        />
        {search && (
          <button style={S.searchClear} onClick={() => setSearch("")} aria-label="Effacer">
            &#215;
          </button>
        )}
      </div>

      {/* Card grid */}
      {filteredSections.length > 0 ? (
        <div style={S.cardGrid}>
          {filteredSections.map((sec) => {
            const idx = SECTIONS.findIndex((s) => s.id === sec.id);
            return (
              <SectionCard key={sec.id} section={sec} onClick={() => setActiveIdx(idx)} />
            );
          })}
        </div>
      ) : (
        <p style={S.noResult}>Aucune section pour &laquo; {search} &raquo;.</p>
      )}

      {/* Footer */}
      <div style={S.footer}>
        Klint Planning v1.0 — Jalons 0&#8211;20 &#183; Klint Consulting &#169; 2026
      </div>
    </div>
  );
}
