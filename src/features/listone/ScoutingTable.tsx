import { Fragment } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, UserCheck } from "lucide-react";
import { ConfidenceDot, FASCIA_NAMES, FasciaBadge, RoleBadge, StarterBadge } from "../../components/Badges";
import { groupKey, type FasciaGroup } from "./groupByFascia";
import { WATCH_OPTIONS } from "./watchOptions";
import type { FantasyTeam, Role, Watch } from "../../types";

export type SortKey = "valore" | "affidabilita";
export type SortDir = "asc" | "desc";

function SortableHeader({
  label,
  sortKey,
  activeSortBy,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeSortBy: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = activeSortBy === sortKey;
  const Icon = active ? (sortDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <th scope="col" className="px-3 py-2.5 text-right" aria-sort={active ? (sortDir === "desc" ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide transition-colors ${
          active ? "text-brand-300" : "text-neutral-500 hover:text-neutral-300"
        }`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

export function ScoutingTable({
  groups,
  teamById,
  setWatch,
  sortBy,
  sortDir,
  onSort,
  roleFilter,
  isGroupExpanded,
  onToggleGroup,
}: {
  groups: FasciaGroup[];
  teamById: Map<string, FantasyTeam>;
  setWatch: (playerId: string, watch: Watch | undefined) => void;
  sortBy: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  roleFilter: Role | "ALL";
  isGroupExpanded: (group: FasciaGroup) => boolean;
  onToggleGroup: (group: FasciaGroup) => void;
}) {
  return (
    <div className="flex-1 overflow-auto rounded-xl border border-white/5">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur-sm">
          <tr className="border-b border-white/5 text-left text-xs font-bold uppercase tracking-wide text-neutral-500">
            <th scope="col" className="px-3 py-2.5">
              Ruolo
            </th>
            <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">
              Fascia
            </th>
            <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">
              Titolarità
            </th>
            <th scope="col" className="px-3 py-2.5">
              Nome
            </th>
            <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">
              Squadra
            </th>
            <SortableHeader label="Valore" sortKey="valore" activeSortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortableHeader label="Affidabilità" sortKey="affidabilita" activeSortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th scope="col" className="px-3 py-2.5">
              Watch
            </th>
            <th scope="col" className="px-3 py-2.5">
              Rumor / stato
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const key = groupKey(group.role, group.fascia);
            const expanded = isGroupExpanded(group);
            const exhausted = group.freeCount === 0;
            return (
              <Fragment key={key}>
                <tr className={`border-b border-white/5 ${exhausted ? "bg-white/[0.01]" : "bg-white/[0.03]"}`}>
                  <td colSpan={9} className="px-3 py-0">
                    <button type="button" onClick={() => onToggleGroup(group)} className="flex h-10 w-full items-center gap-2 text-left">
                      <FasciaBadge fascia={group.fascia} />
                      {roleFilter === "ALL" && <RoleBadge role={group.role} />}
                      <span className={`text-sm font-bold ${exhausted ? "text-neutral-500" : "text-neutral-200"}`}>{FASCIA_NAMES[group.fascia]}</span>
                      <span className="flex-1" />
                      {exhausted ? (
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                          Esaurita
                        </span>
                      ) : (
                        <span className="text-xs font-semibold tabular-nums text-neutral-400">
                          {group.freeCount}/{group.totalCount} liberi
                        </span>
                      )}
                      <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  </td>
                </tr>

                {expanded &&
                  group.players.map((p) => {
                    const assignedTeam = p.assignedTo ? teamById.get(p.assignedTo) : null;
                    return (
                      <tr key={p.id} className="border-b border-white/5 transition-colors hover:bg-white/[0.03]">
                        <td className="px-3 py-2">
                          <RoleBadge role={p.role} />
                        </td>
                        <td className="hidden px-3 py-2 xl:table-cell">
                          <FasciaBadge fascia={p.fascia} uncertain={p.fasciaUncertain} />
                        </td>
                        <td className="hidden px-3 py-2 xl:table-cell">
                          <StarterBadge starter={p.starter} starterPct={p.starterPct} />
                        </td>
                        <td className="max-w-40 truncate px-3 py-2 font-medium text-neutral-100">{p.name}</td>
                        <td className="hidden max-w-32 truncate px-3 py-2 text-neutral-500 xl:table-cell">{p.team}</td>
                        <td className="font-display px-3 py-2 text-right font-bold tabular-nums text-neutral-200">
                          {p.pricing.fairSeed != null ? Math.round(p.pricing.fairSeed) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex">
                            <ConfidenceDot confidence={p.pricing.confidence} />
                          </div>
                        </td>
                        <td className="px-3 py-2">
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
                        </td>
                        <td className="max-w-56 truncate px-3 py-2 text-xs italic text-neutral-600">{!assignedTeam && p.rumor ? p.rumor : "—"}</td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
