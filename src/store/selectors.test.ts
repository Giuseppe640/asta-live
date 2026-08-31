import { describe, expect, it } from "vitest";
import { computeDataHealth } from "./selectors";
import { makePlayer } from "../test/fixtures";
import type { UpdatePack } from "./updatePack";

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
