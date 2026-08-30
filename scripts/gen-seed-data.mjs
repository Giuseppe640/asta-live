// Genera src/data/players.2026-08-30.json e src/data/teams.json.
//
// DATASET SINTETICO/PLACEHOLDER: ad eccezione dei giocatori esplicitamente
// documentati nel piano (§2.2 snapshot + §7 pack rumor 30/08), nomi, squadre
// reali di appartenenza e valori sono generati proceduralmente per avere una
// base sufficientemente grande da far girare aste sintetiche complete.
// Da sostituire con l'export reale del listone di lega (piano §14, punto 1).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "data");

const SERIE_A_TEAMS = [
  "Atalanta", "Bologna", "Cagliari", "Como", "Fiorentina", "Frosinone", "Genoa",
  "Inter", "Juventus", "Lazio", "Lecce", "Milan", "Monza", "Napoli", "Parma",
  "Roma", "Sassuolo", "Torino", "Udinese", "Venezia",
];

const FANTASY_TEAMS = [
  { id: "eren-jagermeister", name: "Eren Jagermeister", president: "Cesare (TU)", color: "#c084fc" },
  { id: "joga-benito", name: "JOGA BENITO", president: "Marco Sannicandro", color: "#f97316" },
  { id: "motafogo-fc", name: "Motafogo FC", president: "Luigi Terlizzi", color: "#22c55e" },
  { id: "young-girls-fc", name: "Young Girls Fc", president: "Francesco Fornelli", color: "#ec4899" },
  { id: "al-dobagl-fc", name: "Al Dobagl Fc", president: "daniber99", color: "#3b82f6" },
  { id: "pietrofc", name: "PietroFc", president: "Pietro Fornelli", color: "#eab308" },
  { id: "fc-ma-stai-schersantos", name: "F.C. Ma Stai SCHERSANTOS", president: "Enzucc", color: "#14b8a6" },
  { id: "heinekean", name: "HeineKean", president: "KevinConstant", color: "#a3e635" },
  { id: "complessato-fc", name: "Complessato FC", president: "sfuuss", color: "#f43f5e" },
  { id: "milfwall", name: "MILFWALL", president: "Austrian Painter", color: "#64748b" },
];

const ROLE_SLOTS_PER_CLUB = { P: 3, D: 8, C: 8, A: 6 };

const SURNAMES = [
  "Rossi", "Bianchi", "Colombo", "Ferrari", "Russo", "Romano", "Gallo", "Costa", "Fontana", "Marino",
  "Greco", "Bruno", "Conti", "De Luca", "Mancini", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Villa",
  "Vitale", "Longo", "Serra", "Coppola", "Marchetti", "Leone", "Ferrara", "Rinaldi", "Caruso", "Ferri",
  "Basile", "Testa", "Grasso", "Valentini", "Messina", "Sanna", "Farina", "Neri", "Poli", "Sartori",
  "Orlando", "Amato", "Riva", "Donati", "Pellegrini", "Piras", "Palumbo", "Silvestri", "Gatti", "Guerra",
  "Mariani", "Rizzi", "Sala", "Fabbri", "Bernardi", "Vitali", "Monti", "Gentile", "Cattaneo", "Morelli",
  "Parisi", "Fiore", "Bellini", "Damico", "Cocco", "Ruggiero", "Milani", "Benedetti", "Rossetti", "Costantini",
  "Negri", "Sorrentino", "Deangelis", "Giordano", "Villani", "Farina", "Bianco", "Loi", "Napolitano", "Vitiello",
  "Fumagalli", "Colella", "Pagano", "Zanetti", "Vaccaro", "Marchi", "Cirillo", "Basso", "Guidi", "Palmieri",
  "Ferrero", "Barone", "Piazza", "Bosco", "Franco", "Fusco", "Fedeli", "Fiorentino", "Cavallo", "Rossato",
];

const FIRST_INITIALS = ["A", "L", "M", "F", "G", "D", "N", "R", "S", "T", "P", "E", "V", "C", "B"];

function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260830);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

let idCounter = 1;
function nextId() {
  return `p${String(idCounter++).padStart(4, "0")}`;
}

function makeName(usedNames) {
  let name;
  let guard = 0;
  do {
    name = `${pick(FIRST_INITIALS)}. ${pick(SURNAMES)}`;
    guard += 1;
  } while (usedNames.has(name) && guard < 50);
  usedNames.add(name);
  return name;
}

// Range fvm1000 per ruolo, calibrati sui valori reali citati nel piano
// (Malen 414, Lautaro 367, Thuram 263, Højlund 257, Çalhanoğlu 236, McTominay 228, Kean 187).
const FVM_RANGE = {
  P: { min: 4, max: 55 },
  D: { min: 3, max: 95 },
  C: { min: 3, max: 245 },
  A: { min: 3, max: 420 },
};

