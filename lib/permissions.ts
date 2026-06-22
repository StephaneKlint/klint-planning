// Types et constantes de la matrice de permissions — fichier non-serveur
// importable depuis client ET server components

export type RolePermRow = {
  owner:  boolean;
  editor: boolean;
  viewer: boolean;
};

export type PermissionMatrix = {
  // Accès plateforme — pour les utilisateurs avec rôle "user" (admin a tout)
  platform: {
    create_planning: boolean;
    export:          boolean;
    share:           boolean;
  };
  // Onglets Paramètres visibles par les Utilisateurs
  tabs: {
    general:    boolean;
    cadence:    boolean;
    phases:     boolean;
    jalons:     boolean;
    statuts:    boolean;
    repertoire: boolean;
    historique: boolean;
    apparence:  boolean;
    calendrier: boolean;
    securite:   boolean;
  };
  // Actions sur les plannings par rôle de membre (Admin a tout)
  planning_actions: {
    edit_settings: RolePermRow;
    archive:       RolePermRow;
    delete:        RolePermRow;
    duplicate:     RolePermRow;
    template:      RolePermRow;
    export:        RolePermRow;
    share:         RolePermRow;
  };
  // Gantt — phases & jalons
  gantt_actions: {
    phase_create: RolePermRow;
    phase_edit:   RolePermRow;
    phase_move:   RolePermRow;
    phase_delete: RolePermRow;
    ms_create:    RolePermRow;
    ms_edit:      RolePermRow;
    ms_delete:    RolePermRow;
  };
  // Gestion des membres
  member_actions: {
    add:    RolePermRow;
    remove: RolePermRow;
    manage: RolePermRow;
  };
};

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  platform: {
    create_planning: true,
    export:          true,
    share:           true,
  },
  tabs: {
    general:    true,
    cadence:    true,
    phases:     true,
    jalons:     true,
    statuts:    true,
    repertoire: false,
    historique: false,
    apparence:  false,
    calendrier: true,
    securite:   false,
  },
  planning_actions: {
    edit_settings: { owner: true,  editor: false, viewer: false },
    archive:       { owner: true,  editor: false, viewer: false },
    delete:        { owner: false, editor: false, viewer: false },
    duplicate:     { owner: true,  editor: true,  viewer: false },
    template:      { owner: false, editor: false, viewer: false },
    export:        { owner: true,  editor: true,  viewer: true  },
    share:         { owner: true,  editor: false, viewer: false },
  },
  gantt_actions: {
    phase_create: { owner: true,  editor: true,  viewer: false },
    phase_edit:   { owner: true,  editor: true,  viewer: false },
    phase_move:   { owner: true,  editor: true,  viewer: false },
    phase_delete: { owner: true,  editor: false, viewer: false },
    ms_create:    { owner: true,  editor: true,  viewer: false },
    ms_edit:      { owner: true,  editor: true,  viewer: false },
    ms_delete:    { owner: true,  editor: false, viewer: false },
  },
  member_actions: {
    add:    { owner: true,  editor: false, viewer: false },
    remove: { owner: true,  editor: false, viewer: false },
    manage: { owner: true,  editor: false, viewer: false },
  },
};
