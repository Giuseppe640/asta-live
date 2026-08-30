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
});
