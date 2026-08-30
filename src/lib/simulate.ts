import { computeBands, type BandInput } from "./bands";
import { computeCapPiano, computeLegalMax, computePersonalMax } from "./budget";
import { PROFILE_QUOTAS, ROLE_SLOTS, ROLES, ROSTER_SIZE, STARTING_BUDGET } from "./constants";
import { computeDemand, type DemandTeam } from "./demand";
import {
  computeConfidence,
  computeFairLive,
  computeFairSeed,
  computeInflationForBucket,
  computeTechnicalAdjustment,
  isNewNoMarket,
  type FairSeedBasis,
} from "./pricing";
import type { Fascia, Role, Starter, Watch } from "../types";

// ---------------------------------------------------------------------------
// Motore di simulazione per il backtest massivo: fa girare un'asta sintetica
// completa (10 squadre × 25 slot) sul motore prezzi/domanda/budget reale
// (stessi src/lib/*.ts usati dall'app), verificando gli invarianti del piano
// dopo OGNI evento. Nessuna logica di prezzo duplicata qui: solo orchestrazione.
// ---------------------------------------------------------------------------

export interface SimPlayerSeed {
  id: string;
  role: Role;
  starter: Starter;
  starterPct: number;
  penalties: 0 | 1 | 2;
  departureRisk?: number;
  isNew: boolean;
  market10x500?: number;
  fvm1000?: number;
}

interface SimPlayer extends SimPlayerSeed {
  fairSeed: number | null;
  basis: FairSeedBasis;
  fascia: Fascia;
  assigned: boolean;
}

interface SimTeam {
  id: string;
  spent: number;
  ownedCount: Record<Role, number>;
  spentByRole: Record<Role, number>;
  roster: { playerId: string; role: Role; fascia: Fascia; price: number }[];
}

export interface Violation {
  run: number;
  iteration: number;
  message: string;
}

