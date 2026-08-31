import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SearchX, Undo2 } from "lucide-react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { computeLivePricing } from "../../store/selectors";
import { RoleBadge, FasciaBadge } from "../../components/Badges";
import { OverlayCard } from "./OverlayCard";
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

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca giocatore…"
            className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-base text-neutral-100 outline-none transition-colors placeholder:text-neutral-500 focus:border-brand-500/50 focus:bg-white/[0.07]"
          />
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
          <OverlayCard player={selectedPlayer} live={live} onAssign={handleAssignRequest} />
        </div>
      ) : (
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
      )}

      {pickingTeamFor != null && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setPickingTeamFor(null)}>
          <div
            className="animate-fade-in-up w-full rounded-t-3xl border-t border-white/10 bg-neutral-900 p-4 pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/10" />
            <p className="mb-3 text-center text-sm text-neutral-400">
              Assegna <span className="font-semibold text-neutral-100">{selectedPlayer?.name}</span> a{" "}
              <span className="font-semibold text-neutral-100">{pickingTeamFor}</span> crediti a…
            </p>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => confirmAssign(t.id)}
                  className="flex h-14 items-center gap-2 rounded-xl bg-white/5 px-3 text-left transition-colors active:bg-white/10"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="truncate text-sm font-medium text-neutral-100">
                    {t.name}
                    {t.id === myTeamId ? " (tu)" : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
