import { percentile } from "./stats";
import type { Fascia, Role, Starter } from "../types";

/**
 * §6.2 — fasce, calcolate una volta per pack dati sul fair seed, MAI ricalcolate a ogni
 * aggiudicazione (i bucket di inflazione si sporcherebbero). Il chiamante (store) è
 * responsabile di invocare questa funzione solo al caricamento/refresh di un pack.
 */

export interface BandInput {
  id: string;
  role: Role;
  fairSeed: number | null;
  fasciaOverride?: Fascia;
  starter?: Starter;
}

/** Sotto questa soglia il pool "titolari" di un ruolo è troppo piccolo per soglie affidabili: si torna al gruppo intero. */
const MIN_REFERENCE_POOL = 4;

export interface BandResult {
  id: string;
  fascia: Fascia;
  fasciaUncertain: boolean;
}

/**
 * Confronti stretti (>), non >=: quando molti giocatori di riserva condividono lo stesso
 * fair_seed di pavimento (es. i portieri di riserva, spesso tutti a quota/FVM minimo), quel
 * valore può coincidere con p40 e/o p15 stessi. Con >= finirebbero tutti in B o C insieme ai
 * titolari appena sopra la soglia; con > restano correttamente sotto, in D.
 */
function fasciaFromSeed(fairSeed: number, p90: number, p70: number, p40: number, p15: number): Fascia {
  if (fairSeed > p90) return "S";
  if (fairSeed > p70) return "A";
  if (fairSeed > p40) return "B";
  if (fairSeed > p15) return "C";
  return "D";
}

export function computeBands(players: BandInput[]): BandResult[] {
  const byRole = new Map<Role, BandInput[]>();
  for (const p of players) {
    const group = byRole.get(p.role);
    if (group) group.push(p);
    else byRole.set(p.role, [p]);
  }

  const results: BandResult[] = [];

  for (const group of byRole.values()) {
    // Le soglie si calcolano solo su chi ha davvero un posto in squadra (non riserva/out): un
    // ruolo con tante riserve irrilevanti (es. il 60% dei portieri di riserva, spesso a quota
    // minima) abbasserebbe le soglie e promuoverebbe "il meno peggio delle riserve" in una fascia
    // che non gli spetta — es. il titolare di una squadra debole, che finiva comunque promosso
    // solo perché il resto del ruolo era ancora più scarso di lui.
    const meaningful = group.filter((p) => p.starter !== "riserva" && p.starter !== "out");
    const referenceGroup = meaningful.length >= MIN_REFERENCE_POOL ? meaningful : group;

    const knownValues = referenceGroup
      .map((p) => p.fairSeed)
      .filter((v): v is number => v != null);

    const p90 = percentile(knownValues, 90);
    const p70 = percentile(knownValues, 70);
    const p40 = percentile(knownValues, 40);
    const p15 = percentile(knownValues, 15);

    for (const p of group) {
      const fasciaUncertain = p.fairSeed == null;
      const computed = p.fairSeed == null ? "D" : fasciaFromSeed(p.fairSeed, p90, p70, p40, p15);
      results.push({
        id: p.id,
        fascia: p.fasciaOverride ?? computed,
        fasciaUncertain,
      });
    }
  }

  return results;
}
