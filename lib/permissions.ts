// Types et constantes de la matrice de permissions — fichier non-serveur
// importable depuis client ET server components

export type PermissionMatrix = {
  user: {
    tab_general:      boolean;
    tab_cadence:      boolean;
    tab_phases:       boolean;
    tab_jalons:       boolean;
    tab_statuts:      boolean;
    "tab_répertoire": boolean;
    tab_historique:   boolean;
    tab_apparence:    boolean;
    tab_calendrier:   boolean;
    tab_securite:     boolean;
    create_planning:  boolean;
    export:           boolean;
    share:            boolean;
  };
};

export const DEFAULT_PERMISSIONS: PermissionMatrix = {
  user: {
    tab_general:      true,
    tab_cadence:      true,
    tab_phases:       true,
    tab_jalons:       true,
    tab_statuts:      true,
    "tab_répertoire": false,
    tab_historique:   false,
    tab_apparence:    false,
    tab_calendrier:   true,
    tab_securite:     false,
    create_planning:  true,
    export:           true,
    share:            true,
  },
};
