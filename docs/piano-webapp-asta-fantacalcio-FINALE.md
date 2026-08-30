# Piano — Webapp Asta Fantacalcio 2026/27

**Nome di lavoro:** AstaLive  
**Stagione:** Serie A 2026/2027  
**Data piano:** 30 agosto 2026  
**Versione:** FINALE — freeze implementativo: motore prezzi, domanda, cap_piano, confidence e fasce su seed  
**Destinatari:** Cesare (Eren Jagermeister) + 1 amico, sulle 10 rose della lega  
**Lega:** JOGA BENITO · Motafogo FC · Young Girls Fc · Al Dobagl Fc · PietroFc · F.C. Ma Stai SCHERSANTOS · HeineKean · Complessato FC · MILFWALL · **Eren Jagermeister**  
**Obiettivo:** tool da tavolo per l’asta, usabile anche senza rete, sincronizzato appena c’è connessione, con prezzi *realistici da asta*, dinamici e personalizzati sulla situazione della lega — non semplici multipli del listino ufficiale.

Questa versione **congela il motore e la specifica di prodotto**. Non si apre una revisione ulteriore prima dell’implementazione e dei test sintetici/reali.  
Regola: se una feature non cambia un rilancio al tavolo, slitta dopo l’asta.

---

## 0. Freeze finale rispetto alla v2.2/v2.3

| Punto | Decisione finale |
|---|---|
| `cap_piano` descritto a parole | **Formula canonica** per reparto + regola sul buco |
| `technical_adjustment` | **3 correttori di fair** sommati e clampati; `newNoMarket` agisce solo sull’incertezza |
| Fasce “percentile del fair” senza dire quale | Percentile del **fair seed**; ricalcolo solo su pack dati |
| `personalMax` / `demand_mult` / no tetto-allarme | Confermati dalla v2.2 |

Cosa **non** si tocca: blend 60/40, shrinkage inflazione, domanda deterministica, overlay a un numero, ruolo locked, no LWW, MD 0→+7, 10 rose.

---

## 1. Contesto e vincoli di lega

| Parametro | Valore |
|---|---|
| Squadre in lega | 10 |
| Crediti iniziali | 1.000 a squadra |
| Rosa obbligatoria | **3 P · 8 D · 8 C · 6 A** (25 giocatori) |
| Modalità | Asta classica (chiamata + rilancio) |
| Modificatore difesa | Sì — tabella fine **0 → +7**, portiere incluso |
| Fonte ruoli | Listone Classic della **vostra lega** |
| Mercato reale | Finestra estiva chiude **1 settembre 2026 ore 20** |

### Modificatore difesa

Fonte: screenshot regolamento app, 30/08/2026. Non è il MD Gazzetta (+1/+3/+6).

- Include portiere: sì
- Bonus sulla propria squadra: sì
- Media voti *puri* di **P + 3 migliori D** (difesa a 4 o 5)
- Riserva d’ufficio conteggiata

| Media voto | Bonus |
|---|---|
| < 6,00 | **0** |
| ≥ 6,00 e < 6,25 | **+1** |
| ≥ 6,25 e < 6,50 | **+2** |
| ≥ 6,50 e < 6,75 | **+3** |
| ≥ 6,75 e < 7,00 | **+4** |
| ≥ 7,00 e < 7,25 | **+5** |
| ≥ 7,25 e < 7,50 | **+6** |
| ≥ 7,50 | **+7** |

`mdIndex` 0–100 su P/D = voto atteso × titolarità. Filtro listone, **non** moltiplicatore extra del prezzo.

### Regola crediti residui

```text
legal_max = crediti_residui − (slot_vuoti − 1)
```

Esempio: 4 slot vuoti, 80 crediti → max = 77.  
`must` non può mai superare `legal_max`.

---

## 2. Motore prezzi

Quattro concetti, mai mescolati in UI:

1. **Mercato osservato** — aste 10/500 scalate ×2
2. **Fair seed** — prima della nostra asta
3. **Fair live** — seed × inflazione × domanda
4. **Mio max** — clip sulla rosa di Eren Jagermeister

### 2.1 Fonti

