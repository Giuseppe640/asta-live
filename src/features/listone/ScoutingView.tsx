import { useMemo, useState } from "react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { ConfidenceDot, FasciaBadge, RoleBadge } from "../../components/Badges";
import type { Role, Watch } from "../../types";

const WATCH_OPTIONS: { value: Watch | undefined; label: string; className: string }[] = [
  { value: "must", label: "MUST", className: "bg-emerald-600 text-white" },
  { value: undefined, label: "OK", className: "bg-neutral-700 text-neutral-200" },
  { value: "no", label: "NO", className: "bg-rose-600 text-white" },
];

export function ScoutingView() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const setWatch = useAuctionStore((s) => s.setWatch);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [onlyFree, setOnlyFree] = useState(false);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => roleFilter === "ALL" || p.role === roleFilter)
      .filter((p) => !onlyFree || p.assignedTo == null)
      .filter((p) => q === "" || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q))
      .sort((a, b) => (b.pricing.fairSeed ?? 0) - (a.pricing.fairSeed ?? 0));
  }, [players, query, roleFilter, onlyFree]);

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca giocatore o squadra…"
        className="h-12 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 placeholder:text-neutral-500"
      />

      <div className="flex items-center gap-1.5">
        {(["ALL", "P", "D", "C", "A"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold ${
              roleFilter === r ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {r === "ALL" ? "Tutti" : r}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOnlyFree((v) => !v)}
          className={`h-9 shrink-0 rounded-lg px-3 text-sm font-semibold ${onlyFree ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400"}`}
        >
          Liberi
        </button>
      </div>

      <p className="text-xs text-neutral-500">{rows.length} giocatori</p>

      <ul className="flex-1 overflow-y-auto">
        {rows.map((p) => {
          const assignedTeam = p.assignedTo ? teamById.get(p.assignedTo) : null;
          return (
            <li key={p.id} className="border-b border-neutral-800 py-2">
              <div className="flex items-center gap-2">
                <RoleBadge role={p.role} />
                <FasciaBadge fascia={p.fascia} uncertain={p.fasciaUncertain} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-100">{p.name}</p>
                  <p className="truncate text-xs text-neutral-500">{p.team}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-neutral-200">
                    {p.pricing.fairSeed != null ? Math.round(p.pricing.fairSeed) : "—"}
                  </p>
                  <ConfidenceDot confidence={p.pricing.confidence} />
                </div>
              </div>

              <div className="mt-1.5 flex items-center justify-between pl-[4.25rem]">
                {assignedTeam ? (
                  <span className="text-xs font-medium" style={{ color: assignedTeam.color }}>
                    → {assignedTeam.name} @ {p.price}
                  </span>
                ) : (
                  <div className="flex gap-1">
                    {WATCH_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setWatch(p.id, opt.value)}
                        className={`h-7 rounded px-2 text-[11px] font-bold ${
                          p.watch === opt.value || (opt.value === undefined && !p.watch) ? opt.className : "bg-neutral-800 text-neutral-500"
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
    </div>
  );
}
