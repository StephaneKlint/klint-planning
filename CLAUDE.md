# CCI PLANNING — Notes techniques pour Claude Code

## Stack

- **Next.js 15** App Router, TypeScript strict
- **Drizzle ORM** + **Neon** (Postgres serverless) — migrations via scripts dédiés dans `lib/db/`
- **next-auth v5** avec `@auth/drizzle-adapter` — auth par email + magic link
- **TanStack React Query** pour le data-fetching côté client
- **Pusher** pour les notifications temps réel
- **nodemailer** + **Brevo** pour les emails transactionnels (`BREVO_API_KEY`, `EMAIL_FROM`)
- **jsPDF** + **html2canvas** pour l'export PDF
- **Playwright** + **@sparticuz/chromium** pour les captures d'écran serveur
- **pnpm** comme gestionnaire de paquets (`pnpm install`, `pnpm dev`, `pnpm build`)

## Path aliases

```
@/*  →  ./*   (racine du projet)
```

## Commandes clés

```bash
pnpm dev          # dev local
pnpm build        # build prod
pnpm test         # tests Vitest
```

## Architecture

```
app/
  (app)/          # pages protégées (layout + nav)
    aide/         # page d'aide utilisateur
    historique/   # journal d'activité
    p/[id]/       # vue détail planning (Gantt)
    parametres/   # paramètres admin (onglets : général, équipe, rôles, modèles, emails, logs erreurs)
    plannings/    # liste des plannings
    portefeuille/ # vue portefeuille multi-planning
    presentation/ # mode présentation
    ressources/   # gestion des ressources
    synthese/     # tableau de synthèse
  api/
    auth/         # next-auth handlers
    export/       # export PDF/image
    favicon/      # génération favicon
    log-connection/ # enregistrement connexions
  invite/         # activation de compte (lien d'invitation)
  login/          # page de connexion
  share/          # partage public (token)
auth.ts           # config next-auth
auth.config.ts
middleware.ts     # protection des routes
lib/
  actions/        # Server Actions Next.js (mutations, tout passe par ici)
    appSettings.ts
    authActions.ts
    baseline.ts
    closurePeriods.ts
    errors.ts           # getErrors(), resolveError() — admin
    invitations.ts
    members.ts
    planning.ts
    plannings.ts
    settings.ts
    share.ts
  db/
    index.ts      # connexion Drizzle/Neon
    schema.ts     # schéma Drizzle (source de vérité)
    queries.ts    # requêtes réutilisables
    migrate-*.ts  # scripts de migration one-shot
  logger.ts       # logError() — journalisation erreurs → table app_errors
  permissions.ts  # helpers droits utilisateur
  domain.ts       # constantes métier
  hooks/          # hooks partagés côté serveur
components/       # composants React réutilisables
hooks/            # hooks React côté client
store/            # état global (Zustand ou Context)
styles/           # CSS global
types/            # types TypeScript partagés
drizzle/          # fichiers SQL de migration générés
```

## Conventions

- **Server Actions** : toutes les mutations passent par `lib/actions/`. Pas de routes API classiques pour les mutations — utiliser `"use server"`.
- **Rôles** : `owner | editor | viewer` (enum `permissionEnum`). L'admin global est distinct du rôle planning.
- **Soft delete** : certaines entités utilisent `deletedAt` ou `disabledAt`. Filtrer en conséquence.
- **Déploiement** : Vercel (branche `main` = production). Un `git push` suffit.
- **Variables d'env** :
  - `DATABASE_URL` — Neon pooled (pour Drizzle + app)
  - `DATABASE_URL_UNPOOLED` — Neon direct (pour migrations)
  - `NEXT_PUBLIC_APP_URL` — URL publique de l'app
  - `BREVO_API_KEY` — envoi emails
  - `EMAIL_FROM` — expéditeur
  - `AUTH_SECRET` — secret next-auth
- **pnpm** uniquement — ne pas utiliser npm ou yarn.

## Tables DB principales

| Table | Description |
|---|---|
| `users` | Comptes utilisateurs |
| `invitation_tokens` | Tokens d'invitation (magic link) |
| `accounts` / `sessions` | Tables next-auth |
| `plannings` | Plannings Gantt |
| `planning_members` | Membres d'un planning (rôle + permission) |
| `project_roles` | Rôles personnalisés par planning |
| `domains` | Domaines fonctionnels |
| `lots` | Lots de travail |
| `phases` | Phases (barres Gantt) |
| `phase_assignees` | Assignation phases ↔ ressources |
| `milestones` | Jalons |
| `phase_types` / `milestone_types` | Types personnalisables |
| `statuses` | Statuts personnalisables |
| `planning_settings` | Paramètres par planning |
| `activity_log` | Journal d'activité |
| `notifications` | Notifications push |
| `closure_periods` | Périodes de fermeture |
| `share_tokens` | Tokens de partage public |
| `baselines` | Snapshots Gantt (baseline comparaison) |
| `connection_logs` | Logs de connexion par IP/pays |
| `app_errors` | Erreurs applicatives — consultable en admin |
| `app_settings` | Paramètres globaux (JSON) |

## Journalisation des erreurs

`lib/logger.ts` expose `logError()` — à appeler en fire-and-forget dans les catch :

```typescript
import { logError } from "@/lib/logger";
// Dans un catch :
logError({ source: "action:createPlanning", message: err.message, details: { ... } }).catch(() => {});
```

Les erreurs sont consultables dans **Paramètres → Logs erreurs** (admin uniquement).

## Points d'attention

- Les migrations one-shot sont dans `lib/db/migrate-*.ts` — les exécuter manuellement si besoin avec `npx ts-node` ou via script npm.
- `drizzle-kit push` nécessite `DATABASE_URL_UNPOOLED` — utiliser la connexion directe (non poolée) pour les DDL.
- Tests Vitest dans `__tests__/` — configuration dans `vitest.config.ts`.
- `serverExternalPackages` dans `next.config.ts` : `@sparticuz/chromium`, `playwright-core`, `nodemailer` — ne pas les bundler côté client.
