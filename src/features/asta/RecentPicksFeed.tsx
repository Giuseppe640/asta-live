import { useMemo } from "react";
import { History } from "lucide-react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { computeRecentPicks } from "../../store/selectors";
import { RoleBadge } from "../../components/Badges";

function formatRelativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return "adesso";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffHour = Math.round(diffMin / 60);
  return `${diffHour} h fa`;
}

export function RecentPicksFeed() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const events = useAuctionStore((s) => s.events);

  const picks = useMemo(() => computeRecentPicks(players, teams, events), [players, teams, events.length]);

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
        <History className="h-3.5 w-3.5" />
        Ultime aggiudicazioni
      </h2>

      {picks.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-600">Nessuna assegnazione ancora in questa asta.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/5">
          {picks.map((pick) => (
            <li key={pick.eventId} className="flex items-center gap-2 py-2 text-sm">
              <RoleBadge role={pick.role} />
              <span className="min-w-0 flex-1 truncate text-neutral-200">{pick.playerName}</span>
              <span className="flex min-w-0 items-center gap-1 truncate text-xs" style={{ color: pick.teamColor }}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: pick.teamColor }} />
                {pick.teamName}
              </span>
              <span className="font-display shrink-0 font-bold tabular-nums text-neutral-100">{pick.price}</span>
              <span className="w-14 shrink-0 text-right text-[10px] text-neutral-600">{formatRelativeTime(pick.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
