import { Gavel, ListFilter, RefreshCw, Users } from "lucide-react";

export type Tab = "battitore" | "scouting" | "rose" | "sync";

export const TABS: { id: Tab; label: string; Icon: typeof Gavel }[] = [
  { id: "battitore", label: "Battitore", Icon: Gavel },
  { id: "scouting", label: "Scouting", Icon: ListFilter },
  { id: "rose", label: "Rose", Icon: Users },
  { id: "sync", label: "Sync", Icon: RefreshCw },
];
