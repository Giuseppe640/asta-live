import { describe, expect, it } from "vitest";
import { computeDemand, type DemandFreePlayer, type DemandTeam } from "./demand";

function freePlayers(n: number, baseLive = 100): DemandFreePlayer[] {
  return Array.from({ length: n }, () => ({ role: "A" as const, fascia: "B" as const, baseLive }));
}

function team(legalMax: number, openSlotsA = 1, roster: DemandTeam["roster"] = []): DemandTeam {
  return { id: crypto.randomUUID(), openSlots: { P: 0, D: 0, C: 0, A: openSlotsA }, legalMax, roster };
}

// §2.5 — tabella "sanity check da testare"
describe("computeDemand — 5 sanity check §2.5", () => {
  it("3 domanda / 7 offerta, budget normali → BASSA, < 1", () => {
    const r = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(7),
      teams: [team(100), team(100), team(100)],
    });
    expect(r.demandLabel).toBe("bassa");
    expect(r.demandMult).toBeLessThan(1);
  });

  it("5 domanda / 5 offerta, budget in linea → ~1", () => {
    const r = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(5),
      teams: Array.from({ length: 5 }, () => team(100)),
    });
    expect(r.demandMult).toBeCloseTo(1, 1);
  });

  it("7 domanda / 3 offerta, budget in linea → ALTA, > 1", () => {
    const r = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(3),
      teams: Array.from({ length: 7 }, () => team(100)),
    });
    expect(r.demandLabel).toBe("alta");
    expect(r.demandMult).toBeGreaterThan(1);
  });

  it("7 domanda / 3 offerta, legal max alti → alta, <= 1.20", () => {
    const r = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(3),
      teams: Array.from({ length: 7 }, () => team(150)),
    });
    expect(r.demandLabel).toBe("alta");
    expect(r.demandMult).toBeGreaterThan(1);
    expect(r.demandMult).toBeLessThanOrEqual(1.2);
  });

  it("2 domanda / 5 offerta, entrambi ricchi → bassa/neutra", () => {
    const r = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(5),
      teams: [team(180), team(180)],
    });
    expect(r.demandMult).toBeLessThanOrEqual(1);
  });
});

describe("computeDemand — casi limite", () => {
  it("demanders = 0 → demand_mult = 0.90, label BASSA", () => {
    const r = computeDemand({ role: "A", fascia: "B", freePlayers: freePlayers(5), teams: [] });
    expect(r.demandMult).toBe(0.9);
    expect(r.demandLabel).toBe("bassa");
  });

  it("demanders = 1 → mediana di un solo legal_max è quel valore, nessun crash", () => {
    const r = computeDemand({ role: "A", fascia: "B", freePlayers: freePlayers(5), teams: [team(120)] });
    expect(r.demanders).toBe(1);
    expect(r.budgetPressure).toBeCloseTo(120 / 100, 6);
    expect(Number.isFinite(r.demandMult)).toBe(true);
  });

  it("demand_mult resta sempre in [0.90, 1.20]", () => {
    const r = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(1, 10),
      teams: Array.from({ length: 50 }, () => team(1000)),
    });
    expect(r.demandMult).toBeGreaterThanOrEqual(0.9);
    expect(r.demandMult).toBeLessThanOrEqual(1.2);
  });

  it("squadra con slot_ruolo = 0 non è demander", () => {
    const r = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(5),
      teams: [team(100, 0), team(100, 1)],
    });
    expect(r.demanders).toBe(1);
  });

  it("squadra con legal_max sotto il pavimento non è demander", () => {
    const r = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(5, 100),
      teams: [team(1), team(100)],
    });
    expect(r.demanders).toBe(1);
  });

  it("'livello già coperto' esclude i demander solo per fascia S/A, non per B/C/D", () => {
    const coveredRoster: DemandTeam["roster"] = [{ role: "A", fasciaSeed: "S" }];
    const rHighFascia = computeDemand({
      role: "A",
      fascia: "S",
      freePlayers: freePlayers(3),
      teams: [team(100, 1, coveredRoster), team(100)],
    });
    expect(rHighFascia.demanders).toBe(1);

    const rLowFascia = computeDemand({
      role: "A",
      fascia: "B",
      freePlayers: freePlayers(3),
      teams: [team(100, 1, coveredRoster), team(100)],
    });
    expect(rLowFascia.demanders).toBe(2);
  });

  it("pavimento_fascia ha un pavimento minimo di 1", () => {
    const r = computeDemand({ role: "A", fascia: "B", freePlayers: [], teams: [team(1)] });
    expect(r.pavimentoFascia).toBe(1);
  });
});
