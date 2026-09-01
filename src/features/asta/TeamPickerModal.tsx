import { Minus, Plus } from "lucide-react";
import type { FantasyTeam } from "../../types";

export function TeamPickerModal({
  variant,
  teams,
  myTeamId,
  playerName,
  price,
  onPriceChange,
  onPick,
  onClose,
}: {
  variant: "sheet" | "dialog";
  teams: FantasyTeam[];
  myTeamId: string;
  playerName: string | undefined;
  price: number;
  /** Se presente, il prezzo è modificabile qui (es. assegnazione rapida da Scouting); altrimenti solo testo fisso, già deciso altrove (Battitore). */
  onPriceChange?: (price: number) => void;
  onPick: (teamId: string) => void;
  onClose: () => void;
}) {
  const isSheet = variant === "sheet";
  const bump = (delta: number) => onPriceChange?.(Math.max(1, price + delta));

  return (
    <div
      className={`fixed inset-0 z-20 flex bg-black/70 backdrop-blur-sm ${isSheet ? "items-end" : "items-center justify-center p-4"}`}
      onClick={onClose}
    >
      <div
        role={isSheet ? undefined : "dialog"}
        aria-modal={isSheet ? undefined : true}
        className={`animate-fade-in-up border-white/10 bg-neutral-900 shadow-2xl ${
          isSheet ? "w-full rounded-t-3xl border-t p-4 pb-6" : "w-full max-w-md rounded-3xl border p-5"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isSheet && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/10" />}
        {onPriceChange ? (
          <>
            <p className="mb-2 text-center text-sm text-neutral-400">
              Assegna <span className="font-semibold text-neutral-100">{playerName}</span> a…
            </p>
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => bump(-5)}
                className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-white/5 text-neutral-200 transition-colors active:bg-white/10"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={price}
                onChange={(e) => onPriceChange(Math.max(1, Number(e.target.value) || 1))}
                className="font-display h-10 w-0 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 text-center text-lg font-bold tabular-nums text-neutral-100 outline-none focus:border-brand-500/50"
              />
              <button
                type="button"
                onClick={() => bump(5)}
                className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-white/5 text-neutral-200 transition-colors active:bg-white/10"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => bump(10)}
                className="h-10 min-w-12 rounded-xl bg-white/5 text-sm font-bold text-neutral-200 transition-colors active:bg-white/10"
              >
                +10
              </button>
            </div>
          </>
        ) : (
          <p className="mb-3 text-center text-sm text-neutral-400">
            Assegna <span className="font-semibold text-neutral-100">{playerName}</span> a{" "}
            <span className="font-semibold text-neutral-100">{price}</span> crediti a…
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className="flex h-16 items-center gap-2 rounded-xl bg-white/5 px-3 text-left transition-colors active:bg-white/10"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-neutral-100">
                  {t.name}
                  {t.id === myTeamId ? " (tu)" : ""}
                </span>
                {t.president && <span className="block truncate text-[11px] text-neutral-500">{t.president}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
