/** Every call to the API. The site and the API share an address (Vite's proxy locally, Vercel's rewrites live). */

export class ApiError extends Error { constructor(public status: number, message: string, public reason?: string) { super(message); } }

/** A failed reply that didn't come from the server: it was restarting, or something on the way gave up. */
const noAnswer = (status: number) => status === 502 || status === 503 ? `The server didn’t answer (${status}). It may be restarting after an update: try again in a minute.`
  : status === 504 ? 'The voice took too long to come back (504). Try again in a moment.'
  : `The voice didn’t come back (${status}). Try again.`;

/** set by the admin page: its session has run out, so it goes back to its sign-in form */
let signedOut: (() => void) | null = null;
export const whenSignedOut = (f: (() => void) | null) => { signedOut = f; };

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try { res = await fetch(path, { ...init, headers: { ...(init.body && !(init.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } }); }
  catch { throw new ApiError(0, 'No connection. Check your network and try again.', 'offline'); }
  const text = await res.text(); let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    if (res.status === 401 && new Headers(init.headers).has('x-admin-token')) signedOut?.();
    throw new ApiError(res.status, (data && data.message) || 'Something went wrong. Try again.', data?.reason);
  }
  return data as T;
}
const post = <T>(path: string, body: any) => req<T>(path, { method: 'POST', body: JSON.stringify(body) });
const put = <T>(path: string, body: any) => req<T>(path, { method: 'PUT', body: JSON.stringify(body) });

// ---- types ---------------------------------------------------------------------------------------------------------
export interface Site { artist: string; song: string; smartLink: string; handle: string; demoNotice: boolean; demoText: string; credit: boolean; stats: { asked: number; answered: number } }
export interface StageConfig {
  open: boolean; pausedMessage: string; nameplate: string; notesPerDay: number; asksPerDay: number;
  email: boolean; voice: { mode: 'off' | 'mc' | 'artist_lines' | 'artist_ai'; aiLabel: string; v?: string };
  music: { level: number; duck: number };
  help: { title: string; body: string; links: { label: string; url: string }[] };
  smartLink: string; artist: string; song: string; handle: string;
  /** tell people Peruzzi may read the best notes out live */
  readLive?: boolean;
  /** the crowd's voices the server has, by version ("new": made the first time it's asked for) */
  sfx?: Record<string, string>;
}
/** love nearly always; not_love for a complaint dressed as a love note; nonsense when there was nothing to read */
export type NoteKind = 'love' | 'not_love' | 'nonsense';
/** the three boxes: Yes, No, and the third Peruzzi wrote */
export type Answer = 'yes' | 'no' | 'escape';
/** A note as the phone that wrote it sees it. `dear`: who it's to, as the note says it after "Dear" ("Tolu", "Crush");
 *  `thing`: something that can't answer (a bed, jollof); `title`: as Peruzzi titled it, like a track. */
export interface NoteInfo {
  id: string; code: string; noteNo: string; n: number; dear: string; thing: boolean; title: string; status?: string; kind: NoteKind | null;
  line: string | null; escape: string | null; answer: Answer | null; answeredAt: string | null; seenAt: string | null; sent: boolean; createdAt?: string;
}
/** the note a notebook writes back to: who sent it, to whom, what it said, and how it was answered */
export interface Back { sender: string; dear: string; line: string; answer: string | null }
/** The notes written on this phone, as many as they like; the tracklist is made of them. */
export interface Notebook { id: string; code: string; name: string | null; city: string | null; left: number; back: Back | null; notes: NoteInfo[] }
/** "Dear <who>, I think you <what>. Could this be love?" */
export interface Written { who: string; what: string; name?: string }
/** Peruzzi's reading: the note with his line, or (serious) Peruzzi stepping out of character. `voice`: it can be heard. */
export interface Asked { note: NoteInfo; serious: boolean; line: string | null; voice: boolean; left: number }
/** A note as anyone with its link sees it: Peruzzi's words and the tidied line, never what was typed. */
export interface PublicNote {
  code: string; noteNo: string; dear: string; thing: boolean; title: string; kind: NoteKind | null; line: string; escape: string;
  answer: Answer | null; answeredAt: string | null; writer: string | null; city: string | null; date: string;
}
/** The note, for the person it was sent to: who it's from and what it says (and their answer, once given). */
export interface ForAsk { code: string; sender: string; recipient: string | null; note: PublicNote }
export interface PublicTracklist { code: string; name: string | null; city: string | null; date: string; count: number; notes: PublicNote[] }