| Segnale | Uso | Peso se fresco |
|---|---|---:|
| Prezzo medio 10/500 × 2 | ancora di mercato | 60% |
| FVM Fantacalcio.it /1000 | stima editoriale | 40% |
| 3 correttori tecnici §2.3.1 | correzione fair | cap **±12%** |
| Asta live | inflazione ruolo+fascia + domanda | sale fino a dominare |

Snapshot con `source` + `observedAt`. Niente “Lautaro = 315” nel codice.

### 2.2 Snapshot 30/08/2026

| Giocatore | 10/500 | ×2 | FVM/1000 | Lettura |
|---|---:|---:|---:|---|
| Lautaro | ~137 | ~274 | 367 | seed **~300–320**, confidenza media |
| Thuram | ~125 | ~249 | 263 | seed **~250–260**, confidenza alta |
| Malen | da importare | — | 414 | range, confidenza bassa finché manca mercato |

Altri FVM solo come segnale: Højlund 257, Paz 247, Çalhanoğlu 236, McTominay 228, Ramos 228, Kolo Muani 211, Kean 187.

### 2.3 Fair seed

```text
market_1000 = prezzo_osservato_10_500 × 2
seed_blend  = w_market × market_1000 + w_fvm × fvm_1000
fair_seed   = seed_blend × technical_adjustment
```

- Default pesi freschi: **0,60 / 0,40**, somma 1
- Manca mercato → più FVM, scende confidence
- Manca FVM → ancora = mercato
- Manca tutto → solo quota + range, niente intero finto

#### 2.3.1 technical_adjustment — 3 correttori di fair + 1 flag d’incertezza

Somma algebrica dei tre correttori di fair. Ogni correttore vale **0** se il segnale è già nel FVM/mercato (campo `pricedIn: true` sullo snapshot) oppure se il dato manca. `newNoMarket` è separato e agisce solo sulla confidence.

| Segnale | Condizione | Effetto |
|---|---|---:|
| `titolarita` | fisso e `starterPct ≥ 80` | **+0,04** |
| | ballottaggio / ruota (`40–79`) | **0** |
| | riserva / out / `starterPct < 40` | **−0,06** |
| `rigori` | rigorista **1ª** e `pricedIn.penalties = false` | **+0,05** |
| | rigorista 2ª | **+0,02** |
| | nessuno | **0** |
| `departureRisk` | ≥ 60 | **−0,08** |
| | 30–59 | **−0,03** |
| | < 30 o sconosciuto | **0** |
| `newNoMarket` | `isNew` e manca `market10x500` | **0,00 sul fair**; `confidence −15` e range più largo |

```text
raw_adj = 1 + titolarita + rigori + departureRisk
technical_adjustment = clamp(0.88, 1.12, raw_adj)

# newNoMarket non modifica il fair:
# agisce solo su confidence e ampiezza del range
```

Vietato aggiungere un quinto correttore di fair senza cambiare questa tabella.  
`newNoMarket` è un flag di **incertezza**, non un correttore di valore.  
`mdIndex` **non** entra qui.

### 2.4 Inflazione live

```text
ratio_i        = prezzo_pagato_i / fair_seed_i
raw_inflation  = mediana_robusta(ratio, stesso ruolo + fascia)
n_eff          = conteggio comparabili
confidence     = n_eff / (n_eff + 5)
inflation_live = 1 + confidence × (raw_inflation − 1)
```

Bucket: `P:S`, `A:A`, `D:B`… non media globale.  
Dalla prima aggiudicazione, con shrinkage.

### 2.5 Domanda — un moltiplicatore, formula congelata

Usa `base_live = fair_seed × inflation_live` (mai `fair_live`, niente circolo).

