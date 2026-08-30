import { useEffect, useState } from "react";
import { useAuctionStore } from "./store/useAuctionStore";
import { BattitoreView } from "./features/asta/BattitoreView";
import { ScoutingView } from "./features/listone/ScoutingView";
import { RoseView } from "./features/rose/RoseView";
import { SyncView } from "./features/sync/SyncView";
import teamsSeed from "./data/teams.json";
import { getMergedRawPlayers } from "./store/mergedSeed";
import type { FantasyTeam } from "./types";

const MY_TEAM_ID = "eren-jagermeister";

type Tab = "battitore" | "scouting" | "rose" | "sync";

const TABS: { id: Tab; label: string }[] = [
  { id: "battitore", label: "Battitore" },
  { id: "scouting", label: "Scouting" },
  { id: "rose", label: "Rose" },
  { id: "sync", label: "Sync" },
];

function App() {
  const hydrated = useAuctionStore((s) => s.hydrated);
  const playersCount = useAuctionStore((s) => s.players.length);
  const loadSeedIfEmpty = useAuctionStore((s) => s.loadSeedIfEmpty);
  const [tab, setTab] = useState<Tab>("battitore");

  useEffect(() => {
    if (hydrated) {
      loadSeedIfEmpty(getMergedRawPlayers(), teamsSeed as FantasyTeam[], MY_TEAM_ID);
    }
  }, [hydrated, loadSeedIfEmpty]);

  if (!hydrated || playersCount === 0) {
    return (
      <div className="flex h-svh items-center justify-center bg-neutral-950 text-neutral-400">
        <p>Caricamento pack dati…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-svh max-w-md flex-col bg-neutral-950">
      <header className="flex h-12 shrink-0 items-center justify-center border-b border-neutral-800">
        <h1 className="text-sm font-bold tracking-wide text-neutral-200">AstaLive — Fantacalcio 2026/27</h1>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === "battitore" && <BattitoreView />}
        {tab === "scouting" && <ScoutingView />}
        {tab === "rose" && <RoseView />}
        {tab === "sync" && <SyncView />}
      </main>

      <nav className="grid shrink-0 grid-cols-4 border-t border-neutral-800 bg-neutral-950">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex h-14 flex-col items-center justify-center text-xs font-semibold ${
              tab === t.id ? "text-violet-400" : "text-neutral-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
