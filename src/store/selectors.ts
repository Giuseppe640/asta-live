import { computeBands } from "../lib/bands";
import { computeCapPiano, computeLegalMax, computePersonalMax, isExtremeOverpay, isOverpay, isRosterUnclosable } from "../lib/budget";
import { PROFILE_QUOTAS, ROLE_SLOTS, ROLES, ROSTER_SIZE, STARTING_BUDGET } from "../lib/constants";
import { computeDemand, type DemandFreePlayer, type DemandTeam } from "../lib/demand";
import { computeDisplayRange, computeFairLive, computeInflationForBucket } from "../lib/pricing";
import type { UpdatePack } from "./updatePack";
import type { AuctionEvent, FantasyTeam, Fascia, Player, Role, TeamProfile } from "../types";

export function bucketKey(role: Role, fascia: Fascia): string {
  return `${role}:${fascia}`;
}

/** Ricostruisce i bucket di inflazione (§2.4) dai prezzi pagati, letti dai giocatori assegnati. È derivato, mai stato a parte. */
export function computeMarketBuckets(players: Player[]): Map<string, ReturnType<typeof computeInflationForBucket>> {
  const ratiosByBucket = new Map<string, number[]>();
  for (const p of players) {
    if (p.assignedTo == null || p.price == null) continue;
    const seed = p.pricing.fairSeed;
    if (seed == null || seed <= 0) continue;
    const key = bucketKey(p.role, p.fascia);
    const arr = ratiosByBucket.get(key) ?? [];
    arr.push(p.price / seed);
    ratiosByBucket.set(key, arr);
  }
  const result = new Map<string, ReturnType<typeof computeInflationForBucket>>();
  for (const [key, ratios] of ratiosByBucket) {
    result.set(key, computeInflationForBucket(ratios));
  }
  return result;
}

function inflationLiveFor(buckets: Map<string, ReturnType<typeof computeInflationForBucket>>, role: Role, fascia: Fascia): number {
  return buckets.get(bucketKey(role, fascia))?.inflationLive ?? 1;
}

export interface TeamBudgetInfo {
  ownedCount: Record<Role, number>;
  spentByRole: Record<Role, number>;
  spent: number;
  remaining: number;
  slotsLeftTotal: number;
  legalMax: number;
  capPiano: ReturnType<typeof computeCapPiano>;
  rosterUnclosable: boolean;
}

export function computeTeamBudget(team: FantasyTeam, players: Player[]): TeamBudgetInfo {
  const ownedCount: Record<Role, number> = { P: 0, D: 0, C: 0, A: 0 };
  const spentByRole: Record<Role, number> = { P: 0, D: 0, C: 0, A: 0 };
  const byId = new Map(players.map((p) => [p.id, p]));

  for (const entry of team.roster) {
    const player = byId.get(entry.playerId);
    if (!player) continue;
    ownedCount[player.role] += 1;
    spentByRole[player.role] += entry.price;
  }

  const spent = team.roster.reduce((s, r) => s + r.price, 0);
  const remaining = STARTING_BUDGET - spent;
  const slotsLeftTotal = ROLES.reduce((s, r) => s + (ROLE_SLOTS[r] - ownedCount[r]), 0);
  const legalMax = computeLegalMax(remaining, slotsLeftTotal);

  const nominal = team.profile === "custom" ? PROFILE_QUOTAS.balanced_md : PROFILE_QUOTAS[team.profile];
  const capPiano = computeCapPiano({ nominal, spent: spentByRole, slots: ROLE_SLOTS, ownedCount });

  return {
    ownedCount,
    spentByRole,
    spent,
    remaining,
    slotsLeftTotal,
    legalMax,
    capPiano,
    rosterUnclosable: isRosterUnclosable(legalMax, slotsLeftTotal),
  };
}

/** Converte squadre+giocatori nel formato che `computeDemand` (lib/demand.ts) si aspetta. Condiviso da ogni chiamante (prezzo live, Rivali, Radar) per non duplicare la logica. */
export function buildDemandTeams(players: Player[], teams: FantasyTeam[]): DemandTeam[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return teams.map((t) => {
    const budget = computeTeamBudget(t, players);
    return {
      id: t.id,
      openSlots: {
        P: ROLE_SLOTS.P - budget.ownedCount.P,
        D: ROLE_SLOTS.D - budget.ownedCount.D,
        C: ROLE_SLOTS.C - budget.ownedCount.C,
        A: ROLE_SLOTS.A - budget.ownedCount.A,
      },
      legalMax: budget.legalMax,
      roster: t.roster
        .map((r) => byId.get(r.playerId))
        .filter((p): p is Player => p != null)
        .map((p) => ({ role: p.role, fasciaSeed: p.fascia })),
    };
  });
}

