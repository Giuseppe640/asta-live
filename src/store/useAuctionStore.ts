import { create } from "zustand";
import { persist } from "zustand/middleware";
import { idbStorage } from "./db";
import { buildInitialPlayers, type RawPlayer } from "./loadPack";
import { computeTeamBudget, recomputeBandsInPlace } from "./selectors";
import { ROLE_SLOTS } from "../lib/constants";
import { isSyncConfigured, pushEventToRoom, subscribeToRoom } from "./firebaseSync";
import type { AuctionEvent, FantasyTeam, Fascia, Player, TeamProfile, Watch } from "../types";

export interface AssignResult {
  ok: boolean;
  reason?: string;
}

export type SyncStatus = "disconnected" | "connecting" | "connected";

/** Due (o più) assign event in competizione sullo stesso giocatore — §3 "conflitto visibile, no last-write-wins". */
export interface ConflictEntry {
  playerId: string;
  competingEvents: AuctionEvent[];
}

interface AuctionStore {
  players: Player[];
  teams: FantasyTeam[];
  events: AuctionEvent[];
  myTeamId: string;
  deviceId: string;
  logicalClock: number;
  hydrated: boolean;
  roomCode: string | null;
  syncStatus: SyncStatus;
  conflicts: ConflictEntry[];
  /** Navigazione cross-tab (Radar/Rivali → Battitore): non persistito, si consuma alla lettura. */
  pendingPlayerSelection: string | null;

  _setHydrated: () => void;
  _applyRemoteEvent: (event: AuctionEvent) => void;
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
  joinRoom: (roomCode: string) => AssignResult;
  leaveRoom: () => void;
  resolveConflict: (playerId: string, chosenEventId: string) => void;
  requestSelectPlayer: (playerId: string) => void;
  clearPendingPlayerSelection: () => void;
}

function newDeviceId(): string {
  return `dev-${crypto.randomUUID()}`;
}

/** Trova l'evento "assign" che ha prodotto l'assegnazione attualmente attiva di un giocatore (per seedare un conflitto). */
function findActiveAssignEvent(events: AuctionEvent[], player: Player): AuctionEvent | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e.type === "assign" && e.playerId === player.id && e.teamId === player.assignedTo && e.price === player.price) {
      return e;
    }
  }
  return undefined;
}

/** Rimuove un giocatore dal roster di una squadra e ricalcola `spent` per differenza, mai per sottrazione cumulativa. */
function withoutPlayerFromRoster(team: FantasyTeam, playerId: string): FantasyTeam {
  const roster = team.roster.filter((r) => r.playerId !== playerId);
  return { ...team, roster, spent: roster.reduce((s, r) => s + r.price, 0) };
}

type PersistedAuctionState = Pick<
  AuctionStore,
  "players" | "teams" | "events" | "myTeamId" | "deviceId" | "logicalClock" | "roomCode" | "conflicts"
>;

