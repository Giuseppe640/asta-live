import { useAuctionStore } from "../store/useAuctionStore";

/** §3 del piano: "Assign incompatibili → conflitto visibile, no last-write-wins". */
export function ConflictBanner() {
  const conflicts = useAuctionStore((s) => s.conflicts);
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const resolveConflict = useAuctionStore((s) => s.resolveConflict);

  if (conflicts.length === 0) return null;

  return (
    <div className="shrink-0 space-y-2 border-b border-rose-900/50 bg-rose-500/10 p-3">
      {conflicts.map((c) => {
        const player = players.find((p) => p.id === c.playerId);
        if (!player) return null;
        return (
          <div key={c.playerId} className="rounded-lg border border-rose-800 bg-neutral-900 p-2">
            <p className="text-xs font-bold text-rose-400">
              ⚠ CONFLITTO: {player.name} assegnato da due dispositivi — scegli quale tenere
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.competingEvents.map((e) => {
                const team = teams.find((t) => t.id === e.teamId);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => resolveConflict(c.playerId, e.id)}
                    className="h-10 rounded-lg bg-neutral-800 px-3 text-xs font-semibold text-neutral-100 active:bg-neutral-700"
                  >
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