export interface LivePricing {
  fairSeed: number | null;
  fascia: Fascia;
  confidence: number;
  inflationLive: number;
  demand: ReturnType<typeof computeDemand>;
  fairLive: number | null;
  displayRange: { low: number; high: number } | null;
  personalMax: number;
  capPianoRole: number;
  legalMax: number;
  overpay: boolean;
  extremeOverpay: boolean;
}

/** Prezzo "live" di un giocatore ancora libero, calcolato rispetto alla squadra `forTeamId` (di norma la nostra). */
export function computeLivePricing(
  players: Player[],
  teams: FantasyTeam[],
  playerId: string,
  forTeamId: string,
): LivePricing | null {
  const player = players.find((p) => p.id === playerId);
  const forTeam = teams.find((t) => t.id === forTeamId);
  if (!player || !forTeam) return null;

  const buckets = computeMarketBuckets(players);
  const inflationLive = inflationLiveFor(buckets, player.role, player.fascia);

  const freePlayers: DemandFreePlayer[] = players
    .filter((p) => p.assignedTo == null && p.id !== playerId && p.role === player.role)
    .map((p) => ({
      role: p.role,
      fascia: p.fascia,
      baseLive: (p.pricing.fairSeed ?? 0) * inflationLiveFor(buckets, p.role, p.fascia),
    }));

  const demandTeams = buildDemandTeams(players, teams);

  const demand = computeDemand({ role: player.role, fascia: player.fascia, teams: demandTeams, freePlayers });

  let fairLive: number | null = null;
  let displayRange: { low: number; high: number } | null = null;
  if (player.pricing.fairSeed != null) {
    fairLive = computeFairLive(player.pricing.fairSeed, inflationLive, demand.demandMult).fairLive;
    if (player.pricing.confidence < 50) {
      displayRange = computeDisplayRange(fairLive, player.pricing.confidence);
    }
  }

  const forTeamBudget = computeTeamBudget(forTeam, players);
  const capPianoRole = forTeamBudget.capPiano.capPiano[player.role];
  const { personalMax } = computePersonalMax({
    legalMax: forTeamBudget.legalMax,
    fairLive,
    capPiano: capPianoRole,
    watch: player.watch,
  });

  const referencePrice = player.price ?? personalMax;
  const overpay = isOverpay(referencePrice, personalMax);
  const extremeOverpay = isExtremeOverpay(referencePrice, personalMax, fairLive);

  return {
    fairSeed: player.pricing.fairSeed,
    fascia: player.fascia,
    confidence: player.pricing.confidence,
    inflationLive,
    demand,
    fairLive,
    displayRange,
    personalMax,
    capPianoRole,
    legalMax: forTeamBudget.legalMax,
    overpay,
    extremeOverpay,
  };
}

export interface RecentPick {
  eventId: string;
  playerId: string;
  playerName: string;
  role: Role;
  teamId: string;
  teamName: string;
  teamColor: string;
  price: number;
  createdAt: number;
}

/**
 * Ultime aggiudicazioni per il feed live. Scorre `events` all'indietro (append-only, già in
 * ordine cronologico inverso) e tiene solo gli eventi che coincidono ancora con l'assegnazione
 * *attuale* del giocatore — un assign poi annullato o superato da un resolve_conflict non deve
 * restare in feed, sarebbe fuorviante durante un'asta live.
 */
