import { describe, expect, it } from "vitest";
import { PROFILE_QUOTAS, ROLE_SLOTS } from "./constants";
import {
  computeCapPiano,
  computeLegalMax,
  computePersonalMax,
  isExtremeOverpay,
  isOverpay,
  isRosterUnclosable,
} from "./budget";
import type { Role } from "../types";

const NOMINAL = PROFILE_QUOTAS.balanced_md; // P 80, D 230, C 260, A 400

function neutralInput(overrides: { spent?: Partial<Record<Role, number>>; owned?: Partial<Record<Role, number>> } = {}) {
  const zero: Record<Role, number> = { P: 0, D: 0, C: 0, A: 0 };
  return {
    nominal: NOMINAL,
    slots: ROLE_SLOTS,
    spent: { ...zero, ...overrides.spent },
    ownedCount: { ...zero, ...overrides.owned },
  };
}

describe("computeLegalMax — §1 regola crediti residui", () => {
  it("4 slot vuoti, 80 crediti → max 77", () => {
    expect(computeLegalMax(80, 4)).toBe(77);
  });
});

describe("computeCapPiano — §2.7 formula canonica", () => {
  it("Lautaro a 315/400 con 5 slot rimasti in A → cap_piano_A = 85", () => {
    const r = computeCapPiano(neutralInput({ spent: { A: 315 }, owned: { A: 1 } }));
    expect(r.holes.A).toBe(0);
    expect(r.surplus.A).toBe(85);
    expect(r.capPiano.A).toBe(85);
  });

  it("attacco a 430/400 → cap_piano_A = slot_left × 1 (chiusura legale), cuscino assorbe il buco da 30", () => {
    const r = computeCapPiano(neutralInput({ spent: { A: 430 }, owned: { A: 1 } }));
    expect(r.holes.A).toBe(30);
    expect(r.surplus.A).toBe(0);
    expect(r.minClose.A).toBe(5); // 5 slot rimasti (6 - 1 comprati) × 1
    expect(r.capPiano.A).toBe(5);
    expect(r.cushionLeft).toBe(0);
    expect(r.planDeficit).toBe(0); // 30 di buco, esattamente assorbito dai 30 di cuscino
  });

  it("il buco già fatto non alza il cap (spent oltre nominale non regala margine)", () => {
    const r = computeCapPiano(neutralInput({ spent: { A: 500 }, owned: { A: 2 } }));
    expect(r.surplus.A).toBe(0);
    expect(r.minClose.A).toBe(4); // 4 slot rimasti
    expect(r.capPiano.A).toBe(4);
  });

  it("buchi complessivi > 30 → plan_deficit > 0 e richiede riallocazione esplicita", () => {
    // A sfora di 40 (spent 440/400): il cuscino da 30 assorbe solo 30, restano 10 di deficit.
    const r = computeCapPiano(neutralInput({ spent: { A: 440 }, owned: { A: 1 } }));
    expect(r.holes.A).toBe(40);
    expect(r.planDeficit).toBe(10);
    expect(r.requiresReallocation).toBe(true);
  });

  it("un buco in un reparto non intacca il cap_piano di un altro reparto (niente prelievo automatico)", () => {
    const withHole = computeCapPiano(neutralInput({ spent: { A: 440 }, owned: { A: 1 } }));
    const withoutHole = computeCapPiano(neutralInput());
    expect(withHole.capPiano.D).toBe(withoutHole.capPiano.D);
    expect(withHole.capPiano.C).toBe(withoutHole.capPiano.C);
    expect(withHole.capPiano.P).toBe(withoutHole.capPiano.P);
  });

  it("ordine di assorbimento del cuscino è A, C, D, P quando più reparti sono in buco", () => {
    // P sfora di 10 e A sfora di 25: A (ordine prima) assorbe 25, P assorbe i restanti 5 dei suoi 10 → deficit 5.
    const r = computeCapPiano(neutralInput({ spent: { A: 425, P: 90 }, owned: { A: 1, P: 1 } }));
    expect(r.holes.A).toBe(25);
    expect(r.holes.P).toBe(10);
    expect(r.holesAbsorbedByCushion.A).toBe(25);
    expect(r.holesAbsorbedByCushion.P).toBe(5);
    expect(r.cushionLeft).toBe(0);
    expect(r.planDeficit).toBe(5);
  });
});

describe("computePersonalMax — §2.8 unica formula", () => {
  it("Lautaro must: fair_live 326, cap_piano_A 400, legal 980 → 374", () => {
    const r = computePersonalMax({ legalMax: 980, fairLive: 326, capPiano: 400, watch: "must" });
    expect(r.mustPersonalMax).toBe(374); // floor(326*1.15)=374, floor(400*1.10)=440, min(980,374,440)
    expect(r.personalMax).toBe(374);
  });

  it("dopo Lautaro a 315, cap_A=85: il prossimo A must è limitato a floor(85×1.10)=93", () => {
    const r = computePersonalMax({ legalMax: 900, fairLive: 1000, capPiano: 85, watch: "must" });
    expect(r.mustPersonalMax).toBe(93);
    expect(r.personalMax).toBe(93);
  });

  it("watch 'no' → personalMax 0", () => {
    const r = computePersonalMax({ legalMax: 900, fairLive: 300, capPiano: 400, watch: "no" });
    expect(r.personalMax).toBe(0);
  });

  it("senza watch (default) → base_personal_max = min(legal, fair_live, cap_piano)", () => {
    const r = computePersonalMax({ legalMax: 900, fairLive: 300, capPiano: 400, watch: undefined });
    expect(r.personalMax).toBe(300);
  });

  it("fair_live sconosciuto (null) non vincola il minimo", () => {
    const r = computePersonalMax({ legalMax: 200, fairLive: null, capPiano: 400, watch: undefined });
    expect(r.personalMax).toBe(200);
  });

  it("must non supera mai legal_max, anche con fair_live e cap_piano altissimi", () => {
    const r = computePersonalMax({ legalMax: 50, fairLive: 100000, capPiano: 100000, watch: "must" });
    expect(r.mustPersonalMax).toBeLessThanOrEqual(50);
    expect(r.personalMax).toBeLessThanOrEqual(50);
  });
});

describe("overpay / extreme_overpay / rosa inchiodabile — §2.9", () => {
  it("overpay quando il prezzo corrente supera personalMax", () => {
    expect(isOverpay(101, 100)).toBe(true);
    expect(isOverpay(100, 100)).toBe(false);
  });

  it("extreme_overpay = max(personalMax×1.10, fairLive×1.20)", () => {
    expect(isExtremeOverpay(115, 100, 200)).toBe(false); // supera personalMax×1.10=110 ma non il max(110,240)=240
    expect(isExtremeOverpay(111, 100, 50)).toBe(true); // sopra personalMax×1.10=110
    expect(isExtremeOverpay(241, 100, 200)).toBe(true); // sopra fairLive×1.20=240
  });

  it("rosa inchiodabile: legal_max < 1 con slot ancora aperti", () => {
    expect(isRosterUnclosable(0, 3)).toBe(true);
    expect(isRosterUnclosable(1, 3)).toBe(false);
    expect(isRosterUnclosable(0, 0)).toBe(false); // nessuno slot aperto, non è un problema
  });
});
