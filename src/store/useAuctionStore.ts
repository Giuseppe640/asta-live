import { create } from "zustand";
import { persist } from "zustand/middleware";
import { idbStorage } from "./db";
import { buildInitialPlayers, type RawPlayer } from "./loadPack";
import { computeTeamBudget, recomputeBandsInPlace } from "./selectors";
import { ROLE_SLOTS } from "../lib/constants";
import type { AuctionEvent, FantasyTeam, Fascia, Player, TeamProfile, Watch } from "../types";

export interface AssignResult {
  ok: boolean;
  reason?: string;
}

interface AuctionStore {
  players: Player[];
  teams: FantasyTeam[];
  events: AuctionEvent[];
  myTeamId: string;
  deviceId: string;
  logicalClock: number;
  hydrated: boolean;

  _setHydrated: () => void;
  loadSeedIfEmpty: (rawPlayers: RawPlayer[], rawTeams: FantasyTeam[], myTeamId: string) => void;
  refreshPack: (rawPlayers: RawPlayer[]) => { updated: number };
  assign: (playerId: string, teamId: string, price: number, by?: string) => AssignResult;
  undo: () => void;
  setWatch: (playerId: string, watch: Watch | undefined) => void;
  setFasciaOverride: (playerId: string, fascia: Fascia | undefined) => void;
  setTeamProfile: (teamId: string, profile: TeamProfile) => void;
  exportState: () => string;
  importState: (json: string) => AssignResult;
  hardReset: (rawPlayers: RawPlayer[], rawTeams: FantasyTeam[], myTeamId: string) => void;
}

function newDeviceId(): string {
  return `dev-${crypto.randomUUID()}`;
}

type PersistedAuctionState = Pick<AuctionStore, "players" | "teams" | "events" | "myTeamId" | "deviceId" | "logicalClock">;

