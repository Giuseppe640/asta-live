import { Gavel, ListFilter, Radar, RefreshCw, Swords, Users } from "lucide-react";

export type Tab = "battitore" | "radar" | "scouting" | "rivali" | "rose" | "sync";

export const TABS: { id: Tab; label: string; Icon: typeof Gavel }[] = [
  { id: "battitore", label: "Battitore", Icon: Gavel },
  { id: "radar", label: "Radar", Icon: Radar },
  { id: "scouting", label: "Scouting", Icon: ListFilter },
  { id: "rivali", label: "Rivali", Icon: Swords },
  { id: "rose", label: "Rose", Icon: Users },
  { id: "sync", label: "Sync", Icon: RefreshCw },
];
