import { Gavel } from "lucide-react";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-fuchsia-600 shadow-glow-brand"
      style={{ width: size, height: size }}
    >
      <Gavel className="text-white" style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.4} />
    </div>
  );
}