```text
pavimento_fascia =
    max(1, percentile_25(base_live dei liberi nella fascia o superiore))

demanders = squadre con
    slot_ruolo > 0
    e legal_max >= pavimento_fascia
    e (se fascia è S o A: non hanno già un giocatore
       dello stesso ruolo in fascia ≥ quella chiamata)

supply = liberi nella fascia o superiore

coverage_ratio = demanders / max(supply, 1)

budget_pressure =
    median(legal_max dei demanders)
    / max(median(base_live dei liberi comparabili), 1)

raw_demand =
    0.70 × ln(clamp(coverage_ratio, 0.25, 4.00))
  + 0.30 × ln(clamp(budget_pressure, 0.50, 2.00))

n_eff = min(demanders, supply + 2)
demand_confidence = n_eff / (n_eff + 4)
adjusted_demand = demand_confidence × raw_demand

demand_mult = clamp(0.90, 1.20, exp(0.25 × adjusted_demand))
```

Se `demanders = 0`: `demand_mult = 0.90`, label BASSA.  
Se `demanders = 1`: la mediana di un solo `legal_max` è quel valore.

Sanity check da tesare:

| Scenario | Atteso |
|---|---|
| 3 / 7, budget normali | BASSA, `< 1` |
| 5 / 5, budget in linea | ~1 |
| 7 / 3, budget in linea | ALTA, `> 1` |
| 7 / 3, legal max alti | alta, **≤ 1.20** |
| 2 / 5 entrambi ricchi | bassa/neutra |

Label UI:

- `BASSA` se `< 0.98`
- `MEDIA` se `0.98–1.08`
- `ALTA` se `> 1.08`

“Livello già coperto” (solo S/A): la squadra ha già almeno un giocatore **stesso ruolo** con fascia seed ≥ fascia chiamata.

### 2.6 Fair live

```text
base_live = fair_seed × inflation_live
fair_live = clamp(0.70 × fair_seed, 1.35 × fair_seed, base_live × demand_mult)
```

Fuori cap solo override battitore o `n_eff` inflazione alto (documentato nel log).

### 2.7 cap_piano — formula canonica

Profilo default **Equilibrata MD forte** su 1000:

| Reparto | Slot | Quota | Budget nominale |
|---|---:|---:|---:|
| P | 3 | 8% | 80 |
| D | 8 | 23% | 230 |
| C | 8 | 26% | 260 |
| A | 6 | 40% | 400 |
| Cuscino | — | 3% | 30 |

I 30 di cuscino **non** stanno in nessun reparto. Servono a:

1. coprire i buchi se un reparto sfora
2. restare disponibili come `legal_max` verso la fine

Se i buchi complessivi superano 30, l’algoritmo **non** sottrae automaticamente crediti agli altri reparti: il profilo entra in stato `custom` e richiede riallocazione esplicita.

Per ogni reparto R, dopo ogni *nostro* acquisto:

```text
spent_R     = somma prezzi dei nostri giocatori in R
slots_left_R = slot_R − n_nostri_in_R
min_close_R  = slots_left_R × 1          # 1 credito per slot

nominale_R   = floor(1000 × quota_R)     # 80, 230, 260, 400
residuo_nom  = nominale_R − spent_R

buco_R       = max(0, −residuo_nom)      # spent oltre il nominale
avanzo_R     = max(0,  residuo_nom)
```

Allocazione del cuscino (ordine fisso, non discrezionale):

```text
cuscino_restante = 30 − somma(buchi_R già assorbiti, cap 30)

# il buco di un reparto mangia il cuscino, NON gli altri reparti
buco_assorbito_R = min(buco_R, cuscino_restante_al_momento)
cuscino_restante -= buco_assorbito_R
```

Ordine di assorbimento se più reparti sono in buco: **A, C, D, P** (si protegge prima ciò che chiude la rosa cara).

```text
cap_piano_R = max(min_close_R, avanzo_R)

plan_deficit = max(0, somma(buchi_R) - 30)
```

Il buco già fatto **non** alza il cap: se l’attacco ha speso 315 su 400 e ha 5 slot, `cap_piano_A = max(5, 85) = 85`.  
Se ha speso 430 su 400, `avanzo = 0`, `buco = 30` assorbito dal cuscino, `cap_piano_A = max(5, 0) = 5` (solo chiusura legale).

Se, per esempio, i buchi complessivi sono 50, il cuscino assorbe 30 e:

```text
plan_deficit = 20
profile = "custom"
```

