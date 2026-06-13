"use client";

import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of
 * stability. Each new `value` (re-keystroke) resets the timer, so rapid changes
 * collapse into a single trailing update.
 *
 * Generic platform util (no domain imports). Used by the Session Library search
 * input to keep typing responsive while throttling the filter recomputation.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