let roomUnsubscribe: (() => void) | null = null;

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
      roomCode: null,
      syncStatus: "disconnected",
      conflicts: [],
      pendingPlayerSelection: null,

      _setHydrated: () => set({ hydrated: true }),

      requestSelectPlayer: (playerId) => set({ pendingPlayerSelection: playerId }),
      clearPendingPlayerSelection: () => set({ pendingPlayerSelection: null }),

      _applyRemoteEvent: (event) => {
        const state = get();
        if (state.events.some((e) => e.id === event.id)) return; // già visto, dedup per id

        if (event.type === "assign" && event.playerId && event.teamId) {
          const player = state.players.find((p) => p.id === event.playerId);
          const team = state.teams.find((t) => t.id === event.teamId);
          if (!player || !team) {
            set({ events: [...state.events, event] });
            return;
          }

          if (player.assignedTo == null) {
            set({
              events: [...state.events, event],
              players: state.players.map((p) => (p.id === event.playerId ? { ...p, assignedTo: event.teamId, price: event.price } : p)),
              teams: state.teams.map((t) =>
                t.id === event.teamId
                  ? { ...t, spent: t.spent + (event.price ?? 0), roster: [...t.roster, { playerId: event.playerId!, price: event.price ?? 0 }] }
                  : t,
              ),
            });
            return;
          }

          if (player.assignedTo === event.teamId && player.price === event.price) {
            set({ events: [...state.events, event] }); // stesso esito, solo eco: nessuna mutazione
            return;
          }

          // conflitto: due assegnazioni diverse per lo stesso giocatore, nessuna delle due vince in automatico
          const activeEvent = findActiveAssignEvent(state.events, player);
          const existingConflict = state.conflicts.find((c) => c.playerId === event.playerId);
          const conflicts = existingConflict
            ? state.conflicts.map((c) => (c.playerId === event.playerId ? { ...c, competingEvents: [...c.competingEvents, event] } : c))
            : [...state.conflicts, { playerId: event.playerId, competingEvents: [activeEvent, event].filter((e): e is AuctionEvent => e != null) }];
          set({ events: [...state.events, event], conflicts });
          return;
        }

        if (event.type === "unassign" && event.playerId) {
          const player = state.players.find((p) => p.id === event.playerId);
          if (player?.assignedTo === event.teamId && player?.price === event.price) {
            set({
              events: [...state.events, event],
              players: state.players.map((p) => (p.id === event.playerId ? { ...p, assignedTo: undefined, price: undefined } : p)),
              teams: state.teams.map((t) => (t.id === event.teamId ? withoutPlayerFromRoster(t, event.playerId!) : t)),
            });
          } else {
            set({ events: [...state.events, event] });
          }
          return;
        }

        if (event.type === "resolve_conflict" && event.playerId && event.teamId) {
          set({
            events: [...state.events, event],
            players: state.players.map((p) => (p.id === event.playerId ? { ...p, assignedTo: event.teamId, price: event.price } : p)),
            teams: state.teams.map((t) => {
              const without = withoutPlayerFromRoster(t, event.playerId!);
              if (t.id === event.teamId) {
                return { ...without, spent: without.spent + (event.price ?? 0), roster: [...without.roster, { playerId: event.playerId!, price: event.price ?? 0 }] };
              }
              return without;
            }),
            conflicts: state.conflicts.filter((c) => c.playerId !== event.playerId),
          });
          return;
        }

        set({ events: [...state.events, event] });
      },

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

        if (state.roomCode) pushEventToRoom(state.roomCode, event);

        return { ok: true };
      },

      // Append-only (§3): l'undo NON rimuove l'evento originale, aggiunge un evento "unassign"
      // che lo annulla — necessario perché lo stesso log deve poter essere ricostruito anche
      // sull'altro dispositivo quando arriva via sync.
      undo: () => {
        const state = get();
        const active = state.players.filter((p) => p.assignedTo != null);
        if (active.length === 0) return;

        let target: { player: Player; event: AuctionEvent } | null = null;
        for (const player of active) {
          const e = findActiveAssignEvent(state.events, player);
          if (e && (!target || e.createdAt > target.event.createdAt)) target = { player, event: e };
        }
        if (!target) return;

        const { player, event: sourceEvent } = target;
        const playerId = player.id;
        const teamId = player.assignedTo!;
        const price = player.price ?? 0;

        const event: AuctionEvent = {
          id: crypto.randomUUID(),
          deviceId: state.deviceId,
          logicalClock: state.logicalClock + 1,
          createdAt: Date.now(),
          type: "unassign",
          playerId,
          teamId,
          price,
          by: "battitore",
          supersedesEventId: sourceEvent.id,
        };

        set({
          events: [...state.events, event],
          logicalClock: state.logicalClock + 1,
          players: state.players.map((p) => (p.id === playerId ? { ...p, assignedTo: undefined, price: undefined } : p)),
          teams: state.teams.map((t) => (t.id === teamId ? withoutPlayerFromRoster(t, playerId) : t)),
        });

        if (state.roomCode) pushEventToRoom(state.roomCode, event);
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

      joinRoom: (roomCode) => {
        if (!isSyncConfigured()) return { ok: false, reason: "Sync non configurata (manca la config Firebase)" };
        const code = roomCode.trim().toLowerCase();
        if (!code) return { ok: false, reason: "Codice stanza vuoto" };

        roomUnsubscribe?.();
        set({ roomCode: code, syncStatus: "connecting" });
        roomUnsubscribe = subscribeToRoom(code, (event) => {
          get()._applyRemoteEvent(event);
        });
        // l'SDK Firebase gestisce riconnessione/coda offline in autonomia: una volta agganciato
        // il listener consideriamo la stanza "connected" anche se non ci sono ancora eventi.
        set({ syncStatus: "connected" });
        return { ok: true };
      },

      leaveRoom: () => {
        roomUnsubscribe?.();
        roomUnsubscribe = null;
        set({ roomCode: null, syncStatus: "disconnected" });
      },

      resolveConflict: (playerId, chosenEventId) => {
        const state = get();
        const conflict = state.conflicts.find((c) => c.playerId === playerId);
        const chosen = conflict?.competingEvents.find((e) => e.id === chosenEventId);
        if (!conflict || !chosen || !chosen.teamId) return;

        const event: AuctionEvent = {
          id: crypto.randomUUID(),
          deviceId: state.deviceId,
          logicalClock: state.logicalClock + 1,
          createdAt: Date.now(),
          type: "resolve_conflict",
          playerId,
          teamId: chosen.teamId,
          price: chosen.price,
          by: "battitore",
          final: true,
          supersedesEventId: chosen.id,
        };

        set({
          events: [...state.events, event],
          logicalClock: state.logicalClock + 1,
          players: state.players.map((p) => (p.id === playerId ? { ...p, assignedTo: chosen.teamId, price: chosen.price } : p)),
          teams: state.teams.map((t) => {
            const without = withoutPlayerFromRoster(t, playerId);
            if (t.id === chosen.teamId) {
              return { ...without, spent: without.spent + (chosen.price ?? 0), roster: [...without.roster, { playerId, price: chosen.price ?? 0 }] };
            }
            return without;
          }),
          conflicts: state.conflicts.filter((c) => c.playerId !== playerId),
        });

        if (state.roomCode) pushEventToRoom(state.roomCode, event);
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
        roomCode: state.roomCode,
        conflicts: state.conflicts,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
        if (state?.roomCode) state.joinRoom(state.roomCode);
      },
    },
  ),
);

if (import.meta.env.DEV) {
  (window as unknown as { __store: typeof useAuctionStore }).__store = useAuctionStore;
}
