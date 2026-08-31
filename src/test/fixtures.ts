import type { FantasyTeam, Fascia, Player, Role, RosterEntry, Watch } from "../types";

let seq = 0;

export function makePlayer(
  opts: Partial<{
    id: string;
    name: string;
    team: string;
    role: Role;
    fascia: Fascia;
    fairSeed: number;
    confidence: number;
    watch: Watch;
    assignedTo: string;
    price: number;
  }> = {},
): Player {
  seq += 1;
  const fairSeed = opts.fairSeed ?? 100;
  return {
    id: opts.id ?? `p${seq}`,
    name: opts.name ?? `Giocatore ${seq}`,
    role: opts.role ?? "A",
    roleSource: "league_list_export",
    roleLocked: true,
    team: opts.team ?? "Team",
    fascia: opts.fascia ?? "B",
    sourceSnapshot: { source: "test", observedAt: "2026-01-01", market10x500: 50, fvm1000: 50, quota: 50 },
    pricing: {
      fairSeed,
      fairLive: fairSeed,
      personalMax: 0,
      confidence: opts.confidence ?? 80,
      inflationMult: 1,
      demandMult: 1,
      demandLabel: "media",
      technicalAdjustment: 1,
      reasons: [],
      updatedAt: "2026-01-01",
    },
    starter: "fisso",
    starterPct: 90,
    penalties: 0,
    freeKicks: 0,
    corners: 0,
    isNew: false,
    watch: opts.watch,
    assignedTo: opts.assignedTo,
    price: opts.price,
  };
}

export function makeTeam(opts: Partial<{ id: string; name: string; roster: RosterEntry[] }> = {}): FantasyTeam {
  seq += 1;
  const roster = opts.roster ?? [];
  return {
    id: opts.id ?? `t${seq}`,
    name: opts.name ?? `Squadra ${seq}`,
    color: "#8b5cf6",
    budget: 1000,
    spent: roster.reduce((s, r) => s + r.price, 0),
    roster,
    profile: "balanced_md",
  };
}

/** Giocatore già assegnato a `teamId`, con la roster entry corrispondente pronta per `makeTeam({ roster: [...] })`. */
export function ownedBy(teamId: string, price: number, opts: Parameters<typeof makePlayer>[0] = {}): { player: Player; entry: RosterEntry } {
  const player = makePlayer({ ...opts, assignedTo: teamId, price });
  return { player, entry: { playerId: player.id, price } };
}
