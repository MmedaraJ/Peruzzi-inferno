import { useEffect, useLayoutEffect, useRef } from 'react';
import { NavigateFunction, useLocation, useNavigationType } from 'react-router-dom';

/** Where each entry of this tab's history leads, so a back button can step back when the place it goes to is the
 *  entry behind (the browser's own back then agrees with it), and swap the entry when it isn't. React Router keeps
 *  each entry's position in history.state.idx; the paths are kept here, per tab, so they survive a reload. */
const KEY = 'pa.hist';
const read = (): Record<string, string> => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (m: Record<string, string>) => { try { sessionStorage.setItem(KEY, JSON.stringify(m)); } catch {} };
const idx = () => { const i = (window.history.state as { idx?: number } | null)?.idx; return typeof i === 'number' ? i : -1; };

/** Notes the entry the tab is on now. After a push, the entries ahead of it are gone. */
export function markHistory(push: boolean) {
  const i = idx(); if (i < 0) return;
  const m = read(); m[i] = location.pathname;
  if (push) for (const k of Object.keys(m)) if (+k > i) delete m[k];
  write(m);
}
/** The path of the entry behind this one, when it's known. */
export function prevPath() { const i = idx(); return i > 0 ? read()[i - 1] ?? null : null; }

/** Keeps the notes up to date on every move, whoever made it. */
export function useHistoryNotes() {
  const loc = useLocation(); const type = useNavigationType();
  useEffect(() => { markHistory(type === 'PUSH'); }, [loc.key, type]);
}

/** The page's box, #root: it scrolls, the page itself never does (see styles.css). */
export const pageBox = () => document.getElementById('root');
const scrolls = new Map<string, number>();
/** A new screen opens at its top; back or forward returns to where its screen was left. (The browser did this itself
 *  when the page scrolled; it doesn't for the page's box.) */
export function useScrollMemory() {
  const loc = useLocation(); const type = useNavigationType();
  const at = useRef({ key: loc.key, path: loc.pathname });
  // where each entry was left, noted as it scrolls: by the time a move is made the next screen is already in its place
  useEffect(() => {
    const box = pageBox(); if (!box) return;
    const note = () => { scrolls.set(at.current.key, box.scrollTop); };
    box.addEventListener('scroll', note, { passive: true });
    return () => box.removeEventListener('scroll', note);
  }, []);
  useLayoutEffect(() => {
    const was = at.current; at.current = { key: loc.key, path: loc.pathname };
    const box = pageBox(); if (!box || was.key === loc.key) return;
    if (type === 'POP') box.scrollTop = scrolls.get(loc.key) ?? 0;
    else if (was.path !== loc.pathname) box.scrollTop = 0;
  }, [loc.key, loc.pathname, type]);
}

/** Moving between screens. `go` pushes or replaces and notes it at once (two moves in a row otherwise leave a note
 *  stale); `up` goes back to `to`: a step back when it's the entry behind, else a swap. */
export function mover(nav: NavigateFunction) {
  const go = (to: string, o: { replace?: boolean; state?: unknown } = {}) => { nav(to, o); markHistory(!o.replace); };
  const up = (to: string) => { if (prevPath() === to) nav(-1); else go(to, { replace: true }); };
  return { go, up };
}
