import { describe, expect, it } from "vitest";
import {
  bearerMatches, buildTypesSeen, frenchHolidays, isAllowedPlanning, parseAllowedIds, parseDefaultTypes, parseLeavesParams, toLeaves, workingDays,
} from "../lib/leaves-api";

const KEY = "k".repeat(40);
const ID = "3f2b8c1e-5d4a-4b6f-9a7e-0c1d2e3f4a5b";
const P = (q: string) => parseLeavesParams(new URLSearchParams(q), ["CP", "RTT"]);

describe("clé Bearer", () => {
  it("accepte la bonne clé, refuse tout le reste", () => {
    expect(bearerMatches(`Bearer ${KEY}`, KEY)).toBe(true);
    expect(bearerMatches(`bearer ${KEY}`, KEY)).toBe(true);
    expect(bearerMatches(`Bearer ${KEY}x`, KEY)).toBe(false);
    expect(bearerMatches(`Bearer ${KEY.slice(1)}`, KEY)).toBe(false);
    expect(bearerMatches(KEY, KEY)).toBe(false);
    expect(bearerMatches("Basic abc", KEY)).toBe(false);
    expect(bearerMatches(null, KEY)).toBe(false);
    expect(bearerMatches("Bearer ", KEY)).toBe(false);
  });
  it("API inactive si la clé attendue est absente ou trop courte", () => {
    expect(bearerMatches("Bearer abc", undefined)).toBe(false);
    expect(bearerMatches("Bearer short", "short")).toBe(false);
    expect(bearerMatches("Bearer ", "")).toBe(false);
  });
});

describe("plannings autorisés", () => {
  it("ne retient que des UUID, insensible à la casse", () => {
    const s = parseAllowedIds(` ${ID.toUpperCase()}, pas-un-uuid ;; 11111111-1111-1111-1111-111111111111 `);
    expect(s.size).toBe(2);
    expect(isAllowedPlanning(s, ID)).toBe(true);
    expect(isAllowedPlanning(s, "22222222-2222-2222-2222-222222222222")).toBe(false);
    expect(parseAllowedIds(undefined).size).toBe(0);
    expect(isAllowedPlanning(parseAllowedIds(""), ID)).toBe(false); // liste vide = aucun planning
  });
});

describe("paramètres", () => {
  it("valide les dates et la période", () => {
    expect(P("from=2026-10-26&to=2026-11-06")).toEqual({ ok: true, from: "2026-10-26", to: "2026-11-06", types: ["cp", "rtt"] });
    expect(P("from=2026-10-26").ok).toBe(false);
    expect(P("from=2026-13-01&to=2026-11-06").ok).toBe(false);
    expect(P("from=2026-11-06&to=2026-10-26").ok).toBe(false);
    expect(P("from=2026-01-01&to=2027-12-31").ok).toBe(false);
    expect(P("from=2026-10-26&to=2026-10-26").ok).toBe(true);
  });
  it("types : liste validée, défaut sinon", () => {
    const r = P("from=2026-10-26&to=2026-11-06&types=CP,%20Formation,cp");
    expect(r).toMatchObject({ ok: true, types: ["cp", "formation"] });
    expect(P("from=2026-10-26&to=2026-11-06&types=CP%27%3B%20DROP").ok).toBe(false);
    expect(P("from=2026-10-26&to=2026-11-06&types=").ok).toBe(false);
    expect(parseDefaultTypes(undefined)).toEqual(["CP", "RTT", "Formation", "Absence"]);
    expect(parseDefaultTypes("Congé, <x>")).toEqual(["Congé"]);
  });
});

describe("jours ouvrés", () => {
  it("fériés 2026 et comptage", () => {
    expect([...frenchHolidays(2026)].sort()).toEqual(["2026-01-01", "2026-04-06", "2026-05-01", "2026-05-08", "2026-05-14", "2026-05-25", "2026-07-14", "2026-08-15", "2026-11-01", "2026-11-11", "2026-12-25"]);
    expect(workingDays("2026-10-26", "2026-10-30")).toBe(5);
    expect(workingDays("2026-11-09", "2026-11-13")).toBe(4); // 11/11 férié
    expect(workingDays("2026-10-24", "2026-10-25")).toBe(0);
  });
});

