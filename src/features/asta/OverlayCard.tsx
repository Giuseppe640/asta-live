import { useMemo, useState } from "react";
import { ConfidenceDot, DemandLabelBadge, FasciaBadge, RoleBadge } from "../../components/Badges";
import type { LivePricing } from "../../store/selectors";
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
  verde: "ring-emerald-500/70 shadow-emerald-500/20",
  giallo: "ring-amber-500/70 shadow-amber-500/20",
  rosso: "ring-rose-500/70 shadow-rose-500/20",
};
const COLOR_TEXT: Record<PriceColor, string> = {
  verde: "text-emerald-400",
  giallo: "text-amber-400",
  rosso: "text-rose-400",
};

function buildReasons(player: Player, live: LivePricing): string[] {
  const reasons: string[] = [];
  const techAdj = player.pricing.technicalAdjustment;
  if (techAdj > 1.001) reasons.push(`correttori tecnici positivi (×${techAdj.toFixed(2)})`);
  if (techAdj < 0.999) reasons.push(`correttori tecnici negativi (×${techAdj.toFixed(2)})`);
  reasons.push(`domanda ${live.demand.demandLabel}: ${live.demand.demanders} vogliono / ${live.demand.supply} rimasti`);
  if (live.inflationLive > 1.02) reasons.push(`inflazione di ruolo/fascia ×${live.inflationLive.toFixed(2)}`);
  if (player.pricing.confidence < 50) reasons.push("confidence bassa: valore indicativo, non un intero");
  if (player.watch === "must") reasons.push("in watchlist: MUST");
  if (player.departureRisk && player.departureRisk >= 30) reasons.push(`rischio cessione ${player.departureRisk}`);
  return reasons.slice(0, 3);
}

export function OverlayCard({
  player,
  live,
  onAssign,
}: {
  player: Player;
  live: LivePricing;
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
    <div className={`rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-lg ring-2 transition-colors ${COLOR_RING[color]}`}>
      <div className="flex items-center gap-2">
        <RoleBadge role={player.role} />
        <FasciaBadge fascia={player.fascia} uncertain={player.fasciaUncertain} />
        <h2 className="flex-1 truncate text-lg font-semibold text-neutral-50">{player.name}</h2>
        <ConfidenceDot confidence={player.pricing.confidence} />
      </div>
      <p className="mt-0.5 text-sm text-neutral-500">{player.team}</p>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Mio max</div>
          <div className={`text-4xl font-bold tabular-nums ${COLOR_TEXT[color]}`}>{live.personalMax}</div>
        </div>
        <div className="text-right text-sm text-neutral-400">
          <div>
            fair live <span className="font-semibold text-neutral-200">{live.fairLive != null ? Math.round(live.fairLive) : "—"}</span>
          </div>
          <div className="mt-0.5">
            <DemandLabelBadge label={live.demand.demandLabel} />
          </div>
        </div>
      </div>

      {live.displayRange && (
        <p className="mt-1 text-xs text-neutral-500">
          confidence bassa → range {Math.round(live.displayRange.low)}–{Math.round(live.displayRange.high)}
        </p>
      )}

      <p className="mt-1 text-xs text-neutral-500">
        {live.demand.demanders} vogliono / {live.demand.supply} rimasti nella fascia · legal max {live.legalMax}
      </p>

      {rosterUnclosable && (
        <p className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-400">
          ⚠ rosa non più chiudibile con slot aperti
        </p>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => bump(-5)}
            className="h-12 min-w-12 rounded-lg bg-neutral-800 text-lg font-semibold text-neutral-200 active:bg-neutral-700"
          >
            −5
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(Math.max(1, Number(e.target.value) || 1))}
            className={`h-12 w-0 min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 text-center text-2xl font-bold tabular-nums ${COLOR_TEXT[color]}`}
          />
          <button
            type="button"
            onClick={() => bump(5)}
            className="h-12 min-w-12 rounded-lg bg-neutral-800 text-lg font-semibold text-neutral-200 active:bg-neutral-700"
          >
            +5
          </button>
          <button
            type="button"
            onClick={() => bump(10)}
            className="h-12 min-w-12 rounded-lg bg-neutral-800 text-lg font-semibold text-neutral-200 active:bg-neutral-700"
          >
            +10
          </button>
        </div>

        <button
          type="button"
          onClick={() => onAssign(currentPrice)}
          className="h-12 w-full rounded-lg bg-emerald-600 text-base font-bold text-white active:bg-emerald-700"
        >
          Aggiudicato a {currentPrice}
        </button>
      </div>

      <button type="button" onClick={() => setShowDetail((s) => !s)} className="mt-3 h-8 text-xs text-neutral-500 underline">
        {showDetail ? "nascondi scheda" : "scheda: mercato, FVM, seed, confidence, overpay"}
      </button>

      {showDetail && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-neutral-950 p-3 text-xs text-neutral-400">
          <dt>Mercato 10/500 ×2</dt>
          <dd className="text-right text-neutral-200">
            {player.sourceSnapshot.market10x500 != null ? Math.round(player.sourceSnapshot.market10x500 * 2) : "—"}
          </dd>
          <dt>FVM /1000</dt>
          <dd className="text-right text-neutral-200">{player.sourceSnapshot.fvm1000 ?? "—"}</dd>
          <dt>Fair seed</dt>
          <dd className="text-right text-neutral-200">{player.pricing.fairSeed != null ? Math.round(player.pricing.fairSeed) : "—"}</dd>
          <dt>Fair live</dt>
          <dd className="text-right text-neutral-200">{live.fairLive != null ? Math.round(live.fairLive) : "—"}</dd>
          <dt>Confidence</dt>
          <dd className="text-right text-neutral-200">{player.pricing.confidence}</dd>
          <dt>Overpay</dt>
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
