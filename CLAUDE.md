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
  reset-password/ # réinitialisation MDP autonome (route publique, token URL)
  login/          # page de connexion
  share/          # partage public (token)
auth.ts           # config next-auth
auth.config.ts
middleware.ts     # protection des routes
lib/
  actions/        # Server Actions Next.js (mutations, tout passe par ici)
    appSettings.ts
    authActions.ts      # changePassword (self-service), adminResetPassword (admin → Klint2026! + log), requestPasswordReset (email token 1h), resetPasswordWithToken (public)
    adminUsers.ts       # CRUD plateforme : adminCreateUser, adminUpdateUser, adminDisableUser, adminEnableUser, adminDeleteUser — tous loggés dans platform_events
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
scripts/          # scripts one-shot (création/import/correctif planning en DB directe)
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
- **Scripts one-shot** (`scripts/*.ts`) : pour créer/importer/corriger un planning directement en base sans passer par l'UI. Se connectent en direct via `@neondatabase/serverless` + Drizzle (URL Neon en dur ou via env), insèrent planning → settings/types/statuts → domaines → lots → phases/jalons, et **rollback** (suppression du planning) dans un `catch` si une étape échoue. Exécution : `npx tsx scripts/<nom>.ts`. Voir `scripts/create-b2b-edu-v2.ts` ou `scripts/create-conges-planning.ts` comme modèles.

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
| `phases` | Phases (barres Gantt) — colonnes sync : `syncGroupId`, `version` |
| `phase_assignees` | Assignation phases ↔ ressources |
| `milestones` | Jalons — colonnes sync : `syncGroupId`, `version` |
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
| `planning_groups` | Groupes de synchronisation entre plannings |
| `planning_group_members` | Membres (plannings) d'un groupe de sync |
| `phase_sync_groups` | Groupes de sync par paire de phases (1 entrée = 1 paire liée) |
| `milestone_sync_groups` | Groupes de sync par paire de jalons |
| `platform_events` | Audit trail admin plateforme : password_reset, user_created/updated/disabled/enabled/deleted |
| `password_reset_tokens` | Tokens de réinitialisation MDP (1h, single-use) — liés à `/reset-password` |

## Journalisation des erreurs

`lib/logger.ts` expose `logError()` — à appeler en fire-and-forget dans les catch :

```typescript
import { logError } from "@/lib/logger";
// Dans un catch :
logError({ source: "action:createPlanning", message: err.message, details: { ... } }).catch(() => {});
```

Les erreurs sont consultables dans **Paramètres → Logs erreurs** (admin uniquement).

## Synchronisation entre plannings liés

Architecture `sync_group_id` (N-way, non O(n²)) :

- **`planning_groups`** → **`planning_group_members`** : N plannings forment un groupe.
- **`phase_sync_groups`** / **`milestone_sync_groups`** : 1 entrée = 1 paire (ou tuple) de phases/jalons synchronisés. Chaque entrée a un `planningGroupId`.
- **`phases.syncGroupId`** / **`milestones.syncGroupId`** : toutes les phases partageant le même `syncGroupId` se synchronisent, quel que soit leur planning.
- **`phases.version`** / **`milestones.version`** : verrou optimiste — `WHERE id = X AND version = N`. Si 0 lignes → conflit, skip silencieux.

Propagation : `propagatePhaseSyncGroup` / `propagateMilestoneSyncGroup` dans `lib/actions/planning.ts` — écrit directement en DB, jamais d'appel récursif aux server actions → impossible de boucler.

Actions dans `lib/actions/planning-groups.ts` :
- `linkPhases` / `linkMilestones` : crée 1 `phase_sync_groups` par paire (ou réutilise le `syncGroupId` source si déjà lié → ajout N-way).
- `unlinkPhase` / `unlinkMilestone` : met `syncGroupId = null` sur la phase/jalon.
- `bulkLinkLot` : lie en masse toutes les phases/jalons d'un lot par correspondance de libellé identique.
- `getSyncCandidates` / `getMilestoneSyncCandidates` : retourne les phases/jalons non liés des plannings du groupe (pour le picker EditPanel). Trie les candidates de même libellé en premier (⭐).
- `createPlanningLink` / `removePlanningFromSyncGroup` : gestion des groupes (Paramètres).

UI : section **Synchronisation** en bas de l'EditPanel (phase et jalon). Bulk-link multi-sélection dans **Paramètres → Général → Plannings liés → ⇄ Synchroniser un lot**.

Statut **non synchronisé** par défaut (champ `status` exclu des champs propagés).

Migration idempotente : `lib/db/migrate-planning-sync.ts` — déjà appliquée en prod Neon.

## Fonctionnalités récentes — rappels techniques

### Couplage statut/avancement (lib/actions/planning.ts)

**Règle invariante** : `progress=100` ↔ `status="done"`. Ces deux champs sont toujours cohérents — ne jamais les écrire indépendamment en DB sans appliquer la règle.

