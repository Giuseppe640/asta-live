import { useRef, useState } from "react";
import { useAuctionStore } from "../../store/useAuctionStore";
import teamsSeed from "../../data/teams.json";
import { getMergedRawPlayers } from "../../store/mergedSeed";
import { loadAllUpdatePacks } from "../../store/updatePack";
import type { FantasyTeam } from "../../types";

export function SyncView() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const events = useAuctionStore((s) => s.events);
  const myTeamId = useAuctionStore((s) => s.myTeamId);
  const exportState = useAuctionStore((s) => s.exportState);
  const importState = useAuctionStore((s) => s.importState);
  const hardReset = useAuctionStore((s) => s.hardReset);
  const refreshPack = useAuctionStore((s) => s.refreshPack);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const assignedCount = players.filter((p) => p.assignedTo != null).length;
  const updatePacks = loadAllUpdatePacks();

  function handleExport() {
    const json = exportState();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `asta-live-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage("Export scaricato.");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importState(String(reader.result));
      setMessage(result.ok ? "Import completato." : `Import fallito: ${result.reason}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleReset() {
    if (!window.confirm("Azzerare l'asta corrente e ripartire dal pack seed? L'azione è locale ma cancella tutte le assegnazioni fatte finora.")) {
      return;
    }
    hardReset(getMergedRawPlayers(), teamsSeed as FantasyTeam[], myTeamId || "eren-jagermeister");
    setMessage("Stato azzerato dal pack seed.");
  }

  function handleRefreshScouting() {
    const { updated } = refreshPack(getMergedRawPlayers());
    setMessage(`Scouting aggiornato: ${updated} giocatori ricalcolati, assegnazioni e watchlist preservate.`);
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Stato locale</h2>
        <p className="mt-2 text-sm text-neutral-300">
          {players.length} giocatori nel pack · {assignedCount} assegnati · {teams.length} squadre · {events.length} eventi
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Aggiornamenti scouting</h2>
        <p className="mt-1 text-xs text-neutral-500">
          {updatePacks.length === 0
            ? "Nessun pack di aggiornamento caricato ancora."
            : `${updatePacks.length} pack caricati: ${updatePacks.map((p) => p.date).join(", ")}`}
        </p>
        <button
          type="button"
          onClick={handleRefreshScouting}
          className="mt-3 h-12 w-full rounded-lg bg-violet-600 text-sm font-bold text-white active:bg-violet-700"
        >
          Applica aggiornamenti scouting
        </button>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Export / Import</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Nessuna stanza cloud: la condivisione tra dispositivi avviene per file JSON (§3 del piano).
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={handleExport} className="h-12 flex-1 rounded-lg bg-violet-600 text-sm font-bold text-white active:bg-violet-700">
            Esporta JSON
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="h-12 flex-1 rounded-lg bg-neutral-800 text-sm font-bold text-neutral-100 active:bg-neutral-700"
          >
            Importa JSON
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
        </div>
      </div>

      <div className="rounded-xl border border-rose-900/50 bg-rose-500/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-400">Zona pericolosa</h2>
        <p className="mt-1 text-xs text-neutral-500">Azzera tutte le assegnazioni e ricarica il pack dati seed.</p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-3 h-12 w-full rounded-lg border border-rose-800 text-sm font-bold text-rose-400 active:bg-rose-500/10"
        >
          Azzera asta
        </button>
      </div>

      {message && <p className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-300">{message}</p>}
    </div>
  );
}