describe("forme de la réponse", () => {
  const rows = [
    { phaseId: "p1", memberId: "m1", type: "CP", start: "2026-10-28", end: "2026-10-30", email: " Alice@Example.TEST ", name: "Alice" },
    { phaseId: "p1", memberId: "m2", type: "CP", start: "2026-10-28", end: "2026-10-30", email: "bob@example.test", name: "" },
    // champs sensibles éventuellement présents dans la ligne : ne doivent jamais ressortir
    { phaseId: "p2", memberId: "m1", type: "RTT", start: "2026-10-26", end: "2026-10-26", email: "alice@example.test", name: "Alice", note: "motif secret", label: "Maladie" } as never,
  ];
  const out = toLeaves(rows);
  it("normalise, trie, ne divulgue ni note ni libellé ni identifiants internes", () => {
    expect(out.map((l) => l.start)).toEqual(["2026-10-26", "2026-10-28", "2026-10-28"]);
    expect(out[1]).toMatchObject({ memberRef: "alice@example.test", memberName: "Alice", type: "CP", days: 3, halfDayStart: false, halfDayEnd: false });
    expect(out[2].memberName).toBe("bob");
    const s = JSON.stringify(out);
    expect(s).not.toContain("secret"); expect(s).not.toContain("Maladie"); expect(s).not.toContain("p1"); expect(s).not.toContain("m1");
    expect(out[1].id).not.toBe(out[2].id); // deux membres de la même phase : deux congés distincts
    expect(Object.keys(out[0]).sort()).toEqual(["days", "end", "halfDayEnd", "halfDayStart", "id", "memberName", "memberRef", "start", "type"]);
  });
});

describe("personne = nom du lot quand la phase n'est pas affectée", () => {
  const out = toLeaves([
    // phase non affectée : membre, e-mail et nom nuls ; le lot porte le prénom, le domaine sert de groupe
    { phaseId: "p3", memberId: null, type: "cp", start: "2026-10-28", end: "2026-10-29", email: null, name: null, lotName: " Nicolas ", domainName: "Masao" },
    { phaseId: "p4", memberId: null, type: "rtt", start: "2026-10-28", end: "2026-10-28", email: null, name: null, lotName: "Nicolas", domainName: "Almaviva CX" },
    // phase affectée : le membre prime sur le lot
    { phaseId: "p5", memberId: "m9", type: "cp", start: "2026-10-30", end: "2026-10-30", email: "Zoe@Example.test", name: "Zoé", lotName: "Autre", domainName: "KLINT" },
    // ni membre ni lot exploitable : ignoré
    { phaseId: "p6", memberId: null, type: "cp", start: "2026-10-30", end: "2026-10-30", email: null, name: null, lotName: "  ", domainName: "KLINT" },
  ]);
  it("retient le lot (sans e-mail, avec groupe) ou le membre, jamais les deux", () => {
    expect(out).toHaveLength(3);
    const nic = out.filter((l) => l.memberName === "Nicolas");
    expect(nic.map((l) => l.memberGroup).sort()).toEqual(["Almaviva CX", "Masao"]);
    expect(nic.every((l) => l.memberRef === "")).toBe(true);
    expect(nic[0].id).not.toBe(nic[1].id);
    const zoe = out.find((l) => l.memberName === "Zoé")!;
    expect(zoe.memberRef).toBe("zoe@example.test");
    expect(zoe.memberGroup).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("Autre");
  });
});

describe("diagnostic : types vus", () => {
  it("fusionne à la casse près, trie par effectif, ne contient que code, libellé et effectif", () => {
    const t = buildTypesSeen([
      { code: "cp", label: "Congés payés", count: 12 }, { code: "CP", label: null, count: 3 },
      { code: "rtt", label: "RTT", count: 4 }, { code: "Dev", label: null, count: 40 }, { code: "", label: "x", count: 9 },
      { code: "bad\u0007code", label: "L", count: Number.NaN },
    ]);
    expect(t.map((x) => x.code)).toEqual(["Dev", "cp", "rtt", "bad code"]);
    expect(t[1]).toEqual({ code: "cp", label: "Congés payés", count: 15 });
    expect(t[3].count).toBe(0);
    for (const x of t) expect(Object.keys(x).sort()).toEqual(["code", "count", "label"]);
    expect(buildTypesSeen([])).toEqual([]);
  });
});