export const useAuctionStore = create<AuctionStore>()(
  persist<AuctionStore, [], [], PersistedAuctionState>(
    (set, get) => ({
      players: [],
      teams: [],
      events: [],
      myTeamId: "",
      deviceId: newDeviceId(),
      logicalClock: 0,
      hydrated: false,

      _setHydrated: () => set({ hydrated: true }),

      loadSeedIfEmpty: (rawPlayers, rawTeams, myTeamId) => {
        if (get().players.length > 0) return;
        set({
          players: buildInitialPlayers(rawPlayers),
          teams: rawTeams,
          events: [],
          myTeamId,
          logicalClock: 0,
        });
      },

      hardReset: (rawPlayers, rawTeams, myTeamId) => {
        set({
          players: buildInitialPlayers(rawPlayers),
          teams: rawTeams,
          events: [],
          myTeamId,
          logicalClock: 0,
        });
      },

      // "Pack refresh" (§7): ricalcola technical_adjustment/fair_seed/confidence/fasce sul
      // nuovo pack, ma preserva assegnazioni, prezzi, watchlist e fasciaOverride già presenti
      // — a differenza di hardReset, non tocca l'asta in corso.
      refreshPack: (rawPlayers) => {
        const state = get();
        const existingById = new Map(state.players.map((p) => [p.id, p]));
        const enriched = rawPlayers.map((rp) => {
          const existing = existingById.get(rp.id);
          if (!existing) return rp;
          return {
            ...rp,
            fasciaOverride: existing.fasciaOverride,
            watch: existing.watch,
            assignedTo: existing.assignedTo,
            price: existing.price,
          };
        });
        const refreshed = buildInitialPlayers(enriched);
        set({ players: refreshed });
        return { updated: refreshed.length };
      },

      assign: (playerId, teamId, price, by = "battitore") => {
        const state = get();
        const player = state.players.find((p) => p.id === playerId);
        const team = state.teams.find((t) => t.id === teamId);

        if (!player) return { ok: false, reason: "Giocatore non trovato" };
        if (player.assignedTo) return { ok: false, reason: "Giocatore già assegnato" };
        if (!team) return { ok: false, reason: "Squadra non trovata" };
        if (!Number.isInteger(price) || price < 1) return { ok: false, reason: "Prezzo non valido" };

        const budget = computeTeamBudget(team, state.players);
        const ownedInRole = budget.ownedCount[player.role];
        const roleSlotsTotal = ROLE_SLOTS[player.role];
        if (ownedInRole >= roleSlotsTotal) return { ok: false, reason: `Reparto ${player.role} già completo per ${team.name}` };
        if (price > budget.legalMax) {
          return { ok: false, reason: `Prezzo (${price}) supera legal_max (${budget.legalMax}): rosa non più chiudibile` };
        }

        const event: AuctionEvent = {
          id: crypto.randomUUID(),
          deviceId: state.deviceId,
          logicalClock: state.logicalClock + 1,
          createdAt: Date.now(),
          type: "assign",
          playerId,
          teamId,
          price,
          by,
          final: true,
        };

        set({
          events: [...state.events, event],
          logicalClock: state.logicalClock + 1,
          players: state.players.map((p) => (p.id === playerId ? { ...p, assignedTo: teamId, price } : p)),
          teams: state.teams.map((t) => (t.id === teamId ? { ...t, spent: t.spent + price, roster: [...t.roster, { playerId, price }] } : t)),
        });

        return { ok: true };
      },

      undo: () => {
        const state = get();
        const last = state.events[state.events.length - 1];
        if (!last) return;

        if (last.type === "assign" && last.playerId && last.teamId) {
          const playerId = last.playerId;
          const teamId = last.teamId;
          const price = last.price ?? 0;
          set({
            events: state.events.slice(0, -1),
            players: state.players.map((p) => (p.id === playerId ? { ...p, assignedTo: undefined, price: undefined } : p)),
            teams: state.teams.map((t) =>
              t.id === teamId ? { ...t, spent: t.spent - price, roster: t.roster.filter((r) => r.playerId !== playerId) } : t,
            ),
          });
        } else {
          set({ events: state.events.slice(0, -1) });
        }
      },

      setWatch: (playerId, watch) => {
        set((state) => ({ players: state.players.map((p) => (p.id === playerId ? { ...p, watch } : p)) }));
      },

      setFasciaOverride: (playerId, fascia) => {
        set((state) => {
          const players = state.players.map((p) => (p.id === playerId ? { ...p, fasciaOverride: fascia } : p));
          return { players: recomputeBandsInPlace(players) };
        });
      },

      setTeamProfile: (teamId, profile) => {
        set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, profile } : t)) }));
      },

      exportState: () => {
        const state = get();
        return JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            players: state.players,
            teams: state.teams,
            events: state.events,
            myTeamId: state.myTeamId,
            deviceId: state.deviceId,
            logicalClock: state.logicalClock,
          },
          null,
          2,
        );
      },

      importState: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (!Array.isArray(parsed.players) || !Array.isArray(parsed.teams) || !Array.isArray(parsed.events)) {
            return { ok: false, reason: "Formato file non valido" };
          }
          set({
            players: parsed.players,
            teams: parsed.teams,
            events: parsed.events,
            myTeamId: parsed.myTeamId ?? get().myTeamId,
            logicalClock: parsed.logicalClock ?? 0,
          });
          return { ok: true };
        } catch {
          return { ok: false, reason: "JSON non leggibile" };
        }
      },
    }),
    {
      name: "asta-live-state",
      storage: {
        getItem: async (name) => {
          const value = await idbStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await idbStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await idbStorage.removeItem(name);
        },
      },
      partialize: (state) => ({
        players: state.players,
        teams: state.teams,
        events: state.events,
        myTeamId: state.myTeamId,
        deviceId: state.deviceId,
        logicalClock: state.logicalClock,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);

if (import.meta.env.DEV) {
  (window as unknown as { __store: typeof useAuctionStore }).__store = useAuctionStore;
}
