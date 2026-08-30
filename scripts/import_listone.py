"""
Converte il listone reale (export Fantacalcio.it "Lista calciatori") in
src/data/players.2026-08-30.json, nel formato RawPlayer atteso dall'app.

Il file sorgente NON contiene: mercato 10/500, titolarita/starterPct,
rigori/punizioni/angoli, departureRisk, rumor testuali. Questi campi restano
a default neutro (o vuoti), salvo l'overlay dei rumor esplicitamente
documentati nel piano (Leao, Solet, ecc.) applicato qui sotto per nome.
"""
import json
import sys
from pathlib import Path

import openpyxl

SRC = Path(__file__).parent.parent / "lista_calciatori_lista calciatori_classic_liga-bbva-fantacalcio.xlsx"
OUT = Path(__file__).parent.parent / "src" / "data" / "players.2026-08-30.json"
OBSERVED_AT = "2026-08-30T00:00:00.000Z"
SOURCE = "fantacalcio.it-listone-2026-08-30"

# Overlay rumor/departureRisk documentato nel piano (§7 pack rumor 30/08), per nome (case-insensitive, substring).
RUMOR_OVERLAY = {
    "kessi": ("rumor mercato, ritorno in Serie A", None),
    "elmas": ("rumor mercato", None),
    "kristensen": ("rumor mercato", None),
    "gaetano": ("rumor mercato", None),
    "ricci": ("rumor mercato", None),
    "couto": ("rumor mercato", None),
    "chalobah": ("rumor mercato", None),
    "perri": ("rumor mercato", None),
    "vicario": ("rumor mercato in uscita", None),
    "lucumi": ("rumor mercato", None),
    "douglas luiz": ("rumor mercato in uscita", None),
    "ngonge": ("rumor mercato", None),
    "folorunsho": ("rumor mercato", None),
    "juan jesus": ("rumor mercato", None),
    "solet": ("departureRisk segnalato dal piano", 65),
    "hutchinson": ("rumor mercato", None),
    "theate": ("rumor mercato", None),
    "dovbyk": ("rumor mercato", None),
    "piccoli": ("rumor mercato", None),
    "balerdi": ("rumor mercato in uscita", None),
    "kolo muani": ("possibile permanenza da definire", None),
}


def rumor_for(name: str):
    lname = name.lower()
    for key, val in RUMOR_OVERLAY.items():
        if key in lname:
            return val
    return (None, None)


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    ws = wb["Lista calciatori"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    players = []
    excluded = 0
    for row in rows:
        (pid, nome, fuori_lista, sq, under, ruolo, _mantra, pgv, mv, fm, fvm, quot, _fs, _costo) = row
        if fuori_lista:
            excluded += 1
            continue
        if ruolo not in ("P", "D", "C", "A"):
            excluded += 1
            continue

        is_new = (pgv or 0) == 0 and (mv or 0) == 0 and (fm or 0) == 0
        rumor_text, departure_risk = rumor_for(nome or "")

        player = {
            "id": str(pid),
            "name": nome,
            "role": ruolo,
            "roleSource": "league_list_export",
            "roleLocked": True,
            "team": sq,
            "sourceSnapshot": {
                "source": SOURCE,
                "observedAt": OBSERVED_AT,
                "fvm1000": fvm,
                "quota": quot,
                "sampleQuality": "low",
                "pricedIn": {"starter": False, "penalties": False, "departure": False},
            },
            "starter": "ballottaggio",
            "starterPct": 50,
            "penalties": 0,
            "freeKicks": 0,
            "corners": 0,
            "isNew": is_new,
        }
        if departure_risk is not None:
            player["departureRisk"] = departure_risk
        if rumor_text is not None:
            player["rumor"] = rumor_text

        players.append(player)

    OUT.write_text(json.dumps(players, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    by_role = {}
    for p in players:
        by_role[p["role"]] = by_role.get(p["role"], 0) + 1

    print(f"Importati {len(players)} giocatori ({excluded} esclusi: fuori lista o ruolo non valido)")
    print("Distribuzione ruoli:", by_role)


if __name__ == "__main__":
    sys.exit(main())
