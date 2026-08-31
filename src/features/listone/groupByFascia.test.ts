import { describe, expect, it } from "vitest";
import { groupByFascia } from "./groupByFascia";
import { makePlayer } from "../../test/fixtures";

describe("groupByFascia — riusa le fasce già calcolate da bands.ts, nessun nuovo criterio", () => {
  it("ordina i gruppi per ruolo (P,D,C,A) e dentro ogni ruolo dalla fascia migliore (S) alla peggiore (D)", () => {
    const players = [
      makePlayer({ role: "A", fascia: "D" }),
      makePlayer({ role: "P", fascia: "B" }),
      makePlayer({ role: "A", fascia: "S" }),
      makePlayer({ role: "P", fascia: "S" }),
    ];

    const groups = groupByFascia(players);

    expect(groups.map((g) => `${g.role}:${g.fascia}`)).toEqual(["P:S", "P:B", "A:S", "A:D"]);
  });

  it("conta correttamente liberi e totali dentro ogni gruppo", () => {
    const players = [
      makePlayer({ role: "A", fascia: "B" }),
      makePlayer({ role: "A", fascia: "B", assignedTo: "team1", price: 50 }),
      makePlayer({ role: "A", fascia: "B" }),
    ];

    const [group] = groupByFascia(players);

    expect(group.totalCount).toBe(3);
    expect(group.freeCount).toBe(2);
  });

  it("un gruppo esaurito (tutti assegnati) resta nel risultato con freeCount 0, non sparisce", () => {
    const players = [makePlayer({ role: "C", fascia: "A", assignedTo: "team1", price: 100 })];

    const groups = groupByFascia(players);

    expect(groups).toHaveLength(1);
    expect(groups[0].freeCount).toBe(0);
    expect(groups[0].totalCount).toBe(1);
  });
});
