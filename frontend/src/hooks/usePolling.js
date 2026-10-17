import { useEffect, useRef } from 'react';

/**
 * Runs `callback` now, then every `intervalMs` milliseconds.
 * Re-starts when anything in `deps` changes (e.g. the selected service).
 * The interval is cleared when the component unmounts (the cleanup function).
 */
export default function usePolling(callback, intervalMs, deps = [], enabled = true) {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback; // always call the latest version of the callback
  });

  useEffect(() => {
    if (!enabled) return undefined;
    saved.current();
    const id = setInterval(() => saved.current(), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled, ...deps]);
}
