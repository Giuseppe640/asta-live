import type { PricedIn, Starter } from "../types";
import type { RawPlayer } from "./loadPack";

/**
 * Patch giornaliero su un giocatore — piano §7 "Update = file updates/YYYY-MM-DD.json".
 * Match per `id` (preferito) o per `name` (case-insensitive, disambiguato da `team` se ambiguo).
 * Solo i campi presenti vengono sovrascritti; tutto il resto del giocatore resta invariato.
 */
export interface PlayerUpdatePatch {
  id?: string;
  name?: string;
  team?: string;
  newTeam?: string; // trasferimento: aggiorna il campo team del giocatore
  starter?: Starter;
  starterPct?: number;
  penalties?: 0 | 1 | 2;
  freeKicks?: 0 | 1 | 2;
  corners?: 0 | 1 | 2;
  departureRisk?: number;
  rumor?: string;
  isNew?: boolean;
  pricedIn?: Partial<PricedIn>;
  /** Solo per il changelog: non viene applicato al giocatore. */
  note?: string;
}

export interface UpdatePack {
  date: string; // YYYY-MM-DD
  source: string;
  patches: PlayerUpdatePatch[];
}

function matchesPlayer(p: RawPlayer, patch: PlayerUpdatePatch): boolean {
  if (patch.id) return p.id === patch.id;
  if (patch.name) {
    const nameMatch = p.name.toLowerCase() === patch.name.toLowerCase();
    if (!nameMatch) return false;
    return patch.team ? p.team.toLowerCase() === patch.team.toLowerCase() : true;
  }
  return false;
}

export interface MergeResult {
  players: RawPlayer[];
  matched: number;
  unmatched: PlayerUpdatePatch[];
}

/** Applica in ordine i pack (già ordinati per data) sopra il listone base. Non tocca id/role/roleLocked. */
export function mergeUpdatePacks(base: RawPlayer[], packs: UpdatePack[]): MergeResult {
  let players = base;
  let matched = 0;
  const unmatched: PlayerUpdatePatch[] = [];

  for (const pack of packs) {
    for (const patch of pack.patches) {
      const idx = players.findIndex((p) => matchesPlayer(p, patch));
      if (idx === -1) {
        unmatched.push(patch);
        continue;
      }
      matched += 1;
      const current = players[idx];
      const updated: RawPlayer = {
        ...current,
        team: patch.newTeam ?? current.team,
        starter: patch.starter ?? current.starter,
        starterPct: patch.starterPct ?? current.starterPct,
        penalties: patch.penalties ?? current.penalties,
        freeKicks: patch.freeKicks ?? current.freeKicks,
        corners: patch.corners ?? current.corners,
        departureRisk: patch.departureRisk ?? current.departureRisk,
        rumor: patch.rumor ?? current.rumor,
        isNew: patch.isNew ?? current.isNew,
        sourceSnapshot: patch.pricedIn
          ? { ...current.sourceSnapshot, pricedIn: { ...current.sourceSnapshot.pricedIn, ...patch.pricedIn } }
          : current.sourceSnapshot,
      };
      players = [...players.slice(0, idx), updated, ...players.slice(idx + 1)];
    }
  }

  return { players, matched, unmatched };
}

/** Carica tutti i file src/data/updates/*.json disponibili, ordinati per data crescente. */
export function loadAllUpdatePacks(): UpdatePack[] {
  const modules = import.meta.glob("../data/updates/*.json", { eager: true }) as Record<string, { default: UpdatePack }>;
  return Object.values(modules)
    .map((m) => m.default)
    .sort((a, b) => a.date.localeCompare(b.date));
}