UI: **“PROFILO BUDGET ROTTO — riallocare 20 cr”**.  
Il sistema non decide da solo se quei 20 devono uscire da P, D o C: l’utente modifica i nominali e il motore ricalcola immediatamente `cap_piano`.

Preset (non motori paralleli):

| Strategia | P | D | C | A | Cuscino |
|---|---:|---:|---:|---:|---:|
| Equilibrata MD forte (default) | 8 | **23** | 26 | **40** | 3 |
| Super attaccante | 7 | 20 | 24 | 46 | 3 |
| Profondità / no super | 8 | 24 | 31 | 34 | 3 |

Override manuale del nominale per squadra = cambio profilo, ricalcolo immediato.  
Alert bloccante solo se `legal_max < 1` con slot aperti (rosa inchiodabile). Sbilanciamento piano = warning.

### 2.8 Mio max — unica formula

```text
legal_max = remaining − (slots_left_totali − 1)
cap_piano = cap_piano del ruolo del giocatore chiamato   # §2.7

watchlist = "must" | "ok" | "no" | unset

base_personal_max = min(legal_max, fair_live, cap_piano)

must_personal_max = min(
    legal_max,
    floor(fair_live × 1.15),
    floor(cap_piano × 1.10)
)

personal_max =
    watch "no"   → 0
    watch "must" → must_personal_max
    altrimenti   → base_personal_max
```

Questa è l’unica definizione. `must` ≤ `legal_max` sempre.

Esempio: Lautaro must, fair_live 326, cap_piano_A 400, legal 980  
→ `min(980, 374, 440) = 374`.  
Dopo Lautaro a 315: cap_A = 85; il prossimo A must ha `min(legal, fair×1.15, floor(85×1.10)=93)`.

### 2.9 Overlay rilancio

```text
┌─────────────────────────────┐
│  MIO MAX           318      │
│  fair live 326  ·  domanda ALTA
│  5 vogliono / 3 rimasti     │
└─────────────────────────────┘
```

| Prezzo corrente | Colore |
|---|---|
| < 90% mio max | verde |
| 90–100% mio max | giallo |
| `overpay` | rosso |
| `extreme_overpay` o rosa inchiodabile | rosso + haptic |

```text
overpay         = current_price > personal_max
extreme_overpay = current_price > max(personal_max × 1.10, fair_live × 1.20)
```

Niente tetto/allarme come numeri a sé.  
Scheda (tap): mercato, FVM, seed, live, mio max, confidence, overpay, 3 reasons.  
Confidence < 50 → primario = **range**, non intero.

### 2.10 Confidence 0–100

Qualitativa a scaglioni, basta così:

| Base | Condizione |
|---:|---|
| 25 | solo quota |
| 45 | solo FVM o solo mercato, campione basso |
| 60 | entrambe le fonti, divergenti (>25%) |
| 75 | entrambe, vicine |
| +10 | ≥ 4 comparabili live nello stesso bucket (cap 95) |
| −15 | `departureRisk ≥ 60` o titolarità out (floor 15) |
| −15 | `newNoMarket = true` (floor 15); non abbassa il fair |

UI: pallino. Sotto 50 = range largo.

---

## 3. Offline + condiviso

```
IndexedDB A ──sync── stanza / file JSON ──sync── IndexedDB B

Eventi append-only (UUID + logical clock).
Assign incompatibili → conflitto visibile, no last-write-wins.
Solo il Battitore mette final: true.
```

Ship: **export/import JSON** di default. Stanza cloud solo se Fase 1–3 sono chiuse.

---

## 4. Stack

Vite + React + TypeScript · Tailwind dark · Zustand + IndexedDB · PWA · JSON dati.

```
asta-live/
  src/features/  listone, asta, rose, prezzi, sync
  src/lib/       budget.ts, pricing.ts, demand.ts, modifier.ts
  src/data/      players.2026-08-30.json, set-pieces.json, rumors.json
  docs/          piano-webapp-asta-fantacalcio-v2.3.md
```

---

## 5. Funzionalità

### 5.1 Ship

