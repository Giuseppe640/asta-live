import { useMemo, useState } from "react";
import { Search, UserCheck } from "lucide-react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { ConfidenceDot, FasciaBadge, RoleBadge } from "../../components/Badges";
import { ScoutingTable, type SortDir, type SortKey } from "./ScoutingTable";
import { WATCH_OPTIONS } from "./watchOptions";
import type { Role } from "../../types";

export function ScoutingView() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const setWatch = useAuctionStore((s) => s.setWatch);
  const isDesktop = useIsDesktop();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [onlyFree, setOnlyFree] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("valore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  function handleSort(key: SortKey) {
    if (key === sortBy) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dirMult = sortDir === "desc" ? -1 : 1;
    return players
      .filter((p) => roleFilter === "ALL" || p.role === roleFilter)
      .filter((p) => !onlyFree || p.assignedTo == null)
      .filter((p) => q === "" || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q))
      .sort((a, b) => {
        const valueA = sortBy === "valore" ? (a.pricing.fairSeed ?? 0) : a.pricing.confidence;
        const valueB = sortBy === "valore" ? (b.pricing.fairSeed ?? 0) : b.pricing.confidence;
        return (valueA - valueB) * dirMult;
      });
  }, [players, query, roleFilter, onlyFree, sortBy, sortDir]);

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca giocatore o squadra…"
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-base text-neutral-100 outline-none transition-colors placeholder:text-neutral-500 focus:border-brand-500/50 focus:bg-white/[0.07]"
        />
      </div>

      <div className="flex items-center gap-1.5">
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
        <button
          type="button"
          onClick={() => setOnlyFree((v) => !v)}
          className={`h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors ${
            onlyFree ? "bg-brand-500 text-white shadow-glow-brand" : "bg-white/5 text-neutral-400 active:bg-white/10"
          }`}
        >
          Liberi
        </button>
      </div>

      <p className="text-xs font-medium text-neutral-500">{rows.length} giocatori</p>

      {isDesktop ? (
        <ScoutingTable rows={rows} teamById={teamById} setWatch={setWatch} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {rows.map((p) => {
            const assignedTeam = p.assignedTo ? teamById.get(p.assignedTo) : null;
            return (
              <li key={p.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-2">
                  <RoleBadge role={p.role} />
                  <FasciaBadge fascia={p.fascia} uncertain={p.fasciaUncertain} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-100">{p.name}</p>
                    <p className="truncate text-xs text-neutral-500">{p.team}</p>
                  </div>
                  <div className="text-right" title="Valore stimato prima dell'asta">
                    <p className="font-display text-sm font-bold tabular-nums text-neutral-200">
                      {p.pricing.fairSeed != null ? Math.round(p.pricing.fairSeed) : "—"}
                    </p>
                    <ConfidenceDot confidence={p.pricing.confidence} />
                  </div>
                </div>

                <div className="mt-1.5 flex items-center justify-between pl-[4.25rem]">
                  {assignedTeam ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: assignedTeam.color }}>
                      <UserCheck className="h-3 w-3" />
                      {assignedTeam.name} @ {p.price}
                    </span>
                  ) : (
                    <div className="flex gap-1">
                      {WATCH_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          title={opt.title}
                          onClick={() => setWatch(p.id, opt.value)}
                          className={`h-7 rounded-md px-2 text-[11px] font-bold transition-colors ${
                            p.watch === opt.value || (opt.value === undefined && !p.watch) ? opt.className : "bg-white/5 text-neutral-500"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {p.rumor && <span className="truncate text-[11px] italic text-neutral-600">{p.rumor}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
