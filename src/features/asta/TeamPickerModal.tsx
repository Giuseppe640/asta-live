import type { FantasyTeam } from "../../types";

export function TeamPickerModal({
  variant,
  teams,
  myTeamId,
  playerName,
  price,
  onPick,
  onClose,
}: {
  variant: "sheet" | "dialog";
  teams: FantasyTeam[];
  myTeamId: string;
  playerName: string | undefined;
  price: number;
  onPick: (teamId: string) => void;
  onClose: () => void;
}) {
  const isSheet = variant === "sheet";

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
        <p className="mb-3 text-center text-sm text-neutral-400">
          Assegna <span className="font-semibold text-neutral-100">{playerName}</span> a{" "}
          <span className="font-semibold text-neutral-100">{price}</span> crediti a…
        </p>
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