1. Listone fonte lega: ruolo locked, quota, FVM, mercato, seed/live, mio max, confidence, fascia seed, titolarità, piazzati, rumor, assegnato.
2. Dieci rose fisse:

   | # | Fantasquadra | Presidente |
   |---|---|---|
   | 1 | **Eren Jagermeister** | Cesare (TU) |
   | 2 | JOGA BENITO | Marco Sannicandro |
   | 3 | Motafogo FC | Luigi Terlizzi |
   | 4 | Young Girls Fc | Francesco Fornelli |
   | 5 | Al Dobagl Fc | daniber99 |
   | 6 | PietroFc | Pietro Fornelli |
   | 7 | F.C. Ma Stai SCHERSANTOS | Enzucc |
   | 8 | HeineKean | KevinConstant |
   | 9 | Complessato FC | sfuuss |
   | 10 | MILFWALL | Austrian Painter |

3. Assegna / undo.
4. Budget, slot, legal_max, cap_piano, “se X a Y restano Z su N”.
5. Vista Battitore + Scouting.
6. Overlay §2.9.
7. PWA offline + IndexedDB.
8. Export/import JSON.

### 5.2 Se avanza tempo

Stanza realtime, filtri, watchlist must/ok/no, pannello rivali (input della domanda), search, log.

### 5.3 Dopo l’asta

Piazzati per club, formazioni-tipo, pack news, simulatore, PDF, presenza, TV battitore, report vs fair, need_factor continuo.

Fuori scope: voti, formazioni settimanali, classifica.

---

## 6. Listone

### 6.1 Ruolo locked

```text
role_source = "league_list_export"
role_locked = true
```

Altre fonti non toccano `role`.

### 6.2 Fasce — solo su fair seed

Calcolate **una volta per pack dati**, mai a ogni aggiudicazione.

```text
Per ciascun ruolo R:
    valori = fair_seed dei giocatori con role = R e seed noto
    fascia =
        S  se seed ≥ P90(valori)
        A  se seed ≥ P70
        B  se seed ≥ P40
        C  se seed ≥ P15
        D  altrimenti
```

Override manuale persistente (`fasciaOverride`) per casi anomali; il pack non lo cancella.  
Senza seed: fascia `D` provvisoria + flag `fasciaUncertain`.

I bucket di inflazione (`A:S`, …) usano la fascia **seed**. Se il live si muove, la fascia no. Altrimenti i ratio si sporcano.

### 6.3 Titolarità e piazzati

```text
starter: fisso | ruota | ballottaggio | riserva | out
starterPct: 0–100
rigori / punizioni / angoli: 0 | 1 | 2
```

### 6.4 mdIndex

```text
mdIndex = clamp(0, 100, 0.65 × votoAttesoNorm + 0.35 × starterPct)
```

Solo P/D. Non entra in `technical_adjustment`.

---

## 7. Dati giorno 0

Serie A: Atalanta, Bologna, Cagliari, Como, Fiorentina, Frosinone, Genoa, Inter, Juventus, Lazio, Lecce, Milan, Monza, Napoli, Parma, Roma, Sassuolo, Torino, Udinese, Venezia.

| Campo | Fonte |
|---|---|
| `role` | export listone **lega** |
| `quota` | snapshot dichiarato |
| `fvm1000` | Fantacalcio.it |
| `marketPrice10x500` | FCO / aste reali |
| `pricedIn` | quali bit tecnici sono già nel FVM |
| starter / piazzati / news | override + pack con timestamp |

Join per id + alias. Mai “ultima fonte vince” in blocco.

Pack rumor 30/08: Balerdi; Theate, Dovbyk, Piccoli; Kessié, Elmas, Kristensen, Gaetano; Paz, Ricci, Couto, Chalobah; Perri; Kolo Muani, Vicario, Lucumí, Douglas Luiz; Ramos; Hutchinson rumor; Leao→Galatasaray; Ngonge, Folorunsho; Juan Jesus; banner mercato fino **1/09 20:00**; `departureRisk` su Solet & co.

Update = file `updates/YYYY-MM-DD.json`. Eventi asta **immutabili**. Seed e fasce si ricalcolano sul pack; inflazione/domanda ripartono dallo storico.

---

## 8. UX

Un’azione a schermata, tap ≥ 48px, bottom sheet, dark, haptic su aggiudicato.  
Battitore / Scouting / Rivali.

