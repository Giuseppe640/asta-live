import { describe, expect, it } from "vitest";
import rawPlayers from "../data/players.2026-09-01.json";
import { runSimulation, type RunResult, type SimPlayerSeed, type Violation } from "./simulate";
import { NUM_TEAMS, ROSTER_SIZE } from "./constants";

// ---------------------------------------------------------------------------
// Backtest massivo — piano §10 "Fase 5 Prova": qui al posto di 20 chiamate
// reali + 30-50 sintetiche facciamo girare N aste sintetiche complete
// (10 squadre × 25 slot) sul dataset seed, verificando ad ogni assegnazione
// che tutti gli invarianti del piano tengano. Obiettivo: 0 violazioni.
// ---------------------------------------------------------------------------

const NUM_RUNS = 80;

// niente Math.min(...arr)/Math.max(...arr): con array a 5-6 cifre lo spread supera
// il limite di argomenti dello stack di V8.
function minOf(values: number[]): number {
  return values.reduce((a, b) => (b < a ? b : a), Number.POSITIVE_INFINITY);
}
function maxOf(values: number[]): number {
  return values.reduce((a, b) => (b > a ? b : a), Number.NEGATIVE_INFINITY);
}

const seedPlayers: SimPlayerSeed[] = (rawPlayers as any[]).map((p) => ({
  id: p.id,
  role: p.role,
  starter: p.starter,
  starterPct: p.starterPct,
  penalties: p.penalties,
  departureRisk: p.departureRisk,
  isNew: p.isNew,
  market10x500: p.sourceSnapshot?.market10x500,
  fvm1000: p.sourceSnapshot?.fvm1000,
}));

describe(`backtest massivo — ${NUM_RUNS} aste sintetiche complete`, () => {
  const violations: Violation[] = [];
  const results: RunResult[] = [];

  for (let i = 0; i < NUM_RUNS; i += 1) {
    results.push(runSimulation(seedPlayers, NUM_TEAMS, 42_000 + i * 7919, i, violations));
  }

  it("nessun dataset vuoto: il pack ha abbastanza giocatori per 10 rose complete", () => {
    expect(seedPlayers.length).toBeGreaterThanOrEqual(NUM_TEAMS * ROSTER_SIZE);
  });

  it("zero violazioni di invarianti su tutte le aste simulate", () => {
    if (violations.length > 0) {
      const sample = violations.slice(0, 20).map((v) => `run ${v.run} @${v.iteration}: ${v.message}`).join("\n");
      console.error(`Violazioni (${violations.length} totali, prime 20):\n${sample}`);
    }
    expect(violations).toEqual([]);
  });

  it("nessuna run va in loop-guard (deadlock strutturale)", () => {
    const stuck = results.filter((r) => r.hitIterationCap);
    expect(stuck).toEqual([]);
  });

  it("ogni asta completa (quasi) tutte le 250 assegnazioni previste", () => {
    for (const r of results) {
      expect(r.totalAssignments).toBeGreaterThanOrEqual(NUM_TEAMS * ROSTER_SIZE - 10);
    }
    const avg = results.reduce((s, r) => s + r.totalAssignments, 0) / results.length;
    expect(avg).toBeGreaterThanOrEqual(NUM_TEAMS * ROSTER_SIZE - 2);
  });

  it("il backtest esercita davvero overpay ed extreme_overpay, non solo il percorso pulito", () => {
    const totalOverpay = results.reduce((s, r) => s + r.overpayCount, 0);
    const totalExtremeOverpay = results.reduce((s, r) => s + r.extremeOverpayCount, 0);
    expect(totalOverpay).toBeGreaterThan(0);
    expect(totalExtremeOverpay).toBeGreaterThan(0);
  });

  it("demand_mult copre sia regime di domanda bassa che alta nell'aggregato (formula reattiva, non piatta)", () => {
    const all = results.flatMap((r) => r.demandMults);
    expect(all.length).toBeGreaterThan(1000);
    expect(minOf(all)).toBeLessThan(0.98);
    expect(maxOf(all)).toBeGreaterThan(1.08);
    for (const m of all) {
      expect(m).toBeGreaterThanOrEqual(0.9);
      expect(m).toBeLessThanOrEqual(1.2);
    }
  });

  it("stampa un riepilogo aggregato leggibile del backtest", () => {
    const totalAssignments = results.reduce((s, r) => s + r.totalAssignments, 0);
    const totalPlanDeficit = results.reduce((s, r) => s + r.planDeficitEvents, 0);
    const totalOverpay = results.reduce((s, r) => s + r.overpayCount, 0);
    const totalExtremeOverpay = results.reduce((s, r) => s + r.extremeOverpayCount, 0);
    const allDemand = results.flatMap((r) => r.demandMults);
    const avgDemand = allDemand.reduce((a, b) => a + b, 0) / allDemand.length;

    console.log(
      [
        "=== Backtest massivo — riepilogo ===",
        `run: ${NUM_RUNS}, assegnazioni totali: ${totalAssignments} (media ${(totalAssignments / NUM_RUNS).toFixed(1)}/run su ${NUM_TEAMS * ROSTER_SIZE})`,
        `demand_mult: min ${minOf(allDemand).toFixed(3)} · media ${avgDemand.toFixed(3)} · max ${maxOf(allDemand).toFixed(3)}`,
        `eventi con plan_deficit (profilo custom): ${totalPlanDeficit}`,
        `overpay: ${totalOverpay} · extreme_overpay: ${totalExtremeOverpay}`,
        `violazioni invarianti: ${violations.length}`,
      ].join("\n"),
    );
    expect(true).toBe(true);
  });
});
