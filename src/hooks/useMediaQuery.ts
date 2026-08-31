import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// 1024px = breakpoint "lg" di Tailwind: se in futuro cambia in src/index.css, va aggiornato anche qui.
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
