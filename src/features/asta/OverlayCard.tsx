import { useMemo, useState } from "react";
import { ChevronDown, Gavel, Minus, Plus, TriangleAlert } from "lucide-react";
import { ConfidenceDot, DemandLabelBadge, FasciaBadge, RoleBadge, StarterBadge } from "../../components/Badges";
import type { LivePricing } from "../../store/selectors";
import type { LeavePlayerContext } from "./leaveContext";
import type { Player } from "../../types";

type PriceColor = "verde" | "giallo" | "rosso";

function priceColor(currentPrice: number, personalMax: number, extremeOverpay: boolean, rosterUnclosable: boolean): PriceColor {
  if (extremeOverpay || rosterUnclosable) return "rosso";
  if (currentPrice > personalMax) return "rosso";
  if (personalMax > 0 && currentPrice >= 0.9 * personalMax) return "giallo";
  if (personalMax === 0 && currentPrice > 0) return "rosso";
  return "verde";
}

const COLOR_RING: Record<PriceColor, string> = {
  verde: "ring-emerald-500/60 shadow-[0_0_40px_-12px_rgba(16,185,129,0.5)]",
  giallo: "ring-amber-500/60 shadow-[0_0_40px_-12px_rgba(245,158,11,0.5)]",
  rosso: "ring-rose-500/60 shadow-[0_0_40px_-12px_rgba(244,63,94,0.5)]",
};
const COLOR_TEXT: Record<PriceColor, string> = {
  verde: "text-emerald-400",
  giallo: "text-amber-400",
  rosso: "text-rose-400",
};
const COLOR_GLOW: Record<PriceColor, string> = {
  verde: "from-emerald-500/10",
  giallo: "from-amber-500/10",
  rosso: "from-rose-500/10",
};

function buildReasons(player: Player, live: LivePricing): string[] {
  const reasons: string[] = [];
  const techAdj = player.pricing.technicalAdjustment;
  if (techAdj > 1.001) reasons.push(`prezzo alzato: buoni segnali (titolare fisso, rigorista…)`);
  if (techAdj < 0.999) reasons.push(`prezzo abbassato: segnali negativi (poco titolare, rischio cessione…)`);
  reasons.push(`domanda ${live.demand.demandLabel}: lo vogliono in ${live.demand.demanders}, ne restano ${live.demand.supply} simili`);
  if (live.inflationLive > 1.02) reasons.push(`i giocatori di questo ruolo/livello si stanno pagando cari in questa asta`);
  if (player.pricing.confidence < 50) reasons.push("dati incerti: meglio guardare il range che il numero preciso");
  if (player.watch === "must") reasons.push("è nella tua lista \"da prendere assolutamente\"");
  if (player.departureRisk && player.departureRisk >= 30) reasons.push(`rischio che cambi squadra prima che inizi il campionato: ${player.departureRisk}/100`);
  return reasons.slice(0, 3);
}

