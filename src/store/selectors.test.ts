import { describe, expect, it } from "vitest";
import { computeDataHealth, computeRecentPicks } from "./selectors";
import { makePlayer, makeTeam } from "../test/fixtures";
import type { UpdatePack } from "./updatePack";
import type { AuctionEvent } from "../types";

function assignEvent(overrides: Partial<AuctionEvent> = {}): AuctionEvent {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    deviceId: "device-1",
    logicalClock: 1,
    createdAt: Date.now(),
    type: "assign",
    by: "battitore",
    final: true,
    ...overrides,
  };
}

describe("computeDataHealth — §12-13: copertura reale del dataset, non default TypeScript", () => {
  it("senza nessun pack caricato, titolarità/rigori/rischio uscita non contano nessun giocatore come coperto", () => {
    const players = [makePlayer({ id: "p1" }), makePlayer({ id: "p2" })];

    const health = computeDataHealth(players, []);

    const titolarita = health.fields.find((f) => f.label === "Titolarità")!;
    const rigori = health.fields.find((f) => f.label === "Rigori")!;
    const rischio = health.fields.find((f) => f.label === "Rischio uscita")!;
    expect(titolarita.covered).toBe(0);
    expect(rigori.covered).toBe(0);
    expect(rischio.covered).toBe(0);
  });

  it("un pack che tocca 'starter'/'starterPct' per id specifici conta solo quegli id come coperti", () => {
    const players = [makePlayer({ id: "p1" }), makePlayer({ id: "p2" }), makePlayer({ id: "p3" })];
    const pack: UpdatePack = {
      date: "2026-08-20",
      source: "test",
      patches: [
        { id: "p1", starter: "fisso" },
        { id: "p2", starterPct: 80 },
      ],
    };

    const health = computeDataHealth(players, [pack]);

    const titolarita = health.fields.find((f) => f.label === "Titolarità")!;
    expect(titolarita.covered).toBe(2);
    expect(titolarita.total).toBe(3);
  });

  it("più pack che toccano lo stesso id lo contano una sola volta", () => {
    const players = [makePlayer({ id: "p1" }), makePlayer({ id: "p2" })];
    const packs: UpdatePack[] = [
      { date: "2026-08-19", source: "test", patches: [{ id: "p1", penalties: 1 }] },
      { date: "2026-08-20", source: "test", patches: [{ id: "p1", penalties: 2 }] },
    ];

    const health = computeDataHealth(players, packs);

    const rigori = health.fields.find((f) => f.label === "Rigori")!;
    expect(rigori.covered).toBe(1);
  });

  it("le patch riferite a id non presenti nel dataset non gonfiano il conteggio", () => {
    const players = [makePlayer({ id: "p1" })];
    const pack: UpdatePack = { date: "2026-08-20", source: "test", patches: [{ id: "ghost", departureRisk: 40 }] };

    const health = computeDataHealth(players, [pack]);

    const rischio = health.fields.find((f) => f.label === "Rischio uscita")!;
    expect(rischio.covered).toBe(0);
    expect(rischio.total).toBe(1);
  });

  it("lastUpdate riflette la data dell'ultimo pack (i pack arrivano già ordinati per data crescente)", () => {
    const players = [makePlayer({ id: "p1" })];
    const packs: UpdatePack[] = [
      { date: "2026-08-19", source: "test", patches: [] },
      { date: "2026-08-21", source: "test", patches: [] },
    ];

    const health = computeDataHealth(players, packs);

    expect(health.lastUpdate).toBe("2026-08-21");
  });
});

describe("computeRecentPicks — un giocatore compare al massimo una volta, anche con eventi duplicati", () => {
  it("due eventi assign per lo stesso giocatore/squadra/prezzo (eco di sync) producono un solo pick, non due", () => {
    const team = makeTeam({ id: "team-1", name: "Motafogo FC" });
    const player = makePlayer({ id: "malen", name: "Malen", assignedTo: "team-1", price: 430 });
    const events: AuctionEvent[] = [
      assignEvent({ id: "ev-1", playerId: "malen", teamId: "team-1", price: 430, createdAt: 1000 }),
      assignEvent({ id: "ev-2", playerId: "malen", teamId: "team-1", price: 430, createdAt: 2000 }),
      assignEvent({ id: "ev-3", playerId: "malen", teamId: "team-1", price: 430, createdAt: 3000 }),
    ];

    const picks = computeRecentPicks([player], [team], events);

    expect(picks).toHaveLength(1);
    expect(picks[0].eventId).toBe("ev-3"); // il più recente
  });

  it("giocatori diversi restano tutti visibili, il dedup è solo per singolo giocatore", () => {
    const team = makeTeam({ id: "team-1" });
    const malen = makePlayer({ id: "malen", name: "Malen", assignedTo: "team-1", price: 430 });
    const svilar = makePlayer({ id: "svilar", name: "Svilar", assignedTo: "team-1", price: 50 });
    const events: AuctionEvent[] = [
      assignEvent({ id: "ev-1", playerId: "malen", teamId: "team-1", price: 430, createdAt: 1000 }),
      assignEvent({ id: "ev-2", playerId: "svilar", teamId: "team-1", price: 50, createdAt: 2000 }),
    ];

    const picks = computeRecentPicks([malen, svilar], [team], events);

    expect(picks.map((p) => p.playerId).sort()).toEqual(["malen", "svilar"]);
  });

  it("se l'evento più recente di un giocatore non coincide più con lo stato attuale, non ripiega su un evento più vecchio", () => {
    const team = makeTeam({ id: "team-1" });
    // stato attuale: nessuna assegnazione (es. dopo un undo) — l'evento assign resta nel log ma non deve più comparire in feed
    const player = makePlayer({ id: "malen", name: "Malen" });
    const events: AuctionEvent[] = [assignEvent({ id: "ev-1", playerId: "malen", teamId: "team-1", price: 430, createdAt: 1000 })];

    const picks = computeRecentPicks([player], [team], events);

    expect(picks).toHaveLength(0);
  });
});
