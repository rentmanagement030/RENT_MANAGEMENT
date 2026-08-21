import { useEffect, useRef } from "react";

export function usePageResetOnFilter(setPage: (page: number) => void, ...deps: unknown[]) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
