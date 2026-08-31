import { useAuctionStore } from "../store/useAuctionStore";
import { computeTeamBudget } from "../store/selectors";
import { Logo } from "./Logo";
import { TABS, type Tab } from "./tabs";

export function Sidebar({ tab, onTabChange }: { tab: Tab; onTabChange: (tab: Tab) => void }) {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const myTeamId = useAuctionStore((s) => s.myTeamId);
  const syncStatus = useAuctionStore((s) => s.syncStatus);

  const myTeam = teams.find((t) => t.id === myTeamId);
  const budget = myTeam ? computeTeamBudget(myTeam, players) : null;

  return (
    <aside className="hidden shrink-0 flex-col overflow-y-auto border-r border-white/5 p-4 lg:flex lg:w-60 xl:w-64">
      <div className="flex items-center gap-2.5">
        <Logo size={32} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-base font-bold leading-tight tracking-tight text-neutral-50">AstaLive</h1>
          <p className="truncate text-[11px] font-medium leading-tight text-neutral-500">Fantacalcio 2026/27</p>
        </div>
      </div>

      {syncStatus === "connected" && (
        <span className="mt-3 flex w-fit items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
          <span className="animate-pulse-ring h-1.5 w-1.5 rounded-full bg-emerald-400" />
          live
        </span>
      )}

      <nav className="mt-6 flex flex-col gap-1">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
                active ? "bg-brand-500/15 text-brand-300" : "text-neutral-400 hover:bg-white/5"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {myTeam && budget && (
        <div
          className="rounded-2xl border border-brand-500/30 bg-brand-500/[0.06] p-3"
          title="Il massimo che puoi offrire per UN giocatore, senza poi restare senza crediti per completare la rosa"
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: myTeam.color }} />
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Il mio budget</p>
          </div>
          <p className="font-display mt-1 text-2xl font-extrabold tabular-nums text-neutral-50">{budget.remaining}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            tetto per 1: <span className="font-semibold text-neutral-300">{budget.legalMax}</span> · {myTeam.roster.length}/25 giocatori
          </p>
        </div>
      )}
    </aside>
  );
}
