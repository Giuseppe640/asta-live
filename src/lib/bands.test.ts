import { describe, expect, it } from "vitest";
import { computeBands, type BandInput } from "./bands";

function playersA(values: number[]): BandInput[] {
  return values.map((v, i) => ({ id: `A${i}-${v}`, role: "A" as const, fairSeed: v }));
}

describe("computeBands — §6.2 percentili del fair seed", () => {
  it("assegna S/A/B/C/D secondo i percentili P90/P70/P40/P15 su un set di 10 valori noti", () => {
    const results = computeBands(playersA([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]));
    const byId = new Map(results.map((r) => [r.id, r.fascia]));

    expect(byId.get("A9-100")).toBe("S");
    expect(byId.get("A8-90")).toBe("A");
    expect(byId.get("A7-80")).toBe("A");
    expect(byId.get("A6-70")).toBe("B");
    expect(byId.get("A5-60")).toBe("B");
    expect(byId.get("A4-50")).toBe("B");
    expect(byId.get("A3-40")).toBe("C");
    expect(byId.get("A2-30")).toBe("C");
    expect(byId.get("A1-20")).toBe("D");
    expect(byId.get("A0-10")).toBe("D");
  });

  it("senza fair_seed → fascia D provvisoria + fasciaUncertain", () => {
    const results = computeBands([{ id: "x", role: "A", fairSeed: null }]);
    expect(results[0].fascia).toBe("D");
    expect(results[0].fasciaUncertain).toBe(true);
  });

  it("fasciaOverride persistente vince sempre sul calcolo automatico", () => {
    const results = computeBands([{ id: "x", role: "A", fairSeed: 100, fasciaOverride: "D" }]);
    expect(results[0].fascia).toBe("D");
  });

  it("i ruoli sono bucket indipendenti: un P non altera i percentili degli A", () => {
    const input: BandInput[] = [
      ...playersA([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
      { id: "p1", role: "P", fairSeed: 1000 },
    ];
    const results = computeBands(input);
    const a100 = results.find((r) => r.id === "A9-100");
    expect(a100?.fascia).toBe("S"); // non trascinato verso il basso dal P a 1000
  });

  it("invarianza: stesso pack in input → stesso output, run ripetuti (nessun ricalcolo 'silenzioso')", () => {
    const input = playersA([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const first = computeBands(input);
    const second = computeBands(input);
    expect(second).toEqual(first);
  });

  it("un grosso gruppo di riserve tutte con lo stesso fair_seed di pavimento resta in D, non finisce in B/C insieme ai titolari (bug reale sui portieri di riserva: molti condividono lo stesso FVM minimo, che coincide con p40/p15 e con >= finirebbe promosso)", () => {
    // 6 riserve tutte a 1 (pavimento) + 4 titolari via via più forti: p40 e p15 cadono
    // esattamente dentro il gruppo di riserve, quindi il confronto stretto è decisivo.
    const floor = Array(6).fill(1);
    const starters = [10, 30, 60, 100];
    const results = computeBands(playersA([...floor, ...starters]));
    const byId = new Map(results.map((r) => [r.id, r.fascia]));

    for (let i = 0; i < floor.length; i++) {
      expect(byId.get(`A${i}-1`)).toBe("D");
    }
    expect(byId.get("A9-100")).toBe("S");
  });
});