function fvmForRank(role, rank, total) {
  const { min, max } = FVM_RANGE[role];
  const t = total <= 1 ? 0 : rank / (total - 1); // 0 = migliore, 1 = ultimo
  const curve = Math.pow(1 - t, 2.3);
  return Math.round(min + (max - min) * curve);
}

function starterProfileForRank(rank) {
  if (rank === 0) return { starter: "fisso", starterPct: 88 + Math.round(rand() * 10) };
  if (rank === 1) return { starter: "fisso", starterPct: 70 + Math.round(rand() * 15) };
  if (rank === 2) return { starter: "ballottaggio", starterPct: 45 + Math.round(rand() * 20) };
  if (rank <= 4) return { starter: "ruota", starterPct: 30 + Math.round(rand() * 20) };
  return { starter: "riserva", starterPct: Math.round(rand() * 20) };
}

function buildRawPlayer({ name, role, team, fvm1000, rankInClub }) {
  const { starter, starterPct } = starterProfileForRank(rankInClub);
  const hasMarket = rand() < 0.62; // copertura parziale del mercato 10/500, come nella realtà del giorno 0
  const market10x500 = hasMarket ? Math.max(1, Math.round((fvm1000 / 2) * (0.82 + rand() * 0.3))) : undefined;
  const isNew = rand() < 0.05;

  return {
    id: nextId(),
    name,
    role,
    roleSource: "league_list_export",
    roleLocked: true,
    team,
    sourceSnapshot: {
      source: "synthetic-seed-2026-08-30",
      observedAt: "2026-08-30T00:00:00.000Z",
      market10x500,
      fvm1000,
      quota: Math.max(1, Math.round(fvm1000 / 20)),
      sampleQuality: hasMarket ? "medium" : "low",
      pricedIn: { starter: false, penalties: false, departure: false },
    },
    starter,
    starterPct,
    penalties: 0,
    freeKicks: 0,
    corners: 0,
    isNew: isNew && !hasMarket,
    watch: undefined,
  };
}

const players = [];
const usedNames = new Set();

for (const team of SERIE_A_TEAMS) {
  for (const role of ["P", "D", "C", "A"]) {
    const count = ROLE_SLOTS_PER_CLUB[role];
    for (let rankInClub = 0; rankInClub < count; rankInClub += 1) {
      const name = makeName(usedNames);
      // rank di club (0=titolare) spinge un'onda di variazione dentro il range di ruolo,
      // il grosso del valore lo fa comunque il rank di lega assegnato dopo l'ordinamento.
      players.push({ name, role, team, rankInClub });
    }
  }
}

// Assegna fvm1000 per rank di lega all'interno di ciascun ruolo (i migliori titolari pesano di più).
for (const role of ["P", "D", "C", "A"]) {
  const roleGroup = players.filter((p) => p.role === role);
  roleGroup.sort((a, b) => a.rankInClub - b.rankInClub || rand() - 0.5);
  roleGroup.forEach((p, i) => {
    p.fvm1000 = fvmForRank(role, i, roleGroup.length);
  });
}

const rawPlayers = players.map((p) =>
  buildRawPlayer({ name: p.name, role: p.role, team: p.team, fvm1000: p.fvm1000, rankInClub: p.rankInClub }),
);

// ---------------------------------------------------------------------------
// Patch con i giocatori realmente documentati nel piano (§2.2, §7) — valori
// reali dove dichiarati, resto lasciato a cura umana in un secondo passaggio.
// ---------------------------------------------------------------------------

function findSlot(role, team) {
  return rawPlayers.find((p) => p.role === role && p.team === team && !p._patched);
}

function patchPlayer(name, role, team, patch) {
  const slot = findSlot(role, team) ?? rawPlayers.find((p) => p.role === role && !p._patched);
  if (!slot) return;
  slot._patched = true;
  slot.name = name;
  slot.team = team;
  Object.assign(slot.sourceSnapshot, patch.sourceSnapshot);
  Object.assign(slot, patch.fields ?? {});
}