Implémentation dans **`lib/actions/planning.ts`** :

| Action | Règle appliquée |
|---|---|
| `updatePhaseStatus` | `status=done` → force `progress=100` ; propagation inclut les deux |
| `updatePhaseProgress` | `progress=100` → force `status=done` (toujours, même si risk/late) |
| | `progress>0` + `status∈{planned,done}` → force `status=in_progress` |
| | `progress=0` + `status=done` → force `status=planned` (réinitialisation) |
| | `status∈{risk,late,review}` → non touché si progress < 100 |
| `bulkUpdatePhaseStatus` | `status=done` → force `progress=100` pour toutes les phases ; propagation inclut les deux |
| Import JSON (`plannings.ts`) | normalisation à l'écriture : `status=done→progress=100`, `progress≥100→status=done` |

**Ce que PhasePill affiche** (ne pas modifier sans cohérence DB) :
- Stries : `status === "done"` OU `progress >= 100` (fallback sécurité)
- Tirets : `status === "planned"` ET `progress === 0`

**Script de correction one-shot disponible** : `scripts/fix-done-status.ts` (58 phases corrigées le 2026-11-06) et `scripts/fix-done-zero-progress.ts` (4 phases corrigées le 2026-11-06).

### Rendu visuel des phases (components/gantt/PhasePill.tsx)
- **Terminée** (`status === "done"` OR `progress >= 100`) : stries diagonales + ✓.
- **Planifiée à 0 %** (`status === "planned"` AND `progress === 0`) : contour pointillé, fond transparent.
- **Autres statuts** : `box-shadow` interne par statut (pas `outline` — réservé à la sélection/édition) :
  - `in_progress` : blanc semi-transparent ; `review` : violet ; `risk` : orange ; `late` : rouge.
- **Barre de progression** : `rgba(255,255,255,0.25)`, seuil d'affichage `width >= 30px` (texte "X%" à 110px).

### Filtre par année (app/(app)/plannings/PlanningListClient.tsx)
`yearFilter` : `useState<number | null>(() => new Date().getFullYear())`. Pilules visibles dès que ≥ 2 années distinctes existent dans l'ensemble des plannings (actifs + archivés + désactivés). "Toutes" = null. Appliqué via `applyYearFilter()` sur l'onglet actif et sur `activeGroups`.

### Scripts de sync one-shot (scripts/)
**Règle critique** : toujours matcher par clé composite `lot_name::phase_label`, jamais par libellé seul — des dizaines de lots partagent des libellés génériques ("Cadrage", "Développement", "Recette").
Mapping de noms de lots si les deux plannings utilisent des noms différents pour le même périmètre : `LOT_NAME_MAP = { "E-Facturation - SAP": "E-Facturation - AMO" }`.

**⚠️ BUG TIMEZONE — ne jamais utiliser `toISOString().slice(0,10)` pour écrire des dates en DB.**
Neon renvoie les colonnes `DATE` sous forme de `Date` JavaScript à minuit UTC. En Paris (UTC+1), `new Date("2026-01-04T00:00:00Z").toISOString().slice(0,10)` = `"2026-01-04"` correct en lecture. Mais passer cette chaîne à Neon en écriture (paramètre SQL) l'interprète en heure locale (UTC+1) → minuit local = UTC−1h → stocke "2026-01-03" (−1 jour).

**Patterns sûrs :**
- **"Aujourd'hui" en Paris** : `new Date().toLocaleDateString("sv", { timeZone: "Europe/Paris" })` → renvoie "YYYY-MM-DD" en heure de Paris. Ne PAS utiliser `new Date().toISOString().slice(0,10)` qui donne l'heure UTC (= hier à Paris entre 00h00 et 01h00).
- **Lecture dates DB** : `to_char(ph.start_date, 'YYYY-MM-DD')` côté SQL → Neon renvoie une chaîne "YYYY-MM-DD" sans objet Date.
- **Copie DB→DB** : `UPDATE tgt SET start_date = src.start_date FROM phases src WHERE tgt.id = $t AND src.id = $s` — zero conversion JS, zéro risque de décalage.
- **Calculs Gantt (ganttUtils.ts)** : toujours créer les Date avec `"T00:00:00Z"` et utiliser exclusivement `getUTC*` / `setUTC*`. Ne jamais mélanger local et UTC.

Phases sans libellé (null) : impossible à matcher par clé composite → recourir au match par `sort_order`.

## Points d'attention

- Les migrations one-shot sont dans `lib/db/migrate-*.ts` — les exécuter manuellement si besoin avec `npx ts-node` ou via script npm.
- `drizzle-kit push` nécessite `DATABASE_URL_UNPOOLED` — utiliser la connexion directe (non poolée) pour les DDL.
- Tests Vitest dans `__tests__/` — configuration dans `vitest.config.ts`.
- `serverExternalPackages` dans `next.config.ts` : `@sparticuz/chromium`, `playwright-core`, `nodemailer` — ne pas les bundler côté client.
