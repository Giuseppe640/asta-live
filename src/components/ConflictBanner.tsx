import { TriangleAlert } from "lucide-react";
import { useAuctionStore } from "../store/useAuctionStore";

/** §3 del piano: "Assign incompatibili → conflitto visibile, no last-write-wins". */
export function ConflictBanner() {
  const conflicts = useAuctionStore((s) => s.conflicts);
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const resolveConflict = useAuctionStore((s) => s.resolveConflict);

  if (conflicts.length === 0) return null;

  return (
    <div className="animate-fade-in-up shrink-0 space-y-2 border-b border-rose-500/20 bg-rose-500/10 p-3">
      {conflicts.map((c) => {
        const player = players.find((p) => p.id === c.playerId);
        if (!player) return null;
        return (
          <div key={c.playerId} className="rounded-xl border border-rose-500/30 bg-neutral-900/90 p-3 shadow-card">
            <p className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              CONFLITTO: {player.name} assegnato da due dispositivi — scegli quale tenere
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.competingEvents.map((e) => {
                const team = teams.find((t) => t.id === e.teamId);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => resolveConflict(c.playerId, e.id)}
                    className="flex h-10 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-xs font-semibold text-neutral-100 transition-colors active:bg-white/10"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: team?.color ?? "#71717a" }} />
                    {team?.name ?? e.teamId} @ {e.price}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
