import { describe, expect, it } from "vitest";
import { computeMdIndex, defenseModifierBonus } from "./modifier";

describe("defenseModifierBonus — tabella regolamento 0→+7", () => {
  it.each([
    [5.99, 0],
    [6.0, 1],
    [6.24, 1],
    [6.25, 2],
    [6.49, 2],
    [6.5, 3],
    [6.74, 3],
    [6.75, 4],
    [6.99, 4],
    [7.0, 5],
    [7.24, 5],
    [7.25, 6],
    [7.49, 6],
    [7.5, 7],
    [8.0, 7],
  ])("media %f → bonus %i", (avg, expected) => {
    expect(defenseModifierBonus(avg)).toBe(expected);
  });
});

describe("computeMdIndex — §6.4", () => {
  it("pesa 0.65 voto atteso + 0.35 starterPct", () => {
    expect(computeMdIndex(100, 100)).toBe(100);
    expect(computeMdIndex(0, 0)).toBe(0);
    expect(computeMdIndex(80, 60)).toBeCloseTo(0.65 * 80 + 0.35 * 60, 6);
  });

  it("clampa 0-100 anche con input fuori range", () => {
    expect(computeMdIndex(150, 150)).toBe(100);
    expect(computeMdIndex(-50, -50)).toBe(0);
  });
});