export function computeRecentPicks(players: Player[], teams: FantasyTeam[], events: AuctionEvent[], limit = 20): RecentPick[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const picks: RecentPick[] = [];

  for (let i = events.length - 1; i >= 0 && picks.length < limit; i -= 1) {
    const event = events[i];
    if (event.type !== "assign" && event.type !== "resolve_conflict") continue;
    if (!event.playerId || !event.teamId || event.price == null) continue;

    const player = playerById.get(event.playerId);
    if (!player || player.assignedTo !== event.teamId || player.price !== event.price) continue;

    const team = teamById.get(event.teamId);
    picks.push({
      eventId: event.id,
      playerId: event.playerId,
      playerName: player.name,
      role: player.role,
      teamId: event.teamId,
      teamName: team?.name ?? event.teamId,
      teamColor: team?.color ?? "#71717a",
      price: event.price,
      createdAt: event.createdAt,
    });
  }

  return picks;
}

export function recomputeBandsInPlace(players: Player[]): Player[] {
  const results = computeBands(
    players.map((p) => ({ id: p.id, role: p.role, fairSeed: p.pricing.fairSeed, fasciaOverride: p.fasciaOverride, starter: p.starter })),
  );
  const byId = new Map(results.map((r) => [r.id, r]));
  return players.map((p) => {
    const r = byId.get(p.id);
    if (!r) return p;
    return { ...p, fascia: r.fascia, fasciaUncertain: r.fasciaUncertain };
  });
}

export function defaultNominalForProfile(profile: TeamProfile) {
  return profile === "custom" ? PROFILE_QUOTAS.balanced_md : PROFILE_QUOTAS[profile];
}

export type DataHealthLevel = "good" | "medium" | "low";

export interface DataHealthField {
  label: string;
  covered: number;
  total: number;
  level: DataHealthLevel;
}

export interface DataHealth {
  total: number;
  fields: DataHealthField[];
  lastUpdate: string | null;
}

function healthLevel(covered: number, total: number): DataHealthLevel {
  const ratio = total > 0 ? covered / total : 0;
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.3) return "medium";
  return "low";
}

/**
 * §12-13 del prompt Radar/Rivali: copertura *reale* del dataset, non proprietà TypeScript
 * valorizzate con default. Titolarità/rigori/rischio uscita partono tutti da un default neutro
 * uguale per tutti i giocatori del listone (vedi scripts/import_listone.py) — l'unico modo per sapere se
 * un valore è stato davvero verificato è controllare se un pack di aggiornamento lo ha toccato
 * per quello specifico id, non leggere il valore corrente del giocatore.
 */
export function computeDataHealth(players: Player[], updatePacks: UpdatePack[]): DataHealth {
  const total = players.length;

  const starterTouched = new Set<string>();
  const penaltiesTouched = new Set<string>();
  const departureTouched = new Set<string>();

  for (const pack of updatePacks) {
    for (const patch of pack.patches) {
      if (!patch.id) continue;
      if (patch.starter !== undefined || patch.starterPct !== undefined) starterTouched.add(patch.id);
      if (patch.penalties !== undefined) penaltiesTouched.add(patch.id);
      if (patch.departureRisk !== undefined) departureTouched.add(patch.id);
    }
  }

  const counts = {
    role: players.filter((p) => p.role != null).length,
    quota: players.filter((p) => p.sourceSnapshot.quota != null).length,
    fvm: players.filter((p) => p.sourceSnapshot.fvm1000 != null).length,
    market: players.filter((p) => p.sourceSnapshot.market10x500 != null).length,
    starter: players.filter((p) => starterTouched.has(p.id)).length,
    penalties: players.filter((p) => penaltiesTouched.has(p.id)).length,
    departure: players.filter((p) => departureTouched.has(p.id)).length,
  };

  const fields: DataHealthField[] = [
    { label: "Ruolo", covered: counts.role, total, level: healthLevel(counts.role, total) },
    { label: "Quota", covered: counts.quota, total, level: healthLevel(counts.quota, total) },
    { label: "FVM", covered: counts.fvm, total, level: healthLevel(counts.fvm, total) },
    { label: "Mercato reale", covered: counts.market, total, level: healthLevel(counts.market, total) },
    { label: "Titolarità", covered: counts.starter, total, level: healthLevel(counts.starter, total) },
    { label: "Rigori", covered: counts.penalties, total, level: healthLevel(counts.penalties, total) },
    { label: "Rischio uscita", covered: counts.departure, total, level: healthLevel(counts.departure, total) },
  ];

  const lastUpdate = updatePacks.length > 0 ? updatePacks[updatePacks.length - 1].date : null;

  return { total, fields, lastUpdate };
}

export { ROSTER_SIZE };