export const api = {
  site: () => req<Site>('/api/site'),
  stage: () => req<StageConfig>('/api/stage/config'),
  openNotebook: (device: string, back?: string) => post<{ id: string; token: string; code: string; back: Back | null; left: number }>('/api/notebooks', { device, back }),
  notebook: (id: string, token: string) => req<Notebook>(`/api/notebooks/${id}?t=${encodeURIComponent(token)}`),
  updateNotebook: (id: string, token: string, b: { name?: string; city?: string; tracklist?: boolean }) => put<Notebook>(`/api/notebooks/${id}`, { token, ...b }),
  /** the writer has stopped typing: Peruzzi can start on his reading */
  draft: (notebookId: string, token: string, b: Written) => post<{ ok: true }>(`/api/notebooks/${notebookId}/draft`, { token, ...b }),
  ask: (notebookId: string, token: string, b: Written) => post<Asked>(`/api/notebooks/${notebookId}/ask`, { token, ...b }),
  sendLink: (noteId: string, token: string, senderName?: string, recipientName?: string) => post<{ code: string; url: string }>(`/api/notes/${noteId}/send`, { token, channel: 'link', senderName, recipientName }),
  sendEmail: (noteId: string, token: string, b: { contactToken: string; senderName?: string; recipientEmail: string; recipientName?: string }) => post<{ ok: true; left: number }>(`/api/notes/${noteId}/send`, { token, channel: 'email', ...b }),
  forAsk: (code: string) => req<ForAsk>(`/api/asks/${encodeURIComponent(code)}`),
  answer: (code: string, answer: Answer, device: string) => post<{ note: PublicNote; already: boolean }>(`/api/asks/${encodeURIComponent(code)}/answer`, { answer, device }),
  note: (code: string) => req<PublicNote>(`/api/n/${encodeURIComponent(code)}`),
  tracklist: (code: string) => req<PublicTracklist>(`/api/t/${encodeURIComponent(code)}`),
  /** a card for link previews: a note as asked, a note ticked (sent by the phone that answered, keyed by the ask's
   *  code), or a tracklist */
  saveCard: (kind: 'note' | 'answer' | 'notebook', id: string, token: string, blob: Blob) => req<{ ok: true }>(`/api/cards/${kind}/${encodeURIComponent(id)}`, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg', 'x-token': token } }),
  sendCode: (email: string, device: string) => post<{ ok: true }>('/api/contacts/code', { email, device }),
  verify: (email: string, code: string, device: string, name?: string) => post<{ contactToken: string; email: string }>('/api/contacts/verify', { email, code, device, name }),
  emailTracklist: (notebookId: string, token: string, email: string, marketing: boolean) => post<{ ok: true }>(`/api/notebooks/${notebookId}/email`, { token, email, marketing }),
  /** Peruzzi's line on a note, read aloud: for the phone that wrote it (`t`, its notebook's token) or the one it was
   *  sent to (`a`, the ask's code) */
  voiceUrl: (noteId: string, key: { t?: string; a?: string }) => `/api/voice/note/${noteId}?${key.t ? `t=${encodeURIComponent(key.t)}` : `a=${encodeURIComponent(key.a || '')}`}`,
  /** a fixed line's reading ("Make some noise!"), in the voice the stage has now (v) */
  lineUrl: (key: string, v?: string) => `/api/voice/line/${key}${v ? `?v=${v}` : ''}`,
};

// ---- admin ---------------------------------------------------------------------------------------------------------
export interface GallerySound { key: string; label: string; text: string; source: 'made' | 'upload' | null; updatedAt: string | null; failed: boolean; problem?: string | null }
/** Admin calls carry the session token from signing in (`t`), never the password. A 401 means the session has run out
 *  or the password has changed: the admin page, listening, goes back to its sign-in form. */
const adminHeaders = (t: string) => ({ 'x-admin-token': t });
const adminFetch = (path: string, t: string, init: RequestInit = {}) => fetch(path, { ...init, headers: { ...adminHeaders(t), ...(init.headers || {}) } })
  .then((r) => { if (r.status === 401) signedOut?.(); return r; });
export const admin = {
  login: (password: string) => post<{ token: string; expiresAt: number }>('/api/admin/login', { password }),
  config: (t: string) => req<{ values: any; defaults: any; status: any }>('/api/admin/config', { headers: adminHeaders(t) }),
  save: (t: string, key: string, value: any) => req<{ ok: true; value: any }>(`/api/admin/config/${key}`, { method: 'PUT', body: JSON.stringify({ value }), headers: adminHeaders(t) }),
  reset: (t: string, key: string) => req<{ ok: true; value: any }>(`/api/admin/config/${key}/reset`, { method: 'POST', headers: adminHeaders(t) }),
  countFrom: (t: string, clear = false) => req<{ ok: true }>('/api/admin/count-from', { method: 'POST', body: JSON.stringify({ clear }), headers: adminHeaders(t) }),
  insights: (t: string, days: number) => req<any>(`/api/admin/insights?days=${days}`, { headers: adminHeaders(t) }),
  costs: (t: string) => req<any>('/api/admin/costs', { headers: adminHeaders(t) }),
  notes: (t: string, filter: string, before?: number, q?: string) => req<any[]>(`/api/admin/notes?filter=${filter}${before ? `&before=${before}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { headers: adminHeaders(t) }),
  note: (t: string, id: string) => req<any>(`/api/admin/notes/${id}`, { headers: adminHeaders(t) }),
  hide: (t: string, id: string, hidden: boolean) => req<any>(`/api/admin/notes/${id}/hide`, { method: 'POST', body: JSON.stringify({ hidden }), headers: adminHeaders(t) }),
  asks: (t: string) => req<any[]>('/api/admin/asks', { headers: adminHeaders(t) }),
  contacts: (t: string) => req<any>('/api/admin/contacts', { headers: adminHeaders(t) }),
  contactsCsv: (t: string) => adminFetch('/api/admin/contacts?format=csv', t).then((r) => r.blob()),
  testEmail: (t: string, kind: string, to: string) => req<{ ok: boolean; dryRun: boolean; html: string }>('/api/admin/emails/test', { method: 'POST', body: JSON.stringify({ kind, to }), headers: adminHeaders(t) }),
  voiceLines: (t: string) => req<{ key: string; text: string; recorded: string | null }[]>('/api/admin/voice-lines', { headers: adminHeaders(t) }),
  uploadLine: (t: string, key: string, file: File) => req<{ ok: true }>(`/api/admin/voice-lines/${key}`, { method: 'PUT', body: file, headers: { ...adminHeaders(t), 'Content-Type': file.type || 'audio/mpeg' } }),
  removeLine: (t: string, key: string) => req<{ ok: true }>(`/api/admin/voice-lines/${key}`, { method: 'DELETE', headers: adminHeaders(t) }),
  sounds: (t: string) => req<GallerySound[]>('/api/admin/sounds', { headers: adminHeaders(t) }),
  soundAudio: (t: string, key: string) => adminFetch(`/api/admin/sounds/${key}/audio`, t).then((r) => (r.ok ? r.blob() : null)),
  makeSound: (t: string, key: string) => req<GallerySound[]>(`/api/admin/sounds/${key}/make`, { method: 'POST', headers: adminHeaders(t) }),
  uploadSound: (t: string, key: string, file: File) => req<GallerySound[]>(`/api/admin/sounds/${key}`, { method: 'PUT', body: file, headers: { ...adminHeaders(t), 'Content-Type': file.type || 'audio/mpeg' } }),
  removeSound: (t: string, key: string) => req<GallerySound[]>(`/api/admin/sounds/${key}`, { method: 'DELETE', headers: adminHeaders(t) }),
  lineAudio: (t: string, key: string) => adminFetch(`/api/admin/voice-lines/${key}/audio`, t).then((r) => (r.ok ? r.blob() : null)),
  /** the reading, or why there isn't one: the server's own reason, or what the reply says when the server didn't send it */
  tryVoice: (t: string, voice: 'mc' | 'artist', text?: string) => adminFetch('/api/admin/voice/try', t, { method: 'POST', body: JSON.stringify({ voice, text }), headers: { 'Content-Type': 'application/json' } })
    .then(async (r): Promise<{ audio: Blob | null; problem: string | null }> => (r.ok ? { audio: await r.blob(), problem: null } : { audio: null, problem: (await r.json().catch(() => null))?.message || noAnswer(r.status) })),
};
