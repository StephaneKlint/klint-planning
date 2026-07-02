import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  smallint,
} from "drizzle-orm/pg-core";

// ---- Enums ---------------------------------------------------------------

export const permissionEnum = pgEnum("permission", ["owner", "editor", "viewer"]);

export const statusEnum = pgEnum("phase_status", [
  "planned",
  "in_progress",
  "review",
  "done",
  "risk",
  "late",
]);

export const labelPosEnum = pgEnum("label_pos", ["auto", "above", "below"]);

// ---- Auth.js v5 tables (Drizzle adapter) ---------------------------------
// These are required by @auth/drizzle-adapter. Configured in Jalon 5.

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  name: varchar("name", { length: 160 }).notNull().default(""),
  avatarColor: varchar("avatar_color", { length: 9 }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  passwordHash: text("password_hash"),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  role: text("role").notNull().default("contact"), // 'admin' | 'user' | 'contact'
});

// ---- Tokens d'invitation (lien "Définir mon mot de passe") ---------------

export const invitationTokens = pgTable("invitation_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ---- Paramètres globaux de l'application ---------------------------------
// Singleton (une seule ligne, key = 'global')

export const appSettings = pgTable("app_settings", {
  key:             varchar("key", { length: 20 }).primaryKey(),   // toujours "global"
  logoDataUrl:     text("logo_data_url"),                         // base64 ou null → logo Klint
  logoAlt:         varchar("logo_alt", { length: 100 }).default("Klint"),
  faviconDataUrl:  text("favicon_data_url"),                      // base64 ou null → favicon.svg
  permissionsJson: jsonb("permissions_json"),                     // matrice droits par rôle
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---- Plannings -----------------------------------------------------------

export const plannings = pgTable("plannings", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default("multi"), // "mono" | "multi"
  year: integer("year").notNull(),
  viewStart: date("view_start").notNull(),
  viewEnd: date("view_end").notNull(),
  referenceDate: date("reference_date"),
  archived: boolean("archived").default(false).notNull(),
  disabled: boolean("disabled").default(false).notNull(),
  isTemplate: boolean("is_template").default(false).notNull(),
  projectName: varchar("project_name", { length: 100 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---- Membres d'un planning -----------------------------------------------

export const planningMembers = pgTable(
  "planning_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningId: uuid("planning_id")
      .notNull()
      .references(() => plannings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: permissionEnum("permission").notNull().default("editor"),
    projectRoleId: uuid("project_role_id").references(() => projectRoles.id, { onDelete: "set null" }),
    initials: varchar("initials", { length: 3 }),
    color: varchar("color", { length: 9 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [index("uniq_member").on(t.planningId, t.userId)]
);

// ---- Rôles projet --------------------------------------------------------

export const projectRoles = pgTable("project_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  planningId: uuid("planning_id")
    .notNull()
    .references(() => plannings.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  color: varchar("color", { length: 9 }).notNull(),
  sortOrder: smallint("sort_order").default(0).notNull(),
});

// ---- Domaines (par planning) ---------------------------------------------

export const domains = pgTable("domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  planningId: uuid("planning_id")
    .notNull()
    .references(() => plannings.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  bg: varchar("bg", { length: 9 }).notNull(),
  bgAlt: varchar("bg_alt", { length: 9 }).notNull(),
  strong: varchar("strong", { length: 9 }).notNull(),
  phaseColor: varchar("phase_color", { length: 9 }).notNull(),
  sortOrder: smallint("sort_order").default(0).notNull(),
  collapsed: boolean("collapsed").default(false).notNull(),
  cadence: jsonb("cadence")
    .$type<{ livraison: number; pmep: number; cab: number; mep: number }>()
    .default({ livraison: 0, pmep: 10, cab: 12, mep: 15 })
    .notNull(),
});

// ---- Lots ----------------------------------------------------------------

export const lots = pgTable("lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  planningId: uuid("planning_id")
    .notNull()
    .references(() => plannings.id, { onDelete: "cascade" }),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  subtitle: text("subtitle"),
  icon: varchar("icon", { length: 16 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  isPostponed: boolean("is_postponed").default(false).notNull(),
  postponedNote: text("postponed_note"),
  postponedLabelColor: varchar("postponed_label_color", { length: 20 }),
  postponedLabelFont: varchar("postponed_label_font", { length: 80 }),
  postponedLabelSize: smallint("postponed_label_size"),
});

// ---- Phases --------------------------------------------------------------

export const phases = pgTable(
  "phases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    label: text("label"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: statusEnum("status"),
    progress: smallint("progress").default(0).notNull(),
    color: varchar("color", { length: 9 }),
    note: text("note"),
    sortOrder: smallint("sort_order").default(0).notNull(),
  },
  (t) => [index("phase_by_lot").on(t.lotId)]
);

// ---- Assignations phase ↔ membre ----------------------------------------

export const phaseAssignees = pgTable(
  "phase_assignees",
  {
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => phases.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => planningMembers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.phaseId, t.memberId] })]
);

// ---- Jalons --------------------------------------------------------------

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => lots.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    label: text("label").notNull(),
    date: date("date").notNull(),
    color: varchar("color", { length: 9 }),
    labelPos: labelPosEnum("label_pos").default("auto").notNull(),
    note: text("note"),
  },
  (t) => [index("ms_by_lot").on(t.lotId)]
);

// ---- Config par planning -------------------------------------------------

export const phaseTypes = pgTable("phase_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  planningId: uuid("planning_id")
    .notNull()
    .references(() => plannings.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 40 }).notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  sortOrder: smallint("sort_order").default(0).notNull(),
});

export const milestoneTypes = pgTable("milestone_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  planningId: uuid("planning_id")
    .notNull()
    .references(() => plannings.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 40 }).notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  color: varchar("color", { length: 9 }).notNull(),
  sortOrder: smallint("sort_order").default(0).notNull(),
});

