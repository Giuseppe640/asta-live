import { useRef, useState } from "react";
import { Database, Download, Newspaper, RotateCcw, TriangleAlert, Upload, Wifi, WifiOff } from "lucide-react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { isSyncConfigured, suggestRoomCode } from "../../store/firebaseSync";
import teamsSeed from "../../data/teams.json";
import { getMergedRawPlayers } from "../../store/mergedSeed";
import { loadAllUpdatePacks } from "../../store/updatePack";
import type { FantasyTeam } from "../../types";

const SYNC_STATUS_LABEL: Record<string, string> = {
  disconnected: "Non connesso",
  connecting: "Connessione…",
  connected: "Connesso",
};

function Card({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-card ${
        tone === "danger" ? "border-rose-500/20 bg-rose-500/[0.04]" : "border-white/10 bg-neutral-900/60"
      }`}
    >
      {children}
    </div>
  );
}

function CardTitle({ icon: Icon, children, tone = "default" }: { icon: typeof Database; children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <h2
      className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${tone === "danger" ? "text-rose-400" : "text-neutral-400"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </h2>
  );
}

export function SyncView() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const events = useAuctionStore((s) => s.events);
  const myTeamId = useAuctionStore((s) => s.myTeamId);
  const roomCode = useAuctionStore((s) => s.roomCode);
  const syncStatus = useAuctionStore((s) => s.syncStatus);
  const joinRoom = useAuctionStore((s) => s.joinRoom);
  const leaveRoom = useAuctionStore((s) => s.leaveRoom);
  const exportState = useAuctionStore((s) => s.exportState);
  const importState = useAuctionStore((s) => s.importState);
  const hardReset = useAuctionStore((s) => s.hardReset);
  const refreshPack = useAuctionStore((s) => s.refreshPack);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState(roomCode ?? "");

  function handleJoinRoom() {
    const result = joinRoom(roomInput);
    if (!result.ok) setMessage(result.reason ?? "Errore di connessione alla stanza");
  }

  function handleSuggestCode() {
    setRoomInput(suggestRoomCode());
  }

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
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <Card>
        <CardTitle icon={Database}>Stato locale</CardTitle>
        <p className="mt-2 text-sm text-neutral-300">
          {players.length} giocatori nel pack · {assignedCount} assegnati · {teams.length} squadre · {events.length} eventi
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle icon={roomCode ? Wifi : WifiOff}>Stanza condivisa</CardTitle>
          {roomCode && (
            <span className={`flex items-center gap-1 text-xs font-semibold ${syncStatus === "connected" ? "text-emerald-400" : "text-amber-400"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${syncStatus === "connected" ? "bg-emerald-400 animate-pulse-ring" : "bg-amber-400"}`} />
              {SYNC_STATUS_LABEL[syncStatus]}
            </span>
          )}
        </div>

        {!isSyncConfigured() ? (
          <p className="mt-1 text-xs text-neutral-500">
            Sync in tempo reale non ancora configurata. Nel frattempo la condivisione resta via export/import JSON.
          </p>
        ) : roomCode ? (
          <>
            <p className="mt-2 text-sm text-neutral-300">
              Codice stanza: <span className="font-mono font-bold text-neutral-100">{roomCode}</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">Condividi questo codice con l'altro dispositivo per vedere le stesse assegnazioni in tempo reale.</p>
            <button
              type="button"
              onClick={leaveRoom}
              className="mt-3 h-12 w-full rounded-xl bg-white/5 text-sm font-bold text-neutral-100 transition-colors active:bg-white/10"
            >
              Disconnetti
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-neutral-500">Entra con lo stesso codice su entrambi i dispositivi.</p>
            <div className="mt-2 flex gap-2">
              <input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="codice stanza"
                className="h-12 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-brand-500/50"
              />
              <button
                type="button"
                onClick={handleSuggestCode}
                className="h-12 rounded-xl bg-white/5 px-3 text-sm font-semibold text-neutral-200 transition-colors active:bg-white/10"
              >
                Genera
              </button>
            </div>
            <button
              type="button"
              onClick={handleJoinRoom}
              className="mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-sm font-bold text-white shadow-glow-brand transition-transform active:scale-[0.98]"
            >
              Connetti
            </button>
          </>
        )}
      </Card>

      <Card>
        <CardTitle icon={Newspaper}>Aggiornamenti scouting</CardTitle>
        <p className="mt-1 text-xs text-neutral-500">
          {updatePacks.length === 0
            ? "Nessun pack di aggiornamento caricato ancora."
            : `${updatePacks.length} pack caricati: ${updatePacks.map((p) => p.date).join(", ")}`}
        </p>
        <button
          type="button"
          onClick={handleRefreshScouting}
          className="mt-3 h-12 w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-sm font-bold text-white shadow-glow-brand transition-transform active:scale-[0.98]"
        >
          Applica aggiornamenti scouting
        </button>
      </Card>

      <Card>
        <CardTitle icon={Download}>Export / Import</CardTitle>
        <p className="mt-1 text-xs text-neutral-500">Backup manuale o condivisione senza stanza sincronizzata: esporta e importa un file JSON.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 text-sm font-bold text-neutral-100 transition-colors active:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Esporta
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 text-sm font-bold text-neutral-100 transition-colors active:bg-white/10"
          >
            <Upload className="h-4 w-4" />
            Importa
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
        </div>
      </Card>

      <Card tone="danger">
        <CardTitle icon={TriangleAlert} tone="danger">
          Zona pericolosa
        </CardTitle>
        <p className="mt-1 text-xs text-neutral-500">Azzera tutte le assegnazioni e ricarica il pack dati seed.</p>
        <button
          type="button"
          onClick={handleReset}
          className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 text-sm font-bold text-rose-400 transition-colors active:bg-rose-500/10"
        >
          <RotateCcw className="h-4 w-4" />
          Azzera asta
        </button>
      </Card>

      {message && <p className="animate-fade-in-up rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-neutral-300">{message}</p>}
    </div>
  );
}
