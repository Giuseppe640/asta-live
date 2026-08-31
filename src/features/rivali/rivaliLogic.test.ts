import { describe, expect, it } from "vitest";
import { computePressureLevel, computeRivalSummaries, computeRoleFasciaDemand } from "./rivaliLogic";
import { makePlayer, makeTeam, ownedBy } from "../../test/fixtures";

describe("computeRivalSummaries", () => {
  it("esclude la squadra dell'utente e calcola gli slot aperti delle altre", () => {
    const me = makeTeam({ id: "me" });
    const { player, entry } = ownedBy("rival", 50, { role: "A", fascia: "B" });
    const rival = makeTeam({ id: "rival", roster: [entry] });

    const summaries = computeRivalSummaries([me, rival], [player], "me");

    expect(summaries).toHaveLength(1);
    expect(summaries[0].teamId).toBe("rival");
    expect(summaries[0].openSlots).toEqual({ P: 3, D: 8, C: 8, A: 5 });
    expect(summaries[0].bestFasciaByRole.A).toBe("B");
  });
});

describe("computeRoleFasciaDemand — riusa computeDemand/buildDemandTeams, nessun motore nuovo", () => {
  it("una squadra con il ruolo già pieno non viene mai contata come demander", () => {
    const fullOwned = Array.from({ length: 6 }, () => ownedBy("full", 100, { role: "A", fascia: "B" }));
    const full = makeTeam({ id: "full", roster: fullOwned.map((o) => o.entry) });
    const open = makeTeam({ id: "open" });
    const free = [makePlayer({ role: "A", fascia: "B", fairSeed: 100 }), makePlayer({ role: "A", fascia: "B", fairSeed: 100 })];

    const players = [...fullOwned.map((o) => o.player), ...free];
    const result = computeRoleFasciaDemand(players, [full, open], "A", "B");

    expect(result.demanderTeamIds).toEqual(["open"]);
    expect(result.demanders).toBe(1);
  });

  it("è deterministica: stesso stato in ingresso produce sempre lo stesso DemandBreakdown", () => {
    const free = [makePlayer({ role: "A", fascia: "B", fairSeed: 120 }), makePlayer({ role: "A", fascia: "B", fairSeed: 90 })];
    const team = makeTeam({ id: "t1" });

    const r1 = computeRoleFasciaDemand(free, [team], "A", "B");
    const r2 = computeRoleFasciaDemand(free, [team], "A", "B");

    expect(r2).toEqual(r1);
  });
});

describe("computePressureLevel — solo descrittivo, non un moltiplicatore su fairLive", () => {
  it("una squadra non demander è sempre 'bassa', qualunque sia il budget", () => {
    expect(computePressureLevel(1000, false, 50)).toBe("bassa");
  });

  it("demander con legalMax >= 2x il pavimento di fascia → 'alta'", () => {
    expect(computePressureLevel(200, true, 100)).toBe("alta");
  });

  it("demander con legalMax tra 1.2x e 2x il pavimento → 'media'", () => {
    expect(computePressureLevel(150, true, 100)).toBe("media");
  });

  it("demander con legalMax appena sopra il pavimento → 'bassa'", () => {
    expect(computePressureLevel(105, true, 100)).toBe("bassa");
  });
});
