import { describe, expect, it } from "vitest";
import { ROLES } from "../../lib/constants";
import { buildRosterPriorities } from "./radarLogic";
import { makePlayer, makeTeam, ownedBy } from "../../test/fixtures";

describe("buildRosterPriorities — deterministica, nessuna chiamata AI", () => {
  it("un ruolo mai coperto (roster vuoto) genera sempre una priorità 'DA IMPOSTARE'", () => {
    const me = makeTeam({ id: "me" });
    const free = ROLES.map((r) => makePlayer({ role: r, fascia: "B", fairSeed: 100 }));

    const priorities = buildRosterPriorities(free, [me], "me");

    expect(priorities.length).toBeGreaterThan(0);
    expect(priorities.every((p) => p.title.includes("DA IMPOSTARE"))).toBe(true);
  });

  it("un reparto con tutti gli slot già occupati non genera mai una priorità per quel ruolo", () => {
    const pOwned = Array.from({ length: 3 }, () => ownedBy("me", 20, { role: "P", fascia: "B" }));
    const dOwned = Array.from({ length: 8 }, () => ownedBy("me", 20, { role: "D", fascia: "B" }));
    const aOwned = Array.from({ length: 6 }, () => ownedBy("me", 20, { role: "A", fascia: "B" }));
    const me = makeTeam({ id: "me", roster: [...pOwned, ...dOwned, ...aOwned].map((o) => o.entry) });
    const freeC = [makePlayer({ role: "C", fascia: "B", fairSeed: 100 })];

    const players = [...pOwned, ...dOwned, ...aOwned].map((o) => o.player).concat(freeC);
    const priorities = buildRosterPriorities(players, [me], "me");

    expect(priorities.some((p) => p.role === "P" || p.role === "D" || p.role === "A")).toBe(false);
  });

  it("pochi giocatori liberi rispetto agli slot rimasti (scarsità reale) forza severità 'high'", () => {
    const pOwned = Array.from({ length: 3 }, () => ownedBy("me", 20, { role: "P", fascia: "B" }));
    const dOwned = Array.from({ length: 8 }, () => ownedBy("me", 20, { role: "D", fascia: "B" }));
    const aOwned = Array.from({ length: 6 }, () => ownedBy("me", 20, { role: "A", fascia: "B" }));
    const me = makeTeam({ id: "me", roster: [...pOwned, ...dOwned, ...aOwned].map((o) => o.entry) });
    const freeC = [makePlayer({ role: "C", fascia: "B", fairSeed: 100 }), makePlayer({ role: "C", fascia: "B", fairSeed: 100 })];

    const players = [...pOwned, ...dOwned, ...aOwned].map((o) => o.player).concat(freeC);
    const priorities = buildRosterPriorities(players, [me], "me");

    expect(priorities).toHaveLength(1);
    expect(priorities[0].role).toBe("C");
    expect(priorities[0].severity).toBe("high");
  });

  it("il watch (VOGLIO/OK/NO) sui giocatori liberi non altera mai le priorità calcolate", () => {
    const me = makeTeam({ id: "me" });
    const freeWithoutWatch = ROLES.map((r) => makePlayer({ id: `${r}-free`, role: r, fascia: "B", fairSeed: 100 }));
    const freeWithWatch = freeWithoutWatch.map((p) => ({ ...p, watch: "must" as const }));

    const a = buildRosterPriorities(freeWithoutWatch, [me], "me");
    const b = buildRosterPriorities(freeWithWatch, [me], "me");

    expect(b).toEqual(a);
  });
});
