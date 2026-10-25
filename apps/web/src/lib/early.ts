import { Notebook, StageConfig, api } from './api';
import { store } from './store';

/** The stage's first two questions to the server (its settings, and the notebook kept on this phone), asked the moment
 *  a page opens on one of its addresses, so the answers come back while the stage's own code is still downloading
 *  instead of after it, and side by side instead of one after the other. The stage takes them once, as it opens. */
type First = { stage: Promise<StageConfig>; notebook: { id: string; answer: Promise<Notebook | null> } | null };
let first: First | null = null;

/** A notebook kept on this phone is picked up again for 30 days after its last note: the tracklist keeps growing from
 *  one visit to the next. */
export const savedNotebook = () => { const d = store.notebook(); return d && Date.now() - d.at < 30 * 86400_000 ? d : null; };

export function askEarly() {
  if (first) return;
  // someone writing back, or opening a note sent to them, starts from the note: the notebook on this phone can wait
  const saved = new URLSearchParams(location.search).has('back') || location.pathname.startsWith('/answer/') ? null : savedNotebook();
  first = { stage: api.stage(), notebook: saved ? { id: saved.id, answer: api.notebook(saved.id, saved.token).catch(() => null) } : null };
  first.stage.catch(() => {});   // whoever takes it handles a failure
}

export function takeEarly() { const f = first; first = null; return f; }