```
Cerca Lautaro → MIO MAX + fair + domanda
Rilancio a voce o +5/+10
Aggiudicato → cap_piano, inflazione bucket, domanda, log
Conflitto offline → sheet, decide il Battitore
```

---

## 9. Modello dati

```ts
type Role = "P" | "D" | "C" | "A";
type Fascia = "S" | "A" | "B" | "C" | "D";
type Watch = "must" | "ok" | "no";

interface PriceSourceSnapshot {
  source: string;
  observedAt: string;
  market10x500?: number;
  fvm1000?: number;
  quota?: number;
  sampleQuality?: "high" | "medium" | "low";
  pricedIn?: {
    starter?: boolean;
    penalties?: boolean;
    departure?: boolean;
  };
}

interface PricingState {
  fairSeed: number;
  fairLive: number;
  personalMax: number;
  confidence: number;
  inflationMult: number;
  demandMult: number;
  demandLabel: "bassa" | "media" | "alta";
  technicalAdjustment: number;
  reasons: string[];
  updatedAt: string;
}

interface Player {
  id: string;
  name: string;
  role: Role;
  roleSource: "league_list_export";
  roleLocked: true;
  team: string;
  fascia: Fascia;
  fasciaOverride?: Fascia;
  fasciaUncertain?: boolean;
  sourceSnapshot: PriceSourceSnapshot;
  pricing: PricingState;
  starter: "fisso" | "ruota" | "ballottaggio" | "riserva" | "out";
  starterPct: number;
  penalties: 0 | 1 | 2;
  freeKicks: 0 | 1 | 2;
  corners: 0 | 1 | 2;
  mdIndex?: number;
  isNew: boolean;
  departureRisk?: number;
  rumor?: string;
  watch?: Watch;
  assignedTo?: string;
  price?: number;
}

interface FantasyTeam {
  id: string;
  name: string;
  color: string;
  budget: 1000;
  spent: number;
  roster: { playerId: string; price: number }[];
  profile: "balanced_md" | "super_forward" | "depth" | "custom";
}

interface AuctionEvent {
  id: string;
  deviceId: string;
  logicalClock: number;
  createdAt: number;
  type: "assign" | "unassign" | "bid" | "call" | "note" | "resolve_conflict";
  playerId?: string;
  teamId?: string;
  price?: number;
  by: string;
  final?: boolean;
  supersedesEventId?: string;
}

interface MarketState {
  inflationByRoleBand: Record<string, number>;
  demandByRoleBand: Record<string, number>;
  comparableCounts: Record<string, number>;
  updatedAt: number;
}

interface BudgetState {
  nominal: Record<Role, number>;
  spent: Record<Role, number>;
  capPiano: Record<Role, number>;
  holes: Record<Role, number>;
  cushionLeft: number;
  planDeficit: number;
  requiresReallocation: boolean;
}
```

Derivati:

```text
legalMax    = remaining − (sum(slotsLeft) − 1)
baseLive    = fairSeed × inflation
fairLive    = clamp(0.70s, 1.35s, baseLive × demand)
personalMax = formula §2.8
overpay / extremeOverpay = §2.9
capPiano    = §2.7
planDeficit = max(0, somma(buchi_R) - 30)
fascia      = percentile seed §6.2, salvo override
```

---

## 10. Piano di lavoro

| Fase | Tempo | Output |
|---|---|---|
| 0 Setup | ½ g | repo PWA |
| 1 Dati + motore | 2 g | listone locked, pricing.ts, demand.ts, budget.ts, JSON persist |
| 2 UX tavolo | 1 g | Battitore/Scouting, overlay, watchlist |
| 3 Live learning | ½ g | inflazione + guardrail |
| 4 Sync file | ½–1 g | export/import; cloud solo se 1–3 ok |
| 5 Prova | 2 h | 20 chiamate reali + 30–50 sintetiche |

Domani sera: top ~120 curati, resto grezzo, solo file.

Test obbligatori Fase 1:

