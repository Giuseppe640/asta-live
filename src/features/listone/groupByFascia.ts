import { FASCIA_ORDER, ROLES } from "../../lib/constants";
import type { Fascia, Player, Role } from "../../types";

export interface FasciaGroup {
  role: Role;
  fascia: Fascia;
  players: Player[];
  freeCount: number;
  totalCount: number;
}

const FASCIA_BEST_FIRST: Fascia[] = [...FASCIA_ORDER].reverse(); // S, A, B, C, D

export function groupKey(role: Role, fascia: Fascia): string {
  return `${role}:${fascia}`;
}

/**
 * Raggruppa i giocatori (già filtrati/ordinati dal chiamante) per ruolo poi fascia, dalla
 * migliore (S) alla peggiore (D) — riusa le fasce già calcolate da bands.ts sul fair_seed,
 * nessun nuovo criterio di livello. Un gruppo con freeCount 0 resta nel risultato (non sparisce):
 * serve per segnalarlo come "esaurito" invece di lasciarlo scomparire senza spiegazione.
 */
export function groupByFascia(players: Player[]): FasciaGroup[] {
  const groups = new Map<string, FasciaGroup>();
  for (const p of players) {
    const key = groupKey(p.role, p.fascia);
    const group = groups.get(key) ?? { role: p.role, fascia: p.fascia, players: [], freeCount: 0, totalCount: 0 };
    group.players.push(p);
    group.totalCount += 1;
    if (p.assignedTo == null) group.freeCount += 1;
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.role !== b.role) return ROLES.indexOf(a.role) - ROLES.indexOf(b.role);
    return FASCIA_BEST_FIRST.indexOf(a.fascia) - FASCIA_BEST_FIRST.indexOf(b.fascia);
  });
}
