import { useEffect, useState } from "react";
import { Gavel, ListFilter, Loader2, RefreshCw, Users } from "lucide-react";
import { useAuctionStore } from "./store/useAuctionStore";
import { BattitoreView } from "./features/asta/BattitoreView";
import { ScoutingView } from "./features/listone/ScoutingView";
import { RoseView } from "./features/rose/RoseView";
import { SyncView } from "./features/sync/SyncView";
import { ConflictBanner } from "./components/ConflictBanner";
import { Logo } from "./components/Logo";
import teamsSeed from "./data/teams.json";
import { getMergedRawPlayers } from "./store/mergedSeed";
import type { FantasyTeam } from "./types";

const MY_TEAM_ID = "eren-jagermeister";

type Tab = "battitore" | "scouting" | "rose" | "sync";

const TABS: { id: Tab; label: string; Icon: typeof Gavel }[] = [
  { id: "battitore", label: "Battitore", Icon: Gavel },
  { id: "scouting", label: "Scouting", Icon: ListFilter },
  { id: "rose", label: "Rose", Icon: Users },
  { id: "sync", label: "Sync", Icon: RefreshCw },
];

function App() {
  const hydrated = useAuctionStore((s) => s.hydrated);
  const playersCount = useAuctionStore((s) => s.players.length);
  const loadSeedIfEmpty = useAuctionStore((s) => s.loadSeedIfEmpty);
  const syncStatus = useAuctionStore((s) => s.syncStatus);
  const [tab, setTab] = useState<Tab>("battitore");

  useEffect(() => {
    if (hydrated) {
      loadSeedIfEmpty(getMergedRawPlayers(), teamsSeed as FantasyTeam[], MY_TEAM_ID);
    }
  }, [hydrated, loadSeedIfEmpty]);

  if (!hydrated || playersCount === 0) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4 bg-transparent text-neutral-400">
        <Logo size={56} />
        <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
        <p className="text-sm">Caricamento pack dati…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-svh max-w-md flex-col bg-neutral-950/60 shadow-2xl backdrop-blur-xl sm:my-3 sm:h-[calc(100svh-1.5rem)] sm:rounded-3xl sm:border sm:border-white/10">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/5 px-4">
        <Logo size={28} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-[15px] font-bold leading-tight tracking-tight text-neutral-50">AstaLive</h1>
          <p className="truncate text-[10px] font-medium leading-tight text-neutral-500">Fantacalcio 2026/27</p>
        </div>
        {syncStatus === "connected" && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-ring" />
            live
          </span>
        )}
      </header>

      <ConflictBanner />

      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === "battitore" && <BattitoreView />}
        {tab === "scouting" && <ScoutingView />}
        {tab === "rose" && <RoseView />}
        {tab === "sync" && <SyncView />}
      </main>

      <nav className="grid shrink-0 grid-cols-4 gap-1 border-t border-white/5 bg-neutral-950/80 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-all duration-200 ${
                active ? "bg-brand-500/15 text-brand-300" : "text-neutral-500 active:bg-white/5"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
