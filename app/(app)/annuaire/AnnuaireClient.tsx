"use client";

import { useState, useMemo } from "react";
import type { DirectoryContact } from "@/lib/db/queries";

interface Props {
  contacts: DirectoryContact[];
}

const PERMISSION_LABEL: Record<string, string> = {
  owner:  "Propriétaire",
  editor: "Éditeur",
  viewer: "Lecteur",
};

export function AnnuaireClient({ contacts }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.plannings.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  return (
    <div style={{ padding: "32px 40px 60px", fontFamily: "var(--font-display, system-ui)", color: "var(--klint-navy, #001036)" }}>
      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Annuaire</h1>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, marginTop: 0 }}>
        Tous les responsables de la plateforme, avec leurs plannings associés.
      </p>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 400, marginBottom: 24 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 15, pointerEvents: "none" }}>
          🔍
        </span>
        <input
          type="text"
          placeholder="Rechercher par nom, email ou planning…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 14px 9px 38px",
            fontFamily: "var(--font-display, system-ui)",
            fontSize: 14,
            color: "var(--klint-navy)",
            background: "#fff",
            border: "1.5px solid var(--klint-line, #E6E8EE)",
            borderRadius: 10,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Effacer"
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}
          >
            ×
          </button>
        )}
      </div>

      {/* Stats */}
      <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
        {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
        {search ? ` pour « ${search} »` : " au total"}
      </p>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", padding: "48px 0" }}>
          Aucun résultat pour « {search} »
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {filtered.map((c) => (
            <ContactCard key={c.userId} contact={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactCard({ contact: c }: { contact: DirectoryContact }) {
  const initials = (c.initials ?? (c.name ?? c.email).slice(0, 2)).toUpperCase();
  const color    = c.color ?? "#001D63";

  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid var(--klint-line, #E6E8EE)",
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Top row: avatar + name/email */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: color,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            letterSpacing: 0.5,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.name ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.email}
          </div>
        </div>
      </div>

      {/* Plannings */}
      {c.plannings.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {c.plannings.map((p) => (
            <span
              key={p.id}
              title={PERMISSION_LABEL[p.permission] ?? p.permission}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--klint-paper, #F6F7FB)",
                border: "1px solid var(--klint-line, #E6E8EE)",
                color: "var(--klint-navy)",
                whiteSpace: "nowrap",
              }}
            >
              {p.name}
            </span>
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>Aucun planning associé</span>
      )}
    </div>
  );
}
