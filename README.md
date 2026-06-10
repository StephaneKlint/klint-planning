# Klint Planning — CCI 2026

Outil de planification Gantt collaboratif pour la gestion de portefeuilles CRM et projets de transformation numérique. Développé par Klint Consulting.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript strict |
| Base de données | PostgreSQL (Neon serverless) · Drizzle ORM |
| Authentification | Auth.js v5 — magic-link email (Resend) · JWT strategy (Edge) |
| État | Zustand · TanStack Query (polling 10s) |
| Style | CSS Modules — design system Klint (tokens, 52 icônes SVG) |
| Export | html2canvas + jspdf (PDF A3 paysage, import dynamique) |
| Déploiement | Vercel (serverless) |

---

## Fonctionnalités principales (Jalons 0–6)

- **Gantt multi-vues** — 4 niveaux de zoom (1m / 3m / 6m / 12m), scroll synchronisé, coloration par domaine / statut / personne
- **Mutations temps réel** — édition phases et jalons, sélection multiple, barre bulk, palette de commandes ⌘K
- **Présence collaborative** — avatars membres actifs, polling 10s, heartbeat 30s
- **Authentification** — magic-link email, middleware Edge, gestion de session JWT
- **4 vues métier** — Gantt · Synthèse (J+30/60/90) · Ressources (membres + charges) · Paramètres
- **Gestion multi-plannings** — liste, création (mono/multi-projets), duplication, archivage
- **RBAC** — droits Propriétaire / Éditeur / Lecteur par planning et par membre
- **Logo personnalisable** — upload PNG/SVG/JPEG (base64, max 200 Ko) dans le rail de navigation
- **Export PDF A3** — capture côté client via html2canvas, sortie A3 paysage

---

## Démarrage local

### Prérequis

- Node.js 20+ (via nvm recommandé)
- pnpm 10+
- Compte Neon (PostgreSQL serverless)
- Compte Resend (emails magic-link — optionnel en dev, URL loggée en console)

### Installation

```bash
git clone https://github.com/StephaneKlint/CCI_Planning_Claude_Design.git
cd CCI_Planning_Claude_Design
pnpm install
```

### Variables d'environnement

```bash
cp .env.example .env.local
```

Variables obligatoires dans `.env.local` :

```env
DATABASE_URL=postgresql://neondb_owner:...@.../neondb?sslmode=require
NEXTAUTH_SECRET=une-chaine-aleatoire-longue
NEXTAUTH_URL=http://localhost:3000

# Optionnel — si absent, le lien magic-link est loggué en console
RESEND_API_KEY=re_...
EMAIL_FROM=planning@votre-domaine.com
```

### Lancer le serveur

```bash
pnpm dev
```

App disponible sur `http://localhost:3000`.

### Migration base de données

```bash
# Appliquer le schéma Drizzle
pnpm db:push

# Si conflit (ex. app_settings déjà créée) : migration manuelle idempotente
pnpm tsx lib/db/migrate-j6.ts

# Injecter les données de démo
pnpm tsx lib/db/seed.ts
```

---

## Structure du projet

```
/app
  /(app)
    /p/[planningId]/     — Vue Gantt principale (GanttView + Toolbar + EditPanel)
    /plannings/          — Liste des plannings (cards + duplication + archivage)
    /plannings/nouveau/  — Formulaire de création (type mono/multi)
    /synthese/           — KPIs + jalons J+30/J+60/J+90
    /ressources/         — Membres + phases assignées par domaine
    /parametres/         — 7 onglets : Général / Cadence / Phases / Jalons / Statuts / Membres & Droits / Apparence
    /historique/         — Journal d'activité (200 entrées)
    /aide/               — Guide utilisateur (mode formation)
  /login/                — Page connexion magic-link

/components
  /gantt/                — Gantt, GanttSide, Timeline, PhasePill, MilestoneFlag
  /chrome/               — Rail (logo), Topbar, Toolbar (PDF A3), PresenceStack
  /panels/               — EditPanel, BulkBar, CommandPalette
  /ui/                   — Icon, Avatar, StatusPill, Button, Donut

/lib
  /db/                   — schema.ts, queries.ts, seed.ts, migrate-j6.ts
  /actions/              — planning.ts, plannings.ts, settings.ts, appSettings.ts
  /queries/              — usePlanning.ts (TanStack), usePresence.ts

/store
  ganttStore.ts          — Zustand : zoom, colorMode, editTarget, filterDates, commandPalette

/styles
  design-tokens.css      — Tokens Klint (couleurs, typographie, radius, shadows)
  colors_and_type.css    — Variables CSS globales
```

---

## Déploiement Vercel

```bash
vercel link
vercel env pull          # Récupère les variables de prod
vercel deploy --prod
```

Variables Vercel à configurer :
- `DATABASE_URL` — connexion Neon avec `?sslmode=require`
- `NEXTAUTH_SECRET` — secret JWT (générer avec `openssl rand -base64 32`)
- `NEXTAUTH_URL` — URL de production (ex. `https://mon-planning.vercel.app`)
- `RESEND_API_KEY` — clé API Resend pour les emails
- `EMAIL_FROM` — adresse expéditeur vérifiée sur Resend

---

## Licence

Projet privé — Stéphane Durand @ Klint Consulting
