export default function AidePage() {
  return (
    <div style={{ padding: 40, fontFamily: "var(--font-display, system-ui)", color: "var(--klint-navy, #001036)", maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Aide</h1>
      <dl style={{ fontSize: 13, lineHeight: 1.7, color: "#374151" }}>
        <dt style={{ fontWeight: 600, marginTop: 12 }}>Naviguer dans le Gantt</dt>
        <dd style={{ margin: 0, color: "#6B7280" }}>Molette horizontale ou trackpad. Boutons ‹ › dans la toolbar pour avancer/reculer par période.</dd>
        <dt style={{ fontWeight: 600, marginTop: 12 }}>Éditer une phase</dt>
        <dd style={{ margin: 0, color: "#6B7280" }}>Cliquez sur une phase dans le Gantt pour ouvrir le panneau d&apos;édition.</dd>
        <dt style={{ fontWeight: 600, marginTop: 12 }}>Éditer un jalon</dt>
        <dd style={{ margin: 0, color: "#6B7280" }}>Cliquez sur le drapeau ou le losange du jalon dans le Gantt.</dd>
        <dt style={{ fontWeight: 600, marginTop: 12 }}>Sélection multiple</dt>
        <dd style={{ margin: 0, color: "#6B7280" }}>⌘+clic (Mac) ou Ctrl+clic (Windows) pour sélectionner plusieurs phases, puis utilisez la barre en bas pour changer leur statut.</dd>
        <dt style={{ fontWeight: 600, marginTop: 12 }}>Recherche rapide</dt>
        <dd style={{ margin: 0, color: "#6B7280" }}>⌘K (Mac) ou Ctrl+K (Windows) pour rechercher un lot, une phase ou un jalon.</dd>
        <dt style={{ fontWeight: 600, marginTop: 12 }}>Mode plein écran / PDF</dt>
        <dd style={{ margin: 0, color: "#6B7280" }}>Disponible au Jalon 6.</dd>
      </dl>
    </div>
  );
}
