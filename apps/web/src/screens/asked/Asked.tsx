import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ApiError, Back, NoteInfo, Notebook, StageConfig, api } from '../../lib/api';
import { sound } from '../../lib/sound';
import { deviceId, store } from '../../lib/store';
import { track } from '../../lib/track';
import { INVITATION, noteCard, preloadNote, toBlob } from '../../lib/cards';
import { saveFile, shareFile } from '../../lib/share';
import { mover } from '../../lib/history';
import { useVisualViewport } from '../../lib/viewport';
import { savedNotebook, takeEarly } from '../../lib/early';
import { whenIdle } from '../../lib/idle';
import { MusicPill } from '../../components/TopBar';
import { Button, OnScreen, Wordmark } from '../../components/ui';
import { ListenButton } from '../../components/Listen';
import { Write } from './Write';
import { Notes } from './Notes';
import { OneNote } from './OneNote';
import { Tracklist } from './Tracklist';
import { SendSheet } from './SendSheet';
import { Answer } from './Answer';
import { Landing } from './Landing';
import { paperOf } from './NoteView';

type Status = 'loading' | 'ready' | 'closed' | 'done' | 'error';
type Card = { file?: File; ready: Promise<File> };
type View = 'landing' | 'write' | 'notes' | 'note' | 'tracklist' | 'answer';

/** the notes Peruzzi has read so far (a note he put down for help isn't kept) */
export const askedOf = (d: Notebook | null) => (d?.notes || []).filter((k) => k.status !== 'serious' && k.kind);
const viewOf = (path: string): { view: View | null; id?: string } => {
  const p = path.replace(/\/+$/, '') || '/';
  if (p === '/') return { view: 'landing' };
  if (p === '/stage') return { view: 'write' };
  if (p === '/notes') return { view: 'notes' };
  const n = /^\/notes\/([\w-]+)$/.exec(p); if (n) return { view: 'note', id: n[1] };
  if (p === '/tracklist') return { view: 'tracklist' };
  const a = /^\/answer\/([\w-]+)$/.exec(p); if (a) return { view: 'answer', id: a[1] };
  return { view: null };
};

/** Peruzzi Asks, from the way in to the tracklist, and the note as the person it's for opens it. Each screen has its
 *  own address (so the phone's back button goes where you'd expect), and this one component holds them all, so the
 *  song and the notebook carry on throughout:
 *
 *    /                the way in: the cover under the lights, the song, and the stage (its tap starts the song)
 *    /stage           a note: "Dear ___, you ___.", Peruzzi's reading, and the note with his question on it, and
 *                     his answer (?back=<ask> writes back to the one who sent that ask)
 *    /notes           your notes, with where each has got to
 *    /notes/:id       a note already asked, to save, post or send
 *    /tracklist       the tracklist
 *    /answer/:code    a note sent to you: open it, and write one back
 *
 *  Back from a note's page is your notes; back from your notes is a new note. */
