/** Runs `f` once the phone has a moment to spare (at most a few seconds from now), for fetching what the next screen
 *  will need. Skipped when the phone asks to save data. Returns a canceller. */
export function whenIdle(f: () => void, timeout = 4000) {
  if ((navigator as any).connection?.saveData) return () => {};
  const w = window as any;
  if (w.requestIdleCallback) { const id = w.requestIdleCallback(f, { timeout }); return () => w.cancelIdleCallback(id); }
  const id = window.setTimeout(f, 1500); return () => window.clearTimeout(id);
}
