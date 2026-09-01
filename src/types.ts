// Modello dati — piano §9. Non aggiungere campi che il piano non prevede
// senza aggiornare anche docs/piano-webapp-asta-fantacalcio-FINALE.md.

export type Role = "P" | "D" | "C" | "A";
export type Fascia = "S" | "A" | "B" | "C" | "D";
export type Watch = "must" | "ok" | "no";
export type Starter = "fisso" | "ruota" | "ballottaggio" | "riserva" | "out";
export type SetPieceRank = 0 | 1 | 2;
export type TeamProfile = "balanced_md" | "super_forward" | "depth" | "custom";
export type SampleQuality = "high" | "medium" | "low";
export type DemandLabel = "bassa" | "media" | "alta";

export interface PricedIn {
  starter?: boolean;
  penalties?: boolean;
  departure?: boolean;
}

export interface PriceSourceSnapshot {
  source: string;
  observedAt: string;
  market10x500?: number;
  fvm1000?: number;
  quota?: number;
  sampleQuality?: SampleQuality;
  pricedIn?: PricedIn;
}

export interface PricingState {
  fairSeed: number | null;
  fairLive: number | null;
  personalMax: number;
  confidence: number;
  inflationMult: number;
  demandMult: number;
  demandLabel: DemandLabel;
  technicalAdjustment: number;
  reasons: string[];
  updatedAt: string;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  roleSource: "league_list_export";
  roleLocked: true;
  team: string;
  fascia: Fascia;
  fasciaOverride?: Fascia;
  fasciaUncertain?: boolean;
  sourceSnapshot: PriceSourceSnapshot;
  pricing: PricingState;
  starter: Starter;
  starterPct: number;
  penalties: SetPieceRank;
  freeKicks: SetPieceRank;
  corners: SetPieceRank;
  mdIndex?: number;
  isNew: boolean;
  departureRisk?: number;
  rumor?: string;
  /** Solo per infortuni/assenze brevi con un rientro stimato concreto (es. "3-4 settimane") — mai per assenze lunghe o incerte. */
  returnEstimate?: string;
  watch?: Watch;
  assignedTo?: string;
  price?: number;
}

export interface RosterEntry {
  playerId: string;
  price: number;
}

export interface FantasyTeam {
  id: string;
  name: string;
  color: string;
  budget: 1000;
  spent: number;
  roster: RosterEntry[];
  profile: TeamProfile;
}

export type AuctionEventType =
  | "assign"
  | "unassign"
  | "bid"
  | "call"
  | "note"
  | "resolve_conflict";

export interface AuctionEvent {
  id: string;
  deviceId: string;
  logicalClock: number;
  createdAt: number;
  type: AuctionEventType;
  playerId?: string;
  teamId?: string;
  price?: number;
  by: string;
  final?: boolean;
  supersedesEventId?: string;
}

export interface MarketState {
  inflationByRoleBand: Record<string, number>;
  demandByRoleBand: Record<string, number>;
  comparableCounts: Record<string, number>;
  updatedAt: number;
}

export interface BudgetState {
  nominal: Record<Role, number>;
  spent: Record<Role, number>;
  capPiano: Record<Role, number>;
  holes: Record<Role, number>;
  cushionLeft: number;
  planDeficit: number;
  requiresReallocation: boolean;
}
