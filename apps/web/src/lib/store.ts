/** What this phone remembers between visits. Every read and write survives a browser that refuses storage. */
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };
const json = <T>(k: string): T | null => { const s = get(k); if (!s) return null; try { return JSON.parse(s) as T; } catch { return null; } };
/** what lasts the visit only (this tab, through its reloads) */
const getNow = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const setNow = (k: string, v: string | null) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch {} };

export function deviceId() {
  let d = get('pa.device');
  if (!d) { d = (crypto as any).randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; set('pa.device', d); }
  return d!;
}
export const store = {
  /** the sound is on whenever the stage is opened anew: muting it lasts the visit, not for good */
  soundOn: () => getNow('pa.sound') !== 'off', setSoundOn: (on: boolean) => setNow('pa.sound', on ? null : 'off'),
  email: () => get('pa.email'), setEmail: (e: string | null) => set('pa.email', e),
  newsOk: () => get('pa.news') === 'yes', setNewsOk: (on: boolean) => set('pa.news', on ? 'yes' : null),
  name: () => get('pa.name'), setName: (n: string | null) => set('pa.name', n),
  /** a verified sender, so a second note sent by email needs no new code */
  sender: () => json<{ email: string; token: string }>('pa.sender'), setSender: (s: { email: string; token: string } | null) => set('pa.sender', s ? JSON.stringify(s) : null),
  /** the notebook on this phone, so a reload or the next visit carries on (`at`: when it last had a note written) */
  notebook: () => json<{ id: string; token: string; at: number }>('pa.notebook'), setNotebook: (d: { id: string; token: string } | null) => set('pa.notebook', d ? JSON.stringify({ ...d, at: Date.now() }) : null),
  /** past tracklists on this phone, newest first */
  tracklists: () => json<{ code: string; at: number; title: string }[]>('pa.tracklists') || [],
  addTracklist: (r: { code: string; title: string }) => set('pa.tracklists', JSON.stringify([{ ...r, at: Date.now() }, ...(json<any[]>('pa.tracklists') || []).filter((x) => x.code !== r.code)].slice(0, 12))),
  /** the notes this phone has opened, by the ask's code, so coming back shows the note at once */
  opened: () => json<Record<string, number>>('pa.opened') || {}, setOpened: (code: string) => set('pa.opened', JSON.stringify({ ...(json<Record<string, number>>('pa.opened') || {}), [code]: Date.now() })),
};