export const statuses = pgTable("statuses", {
  id: uuid("id").defaultRandom().primaryKey(),
  planningId: uuid("planning_id")
    .notNull()
    .references(() => plannings.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 40 }).notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  color: varchar("color", { length: 9 }).notNull(),
  bg: varchar("bg", { length: 9 }).notNull(),
  sortOrder: smallint("sort_order").default(0).notNull(),
});

export const planningSettings = pgTable("planning_settings", {
  planningId: uuid("planning_id")
    .primaryKey()
    .references(() => plannings.id, { onDelete: "cascade" }),
  autoLate: boolean("auto_late").default(true).notNull(),
  autoCloseAfterMepDays: integer("auto_close_after_mep_days").default(30).notNull(),
  notifyOnLate: boolean("notify_on_late").default(true).notNull(),
});

// ---- Journal & notifications ---------------------------------------------

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningId: uuid("planning_id")
      .notNull()
      .references(() => plannings.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    verb: varchar("verb", { length: 80 }).notNull(),
    targetType: varchar("target_type", { length: 40 }),
    targetId: uuid("target_id"),
    summary: text("summary").notNull(),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("log_by_planning").on(t.planningId, t.createdAt)]
);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  planningId: uuid("planning_id")
    .notNull()
    .references(() => plannings.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull(),
  body: text("body").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---- Périodes de fermeture et jours fériés (par planning) ----------------

export const closurePeriods = pgTable(
  "closure_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningId: uuid("planning_id")
      .notNull()
      .references(() => plannings.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 100 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    color: varchar("color", { length: 9 }).notNull().default("#FEF3C7"),
    type: varchar("type", { length: 20 }).notNull().default("custom"), // "holiday" | "custom"
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("cp_by_planning").on(t.planningId)]
);

// ---- Liens de partage lecture seule --------------------------------------

export const shareTokens = pgTable(
  "share_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningId: uuid("planning_id")
      .notNull()
      .references(() => plannings.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [index("share_tokens_by_planning").on(t.planningId)]
);

// ---- Baseline / Plan de référence ----------------------------------------

export const baselines = pgTable(
  "baselines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planningId: uuid("planning_id")
      .notNull()
      .references(() => plannings.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    snapshot: jsonb("snapshot")
      .$type<{
        phases: Record<string, { startDate: string; endDate: string }>;
        milestones: Record<string, { date: string }>;
      }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("baselines_by_planning").on(t.planningId)]
);

// ---- Journalisation des connexions --------------------------------------

export const connectionLogs = pgTable(
  "connection_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    ip: text("ip"),
    country: text("country"),
    countryCode: text("country_code"),
    city: text("city"),
    userAgent: text("user_agent"),
    isAlert: boolean("is_alert").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("cl_by_user").on(t.userId), index("cl_created").on(t.createdAt)]
);

// ---- Logs d'erreurs applicatifs ------------------------------------------

export const appErrors = pgTable(
  "app_errors",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    source:     varchar("source", { length: 100 }).notNull(),
    level:      varchar("level", { length: 10 }).notNull().default("error"),
    message:    text("message").notNull(),
    details:    jsonb("details"),
    userId:     uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    statusCode: integer("status_code"),
    resolved:   boolean("resolved").notNull().default(false),
  },
  (t) => [index("ae_created").on(t.createdAt), index("ae_resolved").on(t.resolved)]
);