// Snapshot §2.2 — valori reali dichiarati nel piano.
patchPlayer("Lautaro Martínez", "A", "Inter", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: 137, fvm1000: 367, sampleQuality: "high" },
  fields: { starter: "fisso", starterPct: 92 },
});
patchPlayer("Thuram", "A", "Inter", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: 124.5, fvm1000: 263, sampleQuality: "high" },
  fields: { starter: "fisso", starterPct: 90 },
});
patchPlayer("Højlund", "A", "Napoli", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: undefined, fvm1000: 257, sampleQuality: "low" },
  fields: { starter: "ballottaggio", starterPct: 55, isNew: true },
});
patchPlayer("Çalhanoğlu", "C", "Inter", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: undefined, fvm1000: 236, sampleQuality: "low" },
  fields: { starter: "fisso", starterPct: 85, penalties: 1 },
});
patchPlayer("McTominay", "C", "Napoli", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: undefined, fvm1000: 228, sampleQuality: "low" },
  fields: { starter: "fisso", starterPct: 88 },
});
patchPlayer("Kolo Muani", "A", "Juventus", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: undefined, fvm1000: 211, sampleQuality: "low" },
  fields: { starter: "ballottaggio", starterPct: 50, rumor: "possibile permanenza da definire" },
});
patchPlayer("Kean", "A", "Fiorentina", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: undefined, fvm1000: 187, sampleQuality: "low" },
  fields: { starter: "fisso", starterPct: 80 },
});
patchPlayer("Nico Paz", "C", "Como", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: undefined, fvm1000: 247, sampleQuality: "low" },
  fields: { starter: "fisso", starterPct: 78 },
});
patchPlayer("Ramos", "A", "Roma", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: undefined, fvm1000: 228, sampleQuality: "low" },
  fields: { starter: "ballottaggio", starterPct: 55 },
});
// Malen: "da importare" nel piano — market10x500 esplicitamente assente, isNew (senza mercato in questo campionato).
patchPlayer("Malen", "A", "Roma", {
  sourceSnapshot: { source: "piano-snapshot-2026-08-30", market10x500: undefined, fvm1000: 414, sampleQuality: "low" },
  fields: { starter: "ballottaggio", starterPct: 60, isNew: true },
});

// Pack rumor 30/08 (§7) — ruoli/squadre indicativi, rumor testuale dal piano.
const rumorPack = [
  { name: "Balerdi", role: "D", team: "Marsiglia (rumor)", rumor: "rumor mercato in uscita" },
  { name: "Theate", role: "D", team: "Bologna", rumor: "rumor mercato" },
  { name: "Dovbyk", role: "A", team: "Roma", rumor: "rumor mercato" },
  { name: "Piccoli", role: "A", team: "Cagliari", rumor: "rumor mercato" },
  { name: "Kessié", role: "C", team: "Como", rumor: "rumor mercato, ritorno in Serie A" },
  { name: "Elmas", role: "C", team: "Torino", rumor: "rumor mercato" },
  { name: "Kristensen", role: "D", team: "Udinese", rumor: "rumor mercato" },
  { name: "Gaetano", role: "C", team: "Cagliari", rumor: "rumor mercato" },
  { name: "Ricci", role: "C", team: "Milan", rumor: "rumor mercato" },
  { name: "Couto", role: "D", team: "Como", rumor: "rumor mercato" },
  { name: "Chalobah", role: "D", team: "Como", rumor: "rumor mercato" },
  { name: "Perri", role: "P", team: "Lecce", rumor: "rumor mercato" },
  { name: "Vicario", role: "P", team: "Udinese", rumor: "rumor mercato in uscita" },
  { name: "Lucumí", role: "D", team: "Bologna", rumor: "rumor mercato" },
  { name: "Douglas Luiz", role: "C", team: "Juventus", rumor: "rumor mercato in uscita" },
  { name: "Ngonge", role: "A", team: "Napoli", rumor: "rumor mercato" },
  { name: "Folorunsho", role: "C", team: "Fiorentina", rumor: "rumor mercato" },
  { name: "Juan Jesus", role: "D", team: "Napoli", rumor: "rumor mercato" },
  { name: "Leao", role: "A", team: "Milan", rumor: "Leao→Galatasaray", departureRisk: 75 },
  { name: "Solet", role: "D", team: "Udinese", rumor: "departureRisk segnalato dal piano", departureRisk: 65 },
  { name: "Hutchinson", role: "C", team: "Como", rumor: "rumor mercato" },
];

for (const r of rumorPack) {
  const slot = findSlot(r.role, r.team) ?? rawPlayers.find((p) => p.role === r.role && !p._patched);
  if (!slot) continue;
  slot._patched = true;
  slot.name = r.name;
  slot.team = r.team;
  slot.rumor = r.rumor;
  if (r.departureRisk) slot.departureRisk = r.departureRisk;
}

for (const p of rawPlayers) delete p._patched;

// Banner mercato: la finestra estiva chiude 1/09/2026 20:00 (§1, §7) — puramente informativo, non un campo player.

writeFileSync(
  join(OUT_DIR, "players.2026-08-30.json"),
  JSON.stringify(rawPlayers, null, 2) + "\n",
  "utf-8",
);

const teams = FANTASY_TEAMS.map((t) => ({
  id: t.id,
  name: t.name,
  president: t.president,
  color: t.color,
  budget: 1000,
  spent: 0,
  roster: [],
  profile: "balanced_md",
}));

writeFileSync(join(OUT_DIR, "teams.json"), JSON.stringify(teams, null, 2) + "\n", "utf-8");

console.log(`Generati ${rawPlayers.length} giocatori e ${teams.length} squadre.`);
const counts = rawPlayers.reduce((acc, p) => {
  acc[p.role] = (acc[p.role] ?? 0) + 1;
  return acc;
}, {});
console.log("Distribuzione ruoli:", counts);
