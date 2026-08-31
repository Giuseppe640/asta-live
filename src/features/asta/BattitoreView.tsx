import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SearchX, Undo2 } from "lucide-react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { computeLivePricing } from "../../store/selectors";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { RoleBadge, FasciaBadge } from "../../components/Badges";
import { OverlayCard } from "./OverlayCard";
import { TeamPickerModal } from "./TeamPickerModal";
import { RecentPicksFeed } from "./RecentPicksFeed";
import { getLeavePlayerContext } from "./leaveContext";
import type { Role } from "../../types";

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function BattitoreView() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const myTeamId = useAuctionStore((s) => s.myTeamId);
  const events = useAuctionStore((s) => s.events);
  const assign = useAuctionStore((s) => s.assign);
  const undo = useAuctionStore((s) => s.undo);
  const pendingPlayerSelection = useAuctionStore((s) => s.pendingPlayerSelection);
  const clearPendingPlayerSelection = useAuctionStore((s) => s.clearPendingPlayerSelection);
  const isDesktop = useIsDesktop();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickingTeamFor, setPickingTeamFor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const freePlayers = useMemo(() => players.filter((p) => p.assignedTo == null), [players]);

  const results = useMemo(() => {
    if (!query.trim() && roleFilter === "ALL") return [];
    const q = query.trim().toLowerCase();
    return freePlayers
      .filter((p) => (roleFilter === "ALL" || p.role === roleFilter) && (q === "" || p.name.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [freePlayers, query, roleFilter]);

  const selectedPlayer = selectedId ? (players.find((p) => p.id === selectedId) ?? null) : null;
  const live = useMemo(() => {
    if (!selectedPlayer || !myTeamId) return null;
    return computeLivePricing(players, teams, selectedPlayer.id, myTeamId);
    // ricalcola quando cambia il log eventi (assegnazioni influenzano inflazione/domanda/legal_max)
  }, [selectedPlayer, players, teams, myTeamId, events.length]);
  const leaveContext = useMemo(() => {
    if (!selectedPlayer || !myTeamId) return null;
    return getLeavePlayerContext(selectedPlayer.id, players, teams, myTeamId);
  }, [selectedPlayer, players, teams, myTeamId, events.length]);

  // Radar/Rivali chiedono di aprire un giocatore qui: si consuma una volta sola.
  useEffect(() => {
    if (pendingPlayerSelection) {
      setSelectedId(pendingPlayerSelection);
      clearPendingPlayerSelection();
    }
  }, [pendingPlayerSelection, clearPendingPlayerSelection]);

  // Esc: chiude il modale se aperto, altrimenti deseleziona, altrimenti svuota la ricerca.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (pickingTeamFor != null) setPickingTeamFor(null);
      else if (selectedId != null) setSelectedId(null);
      else if (query) setQuery("");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickingTeamFor, selectedId, query]);

  function handleAssignRequest(price: number) {
    setPickingTeamFor(price);
  }

  function confirmAssign(teamId: string) {
    if (!selectedPlayer || pickingTeamFor == null) return;
    const result = assign(selectedPlayer.id, teamId, pickingTeamFor);
    if (!result.ok) {
      setError(result.reason ?? "Errore sconosciuto");
      vibrate([40, 40, 40]);
      return;
    }
    vibrate(60);
    setError(null);
    setPickingTeamFor(null);
    setSelectedId(null);
    setQuery("");
  }

  const searchAndFilters = (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            id="battitore-search-input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca giocatore…"
            className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-9 text-base text-neutral-100 outline-none transition-colors placeholder:text-neutral-500 focus:border-brand-500/50 focus:bg-white/[0.07]"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 lg:inline-flex">
            /
          </kbd>
        </div>
        <button
          type="button"
          title="Annulla l'ultima assegnazione fatta"
          onClick={() => {
            undo();
            vibrate(30);
          }}
          disabled={events.length === 0}
          className="flex h-12 min-w-16 items-center justify-center gap-1.5 rounded-xl bg-white/5 text-sm font-semibold text-neutral-300 transition-opacity active:bg-white/10 disabled:opacity-30"
        >
          <Undo2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1.5">
        {(["ALL", "P", "D", "C", "A"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold transition-colors ${
              roleFilter === r ? "bg-brand-500 text-white shadow-glow-brand" : "bg-white/5 text-neutral-400 active:bg-white/10"
            }`}
          >
            {r === "ALL" ? "Tutti" : r}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-400">{error}</p>}
    </>
  );

  const resultsList = (
    <ul className="flex-1 overflow-y-auto">
      {results.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => setSelectedId(p.id)}
            className="flex h-14 w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors active:bg-white/5"
          >
            <RoleBadge role={p.role} />
            <FasciaBadge fascia={p.fascia} uncertain={p.fasciaUncertain} />
            <span className="flex-1 truncate text-neutral-100">{p.name}</span>
            <span className="text-xs text-neutral-500">{p.team}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
          </button>
        </li>
      ))}
      {query.trim() && results.length === 0 && (
        <li className="flex flex-col items-center gap-2 p-8 text-center text-sm text-neutral-500">
          <SearchX className="h-6 w-6 text-neutral-600" />
          Nessun giocatore libero trovato
        </li>
      )}
    </ul>
  );

  const teamPicker = pickingTeamFor != null && (
    <TeamPickerModal
      variant={isDesktop ? "dialog" : "sheet"}
      teams={teams}
      myTeamId={myTeamId}
      playerName={selectedPlayer?.name}
      price={pickingTeamFor}
      onPick={confirmAssign}
      onClose={() => setPickingTeamFor(null)}
    />
  );

  if (isDesktop) {
    return (
      <div className="flex h-full">
        <div className="flex h-full w-[360px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-white/5 p-3 xl:w-[400px]">
          {searchAndFilters}
          {resultsList}
        </div>
        <div className="flex h-full flex-1 flex-col gap-4 overflow-y-auto p-4">
          {selectedPlayer && live ? (
            <div className="max-w-2xl">
              <OverlayCard player={selectedPlayer} live={live} leaveContext={leaveContext} onAssign={handleAssignRequest} />
            </div>
          ) : (
            <div className="flex max-w-2xl flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-neutral-500">
              <Search className="h-6 w-6 text-neutral-600" />
              Seleziona un giocatore dalla lista per vedere il prezzo consigliato
            </div>
          )}
          <RecentPicksFeed />
        </div>
        {teamPicker}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {searchAndFilters}

      {selectedPlayer && live ? (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-0.5 self-start text-sm text-neutral-500 transition-colors hover:text-neutral-300"
          >
            <ChevronLeft className="h-4 w-4" />
            torna alla ricerca
          </button>
          <OverlayCard player={selectedPlayer} live={live} leaveContext={leaveContext} onAssign={handleAssignRequest} />
        </div>
      ) : (
        resultsList
      )}

      {teamPicker}
    </div>
  );
}