export interface RunResult {
  run: number;
  totalAssignments: number;
  demandMults: number[];
  planDeficitEvents: number;
  overpayCount: number;
  extremeOverpayCount: number;
  hitIterationCap: boolean;
  iterations: number;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runSimulation(
  seedPlayers: SimPlayerSeed[],
  numTeams: number,
  seed: number,
  runIndex: number,
  violations: Violation[],
): RunResult {
  const rand = mulberry32(seed);
  let iteration = 0;
  // giocatori che hanno appena rifiutato offerte (nessuno se lo può permettere ora): si
  // evita di richiamarli in loop finché la situazione budget di qualcuno non cambia.
  const stuckIds = new Set<string>();

  const report = (message: string) => violations.push({ run: runIndex, iteration, message });
  const assertFinite = (value: number, label: string) => {
    if (!Number.isFinite(value)) report(`${label} non finito: ${value}`);
  };

  // --- 1. pipeline prezzi, una tantum come da "pack load" (§2.3) ---
  const players: SimPlayer[] = seedPlayers.map((p) => {
    const techAdj = computeTechnicalAdjustment(p, {});
    const { fairSeed, basis } = computeFairSeed({ market10x500: p.market10x500, fvm1000: p.fvm1000 }, techAdj.value);
    return { ...p, fairSeed, basis, fascia: "D", assigned: false };
  });

  // --- 2. fasce, calcolate una sola volta sul pack (§6.2) — mai più ricalcolate ---
  const bandInputs: BandInput[] = players.map((p) => ({ id: p.id, role: p.role, fairSeed: p.fairSeed }));
  const fasciaFrozen = new Map<string, Fascia>();
  for (const b of computeBands(bandInputs)) {
    const p = players.find((pl) => pl.id === b.id)!;
    p.fascia = b.fascia;
    fasciaFrozen.set(b.id, b.fascia);
  }

  const teams: SimTeam[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team-${i}`,
    spent: 0,
    ownedCount: { P: 0, D: 0, C: 0, A: 0 },
    spentByRole: { P: 0, D: 0, C: 0, A: 0 },
    roster: [],
  }));

  const watchByTeamPlayer = new Map<string, Watch>();
  const inflationBuckets = new Map<string, number[]>();
  const bucketKey = (role: Role, fascia: Fascia) => `${role}:${fascia}`;

  const demandMults: number[] = [];
  let planDeficitEvents = 0;
  let overpayCount = 0;
  let extremeOverpayCount = 0;
  let totalAssignments = 0;

  const openSlots = (t: SimTeam): Record<Role, number> => ({
    P: ROLE_SLOTS.P - t.ownedCount.P,
    D: ROLE_SLOTS.D - t.ownedCount.D,
    C: ROLE_SLOTS.C - t.ownedCount.C,
    A: ROLE_SLOTS.A - t.ownedCount.A,
  });
  const slotsLeftTotal = (t: SimTeam) => Object.values(openSlots(t)).reduce((a, b) => a + b, 0);
  const remaining = (t: SimTeam) => STARTING_BUDGET - t.spent;
  const watchFor = (teamId: string, playerId: string): Watch | undefined => {
    const key = `${teamId}:${playerId}`;
    let w = watchByTeamPlayer.get(key);
    if (w === undefined) {
      const roll = rand();
      w = roll < 0.15 ? "must" : roll < 0.2 ? "no" : "ok";
      watchByTeamPlayer.set(key, w);
    }
    return w === "ok" ? undefined : w;
  };

  const targetAssignments = numTeams * ROSTER_SIZE;
  const maxIterations = targetAssignments * 20; // ampio margine anti-loop, vedi note nel test
  let hitIterationCap = false;

  while (true) {
    iteration += 1;
    if (iteration > maxIterations) {
      hitIterationCap = true;
      break;
    }

    const activeTeams = teams.filter((t) => t.roster.length < ROSTER_SIZE);
    if (activeTeams.length === 0) break;

    const rolesNeeded = ROLES.filter((r) => activeTeams.some((t) => openSlots(t)[r] > 0));
    if (rolesNeeded.length === 0) break;

    const role = rolesNeeded[Math.floor(rand() * rolesNeeded.length)];
    const freeInRole = players.filter((p) => !p.assigned && p.role === role);
    if (freeInRole.length === 0) {
      const otherRoleHasSupplyAndDemand = ROLES.some(
        (r) => r !== role && activeTeams.some((t) => openSlots(t)[r] > 0) && players.some((p) => !p.assigned && p.role === r),
      );
      if (!otherRoleHasSupplyAndDemand) break;
      continue;
    }

    // ordine "da tavolo": i migliori tendono a uscire prima, con un po' di rumore.
    // Chi ha appena rifiutato offerte si scarta finché non è l'unica opzione rimasta nel ruolo:
    // se anche il pool intero è già stato rifiutato da tutti, siamo in un vero fondo lista.
    const notStuck = freeInRole.filter((p) => !stuckIds.has(p.id));
    const bottomOfList = notStuck.length === 0;
    const candidatePool = bottomOfList ? freeInRole : notStuck;
    candidatePool.sort((a, b) => (b.fairSeed ?? 0) - (a.fairSeed ?? 0));
    const poolSize = Math.min(8, candidatePool.length);
    const called = candidatePool[Math.floor(rand() * poolSize)];

    const bucket = bucketKey(role, called.fascia);
    const paidRatios = inflationBuckets.get(bucket) ?? [];
    const inflationResult = computeInflationForBucket(paidRatios);

    const confidence = computeConfidence({
      basis: called.basis,
      market1000: called.market10x500 != null ? called.market10x500 * 2 : undefined,
      fvm1000: called.fvm1000,
      comparableCountInBucket: paidRatios.length,
      departureRisk: called.departureRisk,
      starter: called.starter,
      newNoMarket: isNewNoMarket(called, called),
    });
    assertFinite(confidence, "confidence");
    if (confidence < 0 || confidence > 100) report(`confidence fuori range 0-100: ${confidence}`);

    const freeComparables = players
      .filter((p) => !p.assigned && p.id !== called.id && p.role === role)
      .map((p) => {
        const pRatios = inflationBuckets.get(bucketKey(p.role, p.fascia)) ?? [];
        const pInfl = computeInflationForBucket(pRatios);
        return { role: p.role, fascia: p.fascia, baseLive: (p.fairSeed ?? 0) * pInfl.inflationLive };
      });

    const demandTeams: DemandTeam[] = activeTeams.map((t) => ({
      id: t.id,
      openSlots: openSlots(t),
      legalMax: computeLegalMax(remaining(t), slotsLeftTotal(t)),
      roster: t.roster.map((r) => ({ role: r.role, fasciaSeed: r.fascia })),
    }));

    const demandResult = computeDemand({ role, fascia: called.fascia, teams: demandTeams, freePlayers: freeComparables });
    demandMults.push(demandResult.demandMult);
    if (demandResult.demandMult < 0.9 - 1e-9 || demandResult.demandMult > 1.2 + 1e-9) {
      report(`demand_mult fuori clamp [0.90,1.20]: ${demandResult.demandMult}`);
    }

    let fairLive: number | null = null;
    if (called.fairSeed != null) {
      fairLive = computeFairLive(called.fairSeed, inflationResult.inflationLive, demandResult.demandMult).fairLive;
      const lo = 0.7 * called.fairSeed;
      const hi = 1.35 * called.fairSeed;
      if (fairLive < lo - 1e-6 || fairLive > hi + 1e-6) {
        report(`fair_live fuori clamp [0.70x,1.35x] seed: ${fairLive} non in [${lo},${hi}]`);
      }
    }

    const bids: { teamId: string; amount: number }[] = [];
    for (const t of activeTeams) {
      if (openSlots(t)[role] <= 0) continue;
      const legalMax = computeLegalMax(remaining(t), slotsLeftTotal(t));
      if (legalMax < 1) continue;

      const capResult = computeCapPiano({
        nominal: PROFILE_QUOTAS.balanced_md,
        spent: t.spentByRole,
        slots: ROLE_SLOTS,
        ownedCount: t.ownedCount,
      });

      const watch = watchFor(t.id, called.id);
      const pm = computePersonalMax({ legalMax, fairLive, capPiano: capResult.capPiano[role], watch });
      assertFinite(pm.personalMax, "personalMax");
      if (pm.personalMax > legalMax) {
        report(`personalMax (${pm.personalMax}) supera legalMax (${legalMax}) per ${t.id} [watch=${watch}]`);
      }
      if (pm.personalMax > 0) {
        // il grosso dei rilanci resta vicino al personalMax; una piccola quota simula la
        // "frenesia da tavolo" e spinge oltre la soglia di extreme_overpay (§2.9), per
        // verificare che il resto del motore regga anche quando qualcuno esagera.
        const frenzy = rand() < 0.04;
        const noiseFactor = frenzy ? 1.15 + rand() * 0.25 : 0.94 + rand() * 0.12;
        const noisy = Math.max(1, Math.round(pm.personalMax * noiseFactor));
        bids.push({ teamId: t.id, amount: Math.min(noisy, legalMax) });
      }
    }

    if (bids.length === 0 && bottomOfList) {
      // fondo lista: anche riprovando l'intero pool nessuno fa un'offerta (tipicamente più
      // "no" in watchlist che candidati liberi). Come al tavolo vero, qualcuno se lo prende
      // per il minimo pur di chiudere lo slot, invece di restare bloccati all'infinito.
      const forcedTeam = activeTeams.find(
        (t) => openSlots(t)[role] > 0 && computeLegalMax(remaining(t), slotsLeftTotal(t)) >= 1,
      );
      if (forcedTeam) bids.push({ teamId: forcedTeam.id, amount: 1 });
    }

    if (bids.length === 0) {
      stuckIds.add(called.id);
      continue; // nessuno vuole/può pagare adesso: il giocatore resta libero, si passa oltre
    }

    bids.sort((a, b) => b.amount - a.amount);
    const winner = bids[0];
    const secondPrice = bids.length > 1 ? bids[1].amount : 1;
    const price = Math.max(1, Math.min(winner.amount, secondPrice + 1));

    const winnerTeam = teams.find((t) => t.id === winner.teamId)!;
    const legalMaxAtPurchase = computeLegalMax(remaining(winnerTeam), slotsLeftTotal(winnerTeam));
    if (price > legalMaxAtPurchase) {
      report(`prezzo pagato (${price}) supera legal_max (${legalMaxAtPurchase}) al momento dell'acquisto`);
    }

    const winnerCapBefore = computeCapPiano({
      nominal: PROFILE_QUOTAS.balanced_md,
      spent: winnerTeam.spentByRole,
      slots: ROLE_SLOTS,
      ownedCount: winnerTeam.ownedCount,
    });
    const winnerPm = computePersonalMax({
      legalMax: legalMaxAtPurchase,
      fairLive,
      capPiano: winnerCapBefore.capPiano[role],
      watch: watchFor(winnerTeam.id, called.id),
    });
    if (price > winnerPm.personalMax) overpayCount += 1;
    const fairBound = fairLive != null ? fairLive * 1.2 : Number.NEGATIVE_INFINITY;
    if (price > Math.max(winnerPm.personalMax * 1.1, fairBound)) extremeOverpayCount += 1;

    called.assigned = true;
    winnerTeam.spent += price;
    winnerTeam.ownedCount[role] += 1;
    winnerTeam.spentByRole[role] += price;
    winnerTeam.roster.push({ playerId: called.id, role, fascia: called.fascia, price });
    totalAssignments += 1;
    stuckIds.clear(); // i budget sono cambiati: chi era irraggiungibile potrebbe non esserlo più

    if (called.fairSeed != null && called.fairSeed > 0) {
      const arr = inflationBuckets.get(bucket) ?? [];
      arr.push(price / called.fairSeed);
      inflationBuckets.set(bucket, arr);
    }

    for (const t of teams) {
      const sl = slotsLeftTotal(t);
      if (sl > 0 && remaining(t) < sl) {
        report(`squadra ${t.id} non può più chiudere la rosa: remaining=${remaining(t)} < slot rimasti=${sl}`);
      }
      if (t.spent > STARTING_BUDGET) {
        report(`squadra ${t.id} ha speso oltre il budget: ${t.spent}`);
      }
    }

    const capAfter = computeCapPiano({
      nominal: PROFILE_QUOTAS.balanced_md,
      spent: winnerTeam.spentByRole,
      slots: ROLE_SLOTS,
      ownedCount: winnerTeam.ownedCount,
    });
    if (capAfter.requiresReallocation) planDeficitEvents += 1;
  }

  for (const p of players) {
    if (fasciaFrozen.get(p.id) !== p.fascia) {
      report(`fascia di ${p.id} cambiata durante l'asta: ${fasciaFrozen.get(p.id)} -> ${p.fascia}`);
    }
  }

  return {
    run: runIndex,
    totalAssignments,
    demandMults,
    planDeficitEvents,
    overpayCount,
    extremeOverpayCount,
    hitIterationCap,
    iterations: iteration,
  };
}