- 5 sanity domanda §2.5
- Lautaro seed in 300–320 con snapshot 30/08
- Malen senza mercato → range, non 414
- Lautaro 315 poi cap_A = 85
- attacco a 430 → cap_A = slot×1, cuscino scende
- buchi totali > 30 → `plan_deficit > 0`, profilo `custom`, nessun prelievo automatico da altri reparti
- `newNoMarket` abbassa confidence/range, **non** fair_seed
- must non sfora legal_max
- fasce identiche prima e dopo 10 aggiudicazioni (stesso pack)

---

## 11. Criteri di fatto

- [ ] Offline dopo il primo load
- [ ] Assign aggiorna budget, slot, legal_max, cap_piano, listone, log
- [ ] Overlay = mio max + fair live + domanda
- [ ] `personalMax` solo §2.8
- [ ] `demand_mult` in `[0.90, 1.20]` e passa i 5 check
- [ ] `cap_piano` solo §2.7; buco non mangia gli altri reparti; oltre 30 cr nasce `plan_deficit` e il profilo diventa `custom`
- [ ] `technical_adjustment` corregge il fair solo con titolarità, rigori non priced-in e departure; `newNoMarket` agisce solo su confidence/range
- [ ] Fasce invarianti durante l’asta a parità di pack
- [ ] Niente UI “tetto” / “allarme”
- [ ] Seed Lautaro ~300–320 dalle fonti, non hard-coded
- [ ] Malen senza mercato = range
- [ ] Conflitto offline visibile
- [ ] Ruolo locked
- [ ] Rosa non chiudibile a 0 cr con slot aperti
- [ ] Undo, export identico, search < 3 tap

---

## 12. Rischi

| Rischio | Mitigazione |
|---|---|
| Dataset | Fase 1 prima della UI; top 120 curati |
| Precisione finta | confidence + range; domanda smorzata |
| Un’altra revisione di piano | freeze: si implementa |
| iOS PWA | file JSON sempre |
| Doppio assign | conflitto + Battitore |
| Mercato 1/09 | pack + flag `out` |

---

## 13. Cosa non fare

- Quota ufficiale come prezzo
- Hard-code prezzi
- Due moltiplicatori domanda
- Sette numeri in overlay
- Tetto/allarme separati
- Nuovi correttori tecnici del fair introdotti di nascosto
- Ricalcolare le fasce a ogni assign
- Far pagare automaticamente un buco A con il budget D
- Merge ruoli tra listoni
- Last-write-wins
- API live in asta
- Fantallenatore della stagione
- v2.4 di prodotto prima di un JSON che gira

---

## 14. Prossimo passo

1. Export listone della lega.  
2. Seed JSON multi-fonte.  
3. `pricing.ts` + `demand.ts` + `budget.ts` + test §10.  
4. UI.  
5. Prova in due.

---

## 15. Changelog

### FINALE
- `newNoMarket` rimosso dai correttori di fair: riduce confidence e allarga il range;
- aggiunto `plan_deficit` quando i buchi superano il cuscino da 30;
- in caso di deficit il profilo passa a `custom` e la riallocazione è esplicita, mai automatica tra reparti;
- aggiunti test e criteri di fatto coerenti con queste due regole;
- freeze definitivo prima dell’implementazione.

### v2.3
- `cap_piano` formale: nominali, cuscino 30, buco assorbito dal cuscino in ordine A→C→D→P, mai dagli altri reparti;
- nella v2.3 `technical_adjustment` era descritto come 4 bit; nella FINALE `newNoMarket` è stato separato dal fair e spostato sulla confidence;
- fasce = percentili del **fair seed** per ruolo, freeze sul pack, override persistente;
- confidence a scaglioni implementabili;
- test cap_piano e invarianza fasce aggiunti ai criteri di fatto;
- freeze: niente v2.4 di spec prima del codice.

### v2.2
- personalMax canonico; domanda deterministica; overpay al posto di tetto/allarme.

### v2.1
- un demand_mult; overlay corto; no need_factor; mdIndex semplice; sync file default.

### v2.0
- blend mercato/FVM; seed/live/max; shrinkage; ruolo locked; conflitti.

### v1.0
- prodotto, MD lega, 10 rose, PWA.

Fine piano — VERSIONE FINALE.
