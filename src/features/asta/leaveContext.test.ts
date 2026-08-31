import { describe, expect, it } from "vitest";
import { getLeavePlayerContext } from "./leaveContext";
import { makePlayer, makeTeam } from "../../test/fixtures";

describe("getLeavePlayerContext — §10-11: solo informativo, non tocca personalMax/fairLive del chiamato", () => {
  it("i comparabili sono dello stesso ruolo, fascia pari o una sotto, ordinati per fair_seed decrescente", () => {
    const target = makePlayer({ id: "target", role: "A", fascia: "B", fairSeed: 200 });
    const sameFasciaHigher = makePlayer({ id: "c1", role: "A", fascia: "B", fairSeed: 250 });
    const oneBelow = makePlayer({ id: "c2", role: "A", fascia: "C", fairSeed: 150 });
    const twoBelow = makePlayer({ id: "c3", role: "A", fascia: "D", fairSeed: 50 });
    const me = makeTeam({ id: "me" });

    const ctx = getLeavePlayerContext("target", [target, sameFasciaHigher, oneBelow, twoBelow], [me], "me");

    expect(ctx).not.toBeNull();
    expect(ctx!.comparablePlayers.map((c) => c.playerId)).toEqual(["c1", "c2"]);
  });

  it("esclude dai comparabili i giocatori già assegnati", () => {
    const target = makePlayer({ id: "target", role: "A", fascia: "B", fairSeed: 200 });
    const free = makePlayer({ id: "free1", role: "A", fascia: "B", fairSeed: 150 });
    const taken = makePlayer({ id: "taken", role: "A", fascia: "B", fairSeed: 300, assignedTo: "rival", price: 100 });
    const me = makeTeam({ id: "me" });
    const rival = makeTeam({ id: "rival", roster: [{ playerId: "taken", price: 100 }] });

    const ctx = getLeavePlayerContext("target", [target, free, taken], [me, rival], "me");

    expect(ctx!.comparablePlayers.map((c) => c.playerId)).toEqual(["free1"]);
  });

  it("un giocatore di un altro ruolo non è mai un comparabile, anche a parità/superiorità di fascia", () => {
    const target = makePlayer({ id: "target", role: "A", fascia: "B", fairSeed: 200 });
    const otherRole = makePlayer({ id: "d1", role: "D", fascia: "B", fairSeed: 500 });
    const me = makeTeam({ id: "me" });

    const ctx = getLeavePlayerContext("target", [target, otherRole], [me], "me");

    expect(ctx!.comparablePlayers).toHaveLength(0);
  });

  it("con 0-1 comparabili la scarsità è 'high' e il messaggio lo segnala esplicitamente", () => {
    const target = makePlayer({ id: "target", role: "A", fascia: "B", fairSeed: 200 });
    const only = makePlayer({ id: "c1", role: "A", fascia: "B", fairSeed: 150 });
    const me = makeTeam({ id: "me" });

    const ctx = getLeavePlayerContext("target", [target, only], [me], "me");

    expect(ctx!.comparableCount).toBe(1);
    expect(ctx!.scarcity).toBe("high");
    expect(ctx!.message.toLowerCase()).toContain("solo 1 giocatore");
  });

  it("con 2-3 comparabili la scarsità è 'medium'", () => {
    const target = makePlayer({ id: "target", role: "A", fascia: "B", fairSeed: 200 });
    const comparables = [makePlayer({ id: "c1", role: "A", fascia: "B", fairSeed: 150 }), makePlayer({ id: "c2", role: "A", fascia: "B", fairSeed: 140 })];
    const me = makeTeam({ id: "me" });

    const ctx = getLeavePlayerContext("target", [target, ...comparables], [me], "me");

    expect(ctx!.comparableCount).toBe(2);
    expect(ctx!.scarcity).toBe("medium");
  });

  it("con molti comparabili e poche squadre interessate la scarsità è 'low'", () => {
    const target = makePlayer({ id: "target", role: "A", fascia: "B", fairSeed: 200 });
    const comparables = Array.from({ length: 6 }, (_, i) => makePlayer({ id: `c${i}`, role: "A", fascia: "B", fairSeed: 100 + i }));
    const me = makeTeam({ id: "me" });

    const ctx = getLeavePlayerContext("target", [target, ...comparables], [me], "me");

    expect(ctx!.comparableCount).toBe(6);
    expect(ctx!.scarcity).toBe("low");
  });
});