export function OverlayCard({
  player,
  live,
  leaveContext,
  onAssign,
}: {
  player: Player;
  live: LivePricing;
  leaveContext?: LeavePlayerContext | null;
  onAssign: (price: number) => void;
}) {
  const [currentPrice, setCurrentPrice] = useState(() => Math.max(1, Math.round((live.fairLive ?? live.personalMax) * 0.6)));
  const [showDetail, setShowDetail] = useState(false);

  const rosterUnclosable = live.legalMax < 1;
  const extremeOverpay = currentPrice > Math.max(live.personalMax * 1.1, (live.fairLive ?? 0) * 1.2);
  const color = priceColor(currentPrice, live.personalMax, extremeOverpay, rosterUnclosable);
  const reasons = useMemo(() => buildReasons(player, live), [player, live]);

  const bump = (delta: number) => setCurrentPrice((p) => Math.max(1, p + delta));

  return (
    <div
      className={`animate-fade-in-up relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/80 p-4 shadow-card ring-2 backdrop-blur-sm transition-all duration-300 ${COLOR_RING[color]}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${COLOR_GLOW[color]} to-transparent`} />

      <div className="relative flex items-center gap-2">
        <RoleBadge role={player.role} />
        <FasciaBadge fascia={player.fascia} uncertain={player.fasciaUncertain} />
        <StarterBadge starter={player.starter} starterPct={player.starterPct} returnEstimate={player.returnEstimate} />
        <h2 className="font-display flex-1 truncate text-lg font-bold text-neutral-50">{player.name}</h2>
        <ConfidenceDot confidence={player.pricing.confidence} />
      </div>
      <p className="relative mt-0.5 text-sm text-neutral-500">{player.team}</p>

      <div className="relative mt-4 flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Offri fino a</div>
          <div className={`font-display text-5xl font-extrabold tabular-nums ${COLOR_TEXT[color]}`}>{live.personalMax}</div>
        </div>
        <div className="text-right text-sm text-neutral-400">
          <div>
            vale circa <span className="font-semibold text-neutral-200">{live.fairLive != null ? Math.round(live.fairLive) : "—"}</span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-[10px] uppercase text-neutral-500">domanda</span>
            <DemandLabelBadge label={live.demand.demandLabel} />
          </div>
        </div>
      </div>

      {live.displayRange && (
        <p className="relative mt-1.5 text-xs text-neutral-500">
          dati pochi/incerti: vale probabilmente tra {Math.round(live.displayRange.low)} e {Math.round(live.displayRange.high)}
        </p>
      )}

      <p className="relative mt-1.5 text-xs text-neutral-500">
        lo vogliono in {live.demand.demanders}, ne restano {live.demand.supply} simili · puoi arrivare fino a {live.legalMax} senza sballare la rosa
      </p>

      {rosterUnclosable && (
        <p className="relative mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-400">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          attenzione: con questo budget rischi di non riuscire a completare la rosa
        </p>
      )}

      {leaveContext && (
        <div className="relative mt-2.5 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Se lo lasci</p>
          <p className={`mt-0.5 flex items-start gap-1 text-xs ${leaveContext.scarcity === "high" ? "text-rose-400" : "text-neutral-400"}`}>
            {leaveContext.scarcity === "high" && <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />}
            {leaveContext.message}
          </p>
          {leaveContext.comparablePlayers.length > 0 && (
            <p className="mt-1 truncate text-[11px] text-neutral-500">
              {leaveContext.comparablePlayers
                .map((c) => `${c.name} ${c.fairLive != null ? Math.round(c.fairLive) : "—"}`)
                .join(" · ")}
            </p>
          )}
        </div>
      )}

      <div className="relative mt-4">
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => bump(-5)}
            className="flex h-12 min-w-12 items-center justify-center rounded-xl bg-white/5 text-neutral-200 transition-colors active:bg-white/10"
          >
            <Minus className="h-5 w-5" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(Math.max(1, Number(e.target.value) || 1))}
            className={`font-display h-12 w-0 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 text-center text-2xl font-bold tabular-nums outline-none focus:border-brand-500/50 ${COLOR_TEXT[color]}`}
          />
          <button
            type="button"
            onClick={() => bump(5)}
            className="flex h-12 min-w-12 items-center justify-center rounded-xl bg-white/5 text-neutral-200 transition-colors active:bg-white/10"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => bump(10)}
            className="h-12 min-w-14 rounded-xl bg-white/5 text-sm font-bold text-neutral-200 transition-colors active:bg-white/10"
          >
            +10
          </button>
        </div>

        <button
          type="button"
          onClick={() => onAssign(currentPrice)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-900/30 transition-transform active:scale-[0.98]"
        >
          <Gavel className="h-4 w-4" />
          Aggiudicato a {currentPrice}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowDetail((s) => !s)}
        className="relative mt-3 flex h-8 items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-300"
      >
        {showDetail ? "nascondi i dettagli" : "perché questo prezzo?"}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showDetail ? "rotate-180" : ""}`} />
      </button>

      {showDetail && (
        <dl className="animate-fade-in-up relative mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl border border-white/5 bg-black/30 p-3 text-xs text-neutral-400">
          <dt>Prezzo visto in altre aste</dt>
          <dd className="text-right text-neutral-200">
            {player.sourceSnapshot.market10x500 != null ? Math.round(player.sourceSnapshot.market10x500 * 2) : "—"}
          </dd>
          <dt>Quotazione Fantacalcio.it (FVM)</dt>
          <dd className="text-right text-neutral-200">{player.sourceSnapshot.fvm1000 ?? "—"}</dd>
          <dt>Valore di partenza (prima dell'asta)</dt>
          <dd className="text-right text-neutral-200">{player.pricing.fairSeed != null ? Math.round(player.pricing.fairSeed) : "—"}</dd>
          <dt>Valore adesso (con l'asta in corso)</dt>
          <dd className="text-right text-neutral-200">{live.fairLive != null ? Math.round(live.fairLive) : "—"}</dd>
          <dt>Affidabilità della stima</dt>
          <dd className="text-right text-neutral-200">{player.pricing.confidence}/100</dd>
          <dt>Stai offrendo più del consigliato?</dt>
          <dd className="text-right text-neutral-200">{currentPrice > live.personalMax ? "sì" : "no"}</dd>
          {reasons.map((r) => (
            <p key={r} className="col-span-2 mt-1 text-neutral-500">
              · {r}
            </p>
          ))}
        </dl>
      )}
    </div>
  );
}
