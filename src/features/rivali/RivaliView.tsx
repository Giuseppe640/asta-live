import { useMemo, useState } from "react";
import { Swords, Users } from "lucide-react";
import { useAuctionStore } from "../../store/useAuctionStore";
import { ROLES } from "../../lib/constants";
import { FasciaBadge } from "../../components/Badges";
import { computeRivalSummaries, computeRoleFasciaDemand, computePressureLevel, type PressureLevel } from "./rivaliLogic";
import type { Fascia, Role } from "../../types";

const FASCE: Fascia[] = ["S", "A", "B", "C", "D"];

const PRESSURE_STYLES: Record<PressureLevel, string> = {
  alta: "bg-rose-500/15 text-rose-400",
  media: "bg-amber-500/15 text-amber-400",
  bassa: "bg-neutral-700/40 text-neutral-400",
};

export function RivaliView() {
  const players = useAuctionStore((s) => s.players);
  const teams = useAuctionStore((s) => s.teams);
  const myTeamId = useAuctionStore((s) => s.myTeamId);

  const [role, setRole] = useState<Role>("A");
  const [fascia, setFascia] = useState<Fascia>("B");

  const rivals = useMemo(() => computeRivalSummaries(teams, players, myTeamId), [teams, players, myTeamId]);
  const demand = useMemo(() => computeRoleFasciaDemand(players, teams, role, fascia), [players, teams, role, fascia]);

  const rivalRows = useMemo(() => {
    return rivals
      .map((r) => {
        const isDemander = demand.demanderTeamIds.includes(r.teamId);
        const pressure = computePressureLevel(r.legalMax, isDemander, demand.pavimentoFascia);
        const bestOwned = r.bestFasciaByRole[role];
        let reason: string;
        if (r.openSlots[role] <= 0) reason = `nessuno slot ${role} rimasto`;
        else if (bestOwned) reason = `ha già coperto il ruolo con fascia ${bestOwned}`;
        else if (!isDemander) reason = "budget sotto la soglia per competere a questo livello";
        else reason = `${r.openSlots[role]} slot ${role} liberi, nessuna copertura fascia ${fascia}+`;
        return { ...r, isDemander, pressure, bestOwned, reason };
      })
      .sort((a, b) => (b.isDemander ? 1 : 0) - (a.isDemander ? 1 : 0) || b.legalMax - a.legalMax);
  }, [rivals, demand, role, fascia]);

  const filters = (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Ruolo</p>
        <div className="flex gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`h-9 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                role === r ? "bg-brand-500 text-white shadow-glow-brand" : "bg-white/5 text-neutral-400 active:bg-white/10"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Fascia (o superiore)</p>
        <div className="flex gap-1.5">
          {FASCE.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFascia(f)}
              className={`h-9 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                fascia === f ? "bg-brand-500 text-white shadow-glow-brand" : "bg-white/5 text-neutral-400 active:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const demandSummary = (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
        <Swords className="h-3.5 w-3.5" />
        {role} · fascia {fascia}+ — chi mi contende questo livello
      </h2>
      <p className="mt-1.5 text-sm text-neutral-300">
        <span className="font-display font-bold text-neutral-100">{demand.demanders}</span> squadre potenzialmente interessate ·{" "}
        <span className="font-display font-bold text-neutral-100">{demand.supply}</span> giocatori compatibili rimasti liberi
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        soglia di budget per competere: {Math.round(demand.pavimentoFascia)} cr · domanda{" "}
        <span className="font-semibold uppercase text-neutral-300">{demand.demandLabel}</span>
      </p>

      <ul className="mt-3 flex flex-col gap-1.5">
        {rivalRows.map((r) => (
          <li key={r.teamId} className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 p-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.teamColor }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-100">{r.teamName}</p>
              <p className="truncate text-[11px] text-neutral-500">{r.reason}</p>
            </div>
            {r.bestOwned && <FasciaBadge fascia={r.bestOwned} />}
            <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase ${PRESSURE_STYLES[r.pressure]}`}>
              pressione {r.pressure}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const generalMatrix = (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
        <Users className="h-3.5 w-3.5" />
        Tutte le squadre
      </h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              <th scope="col" className="py-1.5 pr-2">
                Squadra
              </th>
              <th scope="col" className="px-2 py-1.5 text-right">
                Crediti
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="px-2 py-1.5 text-right">
                  {r}
                </th>
              ))}
              <th scope="col" className="py-1.5 pl-2 text-right">
                Legal max
              </th>
            </tr>
          </thead>
          <tbody>
            {rivals.map((r) => (
              <tr key={r.teamId} className="border-b border-white/5">
                <td className="py-1.5 pr-2">
                  <span className="flex items-center gap-1.5 truncate text-neutral-200">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.teamColor }} />
                    {r.teamName}
                  </span>
                </td>
                <td className="font-display px-2 py-1.5 text-right font-semibold tabular-nums text-neutral-200">{r.remaining}</td>
                {ROLES.map((role) => (
                  <td key={role} className="px-2 py-1.5 text-right tabular-nums text-neutral-400">
                    {r.openSlots[role]}
                  </td>
                ))}
                <td className="font-display py-1.5 pl-2 text-right font-bold tabular-nums text-neutral-100">{r.legalMax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 lg:grid lg:grid-cols-[220px_1fr_360px] lg:items-start lg:gap-4 lg:p-4">
      <div className="lg:order-1">{filters}</div>
      <div className="lg:order-3">{demandSummary}</div>
      <div className="lg:order-2">{generalMatrix}</div>
    </div>
  );
}