export default function Asked() {
  const nav = useNavigate(); const loc = useLocation(); const [params] = useSearchParams();
  const { go, up } = mover(nav);
  const { view, id } = viewOf(loc.pathname);
  const backCode = view === 'write' ? params.get('back') : null;
  // the old address for writing back, from before there was a way in, still goes straight to the stage
  const oldBack = view === 'landing' ? params.get('back') : null;
  const [cfg, setCfg] = useState<StageConfig | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const notebookRef = useRef(notebook); notebookRef.current = notebook;
  const token = useRef('');
  const [back, setBack] = useState<Back | null>(null);
  const [writing, setWriting] = useState<{ key: number } | null>(null);
  const [send, setSend] = useState<NoteInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cards = useRef(new Map<string, Card>());
  useVisualViewport();

  useEffect(() => {
    sound.setOn(store.soundOn());
    (async () => {
      try {
        // all at once: the settings, and the notebook on this phone (either may be on its way already)
        const early = takeEarly();
        const saved = backCode || view === 'answer' ? null : savedNotebook();
        const answer = saved ? (early?.notebook?.id === saved.id ? early.notebook.answer : api.notebook(saved.id, saved.token).catch(() => null)) : null;
        const c = await (early?.stage ?? api.stage());
        setCfg(c); sound.setLevels(c.music.level, c.music.duck); sound.setCrowd(c.sfx);
        if (!c.open && view !== 'answer' && view !== 'landing') { setMessage(c.pausedMessage); setStatus('closed'); return; }
        const d = await answer;
        if (d && saved) { token.current = saved.token; setNotebook(d); }
        setStatus('ready');
      } catch (e) { setMessage((e as ApiError).message); setStatus('error'); }
    })();
    return () => { sound.stopMusic(0.6); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the stage seen, once a visit, the moment one of its screens is (the way in counts its own)
  const seenStage = useRef(false);
  useEffect(() => { if (view && view !== 'landing' && !seenStage.current) { seenStage.current = true; track('stage_view', { view, back: !!backCode }); } }, [view, backCode]);
  // the note's fonts and cover, so the paper is drawn the moment it comes
  useEffect(() => { if (status === 'ready') return whenIdle(preloadNote); }, [status]);
  // the song, on every screen past the way in, from the moment the stage opens (the way in starts it with its tap; a
  // phone that wants a tap first gets the pill), and again with each new note (a note put down for help stops it)
  useEffect(() => { if (status === 'ready' && view && view !== 'landing') sound.playOnStage(); }, [status, view, writing?.key]);

  // a note belongs to its visit: once its screen is left, coming back to it (forward, a reload) starts a new one
  const lastView = useRef(view);
  useEffect(() => { if (lastView.current === 'write' && view !== 'write') setWriting(null); lastView.current = view; }, [view]);
  const started = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || view !== 'write' || writing) return;
    if (started.current && !backCode) { newNote({ replace: true }); return; }
    started.current = true; enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, view, writing]);

  // while your notes are on screen, they keep up with what the people you sent them to have done
  useEffect(() => {
    if (status !== 'ready' || !(view === 'notes' || view === 'note') || !notebookRef.current) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15_000);
    const seen = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', seen); refresh();
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', seen); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, view]);

  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 2600); };
  const asked = askedOf(notebook);

  /** In: a new note, in the notebook this phone has (or a new one, and always a new one to write someone back); a
   *  notebook whose notes are used up for the day opens on your notes, which say when Peruzzi asks again. */
  const enter = async () => {
    let d = notebookRef.current;
    // in from a note sent to you: the notebook kept on this phone, picked up now rather than started again
    const saved = !d && !backCode ? savedNotebook() : null;
    if (saved) {
      const got = await api.notebook(saved.id, saved.token).catch(() => null);
      if (got) { token.current = saved.token; setNotebook(got); notebookRef.current = got; d = got; }
    }
    if (!d || backCode) await openNotebook();
    else if (d.left <= 0) { say('That’s your notes for today.'); go('/notes', { replace: true }); }
    else newNote({ replace: true });
  };
  const openNotebook = async () => {
    try {
      const d = await api.openNotebook(deviceId(), backCode || undefined);
      token.current = d.token; store.setNotebook({ id: d.id, token: d.token });
      const fresh: Notebook = { id: d.id, code: d.code, name: store.name(), city: null, left: d.left, back: d.back, notes: [] };
      setNotebook(fresh); notebookRef.current = fresh; setBack(d.back);
      newNote({ replace: true });
    } catch (e) { stopped(e as ApiError); }
  };
  /** A new note: the stage opens, and the writer says who and what. A notebook writing back already knows who: the
   *  one who sent the note it answers (its first note only). */
  const newNote = (o: { replace?: boolean } = {}) => {
    setWriting({ key: Date.now() });
    if (view !== 'write' || backCode) go('/stage', o);
  };
  const stopped = (e: ApiError) => {
    if (e.status === 429 && (e.reason === 'daily' || e.reason === 'network')) { setMessage(e.message); setStatus('done'); }
    else if (e.status === 403) { setMessage(e.message); setStatus('closed'); }
    else { setMessage(e.message); setStatus('error'); }
  };
  /** The notebook as the server has it: the notes sent get seen, and written back to, while you look. */
  const refresh = async () => {
    const cur = notebookRef.current; if (!cur) return null;
    const d = await api.notebook(cur.id, token.current).catch(() => null); if (!d) return null;
    setNotebook(d); return d;
  };
  /** After a note: the next one, unless the day's notes are used up. */
  const next = async () => {
    const d = (await refresh()) || notebookRef.current; if (!d) return;
    if (d.left <= 0) go('/notes');
    else { setBack(null); newNote({ replace: true }); }
  };
  /** Out of a note: your notes, or (while there are none) nowhere new. */
  const out = () => { refresh(); go('/notes'); };

  // the note's card, drawn as soon as the note has landed, so Save and Post can open the share sheet at once
  const cardData = (n: NoteInfo) => ({ ...paperOf(n, cfg), site: location.host });
  const prepare = (n: NoteInfo, andUpload = true) => {
    const card: Card = { ready: noteCard(cardData(n), 'story').then((cv) => toBlob(cv, 0.9)).then((b) => new File([b], `peruzzi-asks-note-${n.noteNo}.jpg`, { type: 'image/jpeg' })) };
    card.ready.then((f) => { card.file = f; }).catch(() => {});
    cards.current.set(n.id, card);
    if (andUpload) upload(n);
  };
  /** the square, for the link preview */
  const upload = (n: NoteInfo) => { noteCard(cardData(n), 'square').then((cv) => toBlob(cv, 0.86)).then((b) => api.saveCard('note', n.id, token.current, b)).catch(() => {}); };
  const cardFor = (n: NoteInfo) => {
    const k = cards.current.get(n.id);
    if (!k) prepare(n, false);
    if (!k?.file) { say('One moment, Peruzzi is signing it…'); return null; }
    return k.file;
  };
  /** the card to send with a note: at once if it's drawn, or as soon as it is, waiting a moment at most so the share
   *  sheet still opens from the tap */
  const cardSoon = (n: NoteInfo) => {
    const k = cards.current.get(n.id);
    if (!k) return Promise.resolve(null);
    return k.file ? Promise.resolve(k.file) : Promise.race([k.ready.catch(() => null), new Promise<null>((r) => window.setTimeout(() => r(null), 700))]);
  };
  const noteUrl = (n: NoteInfo) => `${location.origin}/q/${n.code}`;
  const actions = {
    onSave: async (n: NoteInfo) => { const f = cardFor(n); if (f) { sound.keepThrough(); const r = await saveFile(f); track('note_save', { how: r }); } },
    onShare: async (n: NoteInfo) => {
      const f = cardFor(n); if (!f) return;
      sound.keepThrough(); const r = await shareFile(f, `${cfg?.nameplate || 'Peruzzi'} asked: could this be love? ${INVITATION}`, noteUrl(n));
      track('note_share', { via: 'native', how: r }); if (r === 'copied') say('Link copied.');
    },
    // the card goes with the link: drawn now if it isn't already
    onSend: (n: NoteInfo) => { if (!cards.current.has(n.id)) prepare(n, false); setSend(n); },
  };

  // a note opened from your notes: its card gets drawn while it's on screen
  const shown = view === 'note' ? notebook?.notes.find((k) => k.id === id) : undefined;
  useEffect(() => { if (shown?.kind && !cards.current.has(shown.id)) prepare(shown, false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [shown?.id]);

  if (oldBack) return <Navigate to={`/stage?back=${encodeURIComponent(oldBack)}`} replace />;
  if (!cfg || status === 'loading') return <Splash />;
  if (view === 'landing') return <><Landing cfg={cfg} onStage={() => go('/stage')} /><MusicPill /></>;
  if (view === 'answer') return (
    <div className="min-h-dvh bg-ink">
      <Answer cfg={cfg} code={id!} onBack={() => go('/stage')} onWrite={() => go('/stage')} onWriteBack={() => go(`/stage?back=${encodeURIComponent(id!)}`)} />
      <MusicPill />
    </div>
  );
  if (status !== 'ready') return <Notice cfg={cfg} title={status === 'closed' ? 'between sets' : status === 'done' ? 'that’s all for today' : 'something went wrong'} text={message} onNotes={notebook ? () => { setStatus('ready'); go('/notes'); } : null} />;
  if (!view) return <Navigate to="/" replace />;

  let screen: React.ReactNode = null;
  if (view === 'write') {
    if (!notebook || !writing) return <Splash />;
    const first = notebook.notes.length === 0;
    screen = (
      <Write key={writing.key} cfg={cfg} notebook={{ id: notebook.id, token: token.current }} back={first ? back || notebook.back : null} notes={notebook.notes}
        onStopped={stopped}
        // the note is in the notebook the moment Peruzzi has read it (and keeps the notebook on this phone for 30 more days)
        onAsked={(n) => {
          setNotebook((d) => (d && !d.notes.some((k) => k.id === n.id) ? { ...d, left: Math.max(0, d.left - 1), notes: [...d.notes, n] } : d)); store.setNotebook({ id: notebook.id, token: token.current });
          // the cards are drawn once the note has landed: drawing them holds up the phone, and the reading is on
          // (one already drawn, for a note sent straight away, is kept: only the square still goes up)
          window.setTimeout(() => (cards.current.has(n.id) ? upload(n) : prepare(n)), 2600);
        }}
        onNext={next}
        onNotes={out}
        {...actions} />
    );
  } else if (view === 'notes') {
    if (!notebook) return <Navigate to="/stage" replace />;
    screen = <Notes notebook={notebook} onBack={() => up('/stage')} onOpen={(k) => go(`/notes/${k.id}`)} onWrite={() => newNote()} onTracklist={() => go('/tracklist')} />;
  } else if (view === 'note') {
    if (!notebook) return <Navigate to="/stage" replace />;
    if (!shown?.kind) return <Navigate to="/notes" replace />;
    const primary = notebook.left > 0 ? { label: 'Write another note', go: () => newNote() } : null;
    screen = <OneNote cfg={cfg} note={shown} notes={notebook.notes} primary={primary} onBack={() => up('/notes')} onNotes={() => up('/notes')} {...actions} />;
  } else if (view === 'tracklist') {
    if (!notebook) return <Navigate to="/stage" replace />;
    // the tracklist is there from the first note, and grows with every one after
    if (!asked.length) return <Navigate to="/notes" replace />;
    screen = <Tracklist cfg={cfg} notebook={notebook} token={token.current} onUpdate={(d) => setNotebook(d)} onWrite={notebook.left > 0 ? () => newNote() : null} onBack={() => up('/notes')} />;
  }

  return (
    <div className="min-h-dvh bg-ink">
      {screen}
      {send && notebook && <SendSheet open={!!send} onClose={() => setSend(null)} notebook={{ id: notebook.id, token: token.current }} note={send} card={() => cardSoon(send)} nameplate={cfg.nameplate}
        defaultName={notebook.name || store.name() || ''} onName={(nm) => setNotebook((d) => (d ? { ...d, name: d.name || nm } : d))} email={cfg.email}
        onSent={() => setNotebook((d) => (d ? { ...d, notes: d.notes.map((k) => (k.id === send.id ? { ...k, sent: true } : k)) } : d))} />}
      <MusicPill />
      <OnScreen><AnimatePresence>
        {toast && <motion.p className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-bone px-4 py-2 text-[14.5px] text-ink shadow-xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>{toast}</motion.p>}
      </AnimatePresence></OnScreen>
    </div>
  );
}

function Splash() {
  return <div className="night flex min-h-dvh items-center justify-center"><motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2, repeat: Infinity }}><Wordmark className="text-bone" /></motion.div></div>;
}
function Notice({ cfg, title, text, onNotes }: { cfg: StageConfig; title: string; text: string; onNotes: (() => void) | null }) {
  return (
    <div className="night relative flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <Wordmark className="relative text-bone/80" />
      <h1 className="display relative mt-6 text-[34px] leading-tight">{title}</h1>
      <p className="relative mt-3 max-w-sm text-[17px] text-bone/75">{text}</p>
      <div className="relative mt-8 flex w-full max-w-xs flex-col gap-2.5">
        <ListenButton href={cfg.smartLink} from="notice" kicker="While you wait" label={`Listen to ${cfg.song}`} />
        {onNotes && <Button kind="quiet" onClick={onNotes}>See your notes</Button>}
      </div>
    </div>
  );
}
