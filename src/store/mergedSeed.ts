import playersSeed from "../data/players.2026-09-01.json";
import type { RawPlayer } from "./loadPack";
import { loadAllUpdatePacks, mergeUpdatePacks } from "./updatePack";

/** Listone base + tutti gli updates/*.json disponibili, già uniti in ordine di data. */
export function getMergedRawPlayers(): RawPlayer[] {
  const packs = loadAllUpdatePacks();
  const { players } = mergeUpdatePacks(playersSeed as RawPlayer[], packs);
  return players;
}
