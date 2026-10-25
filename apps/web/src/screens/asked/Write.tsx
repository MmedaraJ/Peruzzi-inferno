import { CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GuitarIcon, HandsClappingIcon, MicrophoneStageIcon } from '@phosphor-icons/react';
import { ApiError, Asked, Back, NoteInfo, NoteKind, StageConfig, api } from '../../lib/api';
import { StageHandle, StageScene } from '../../components/StageScene';
import { Reaction } from '../../components/Crowd';
import { TopBar } from '../../components/TopBar';
import { Dots, OnScreen } from '../../components/ui';
import { sound } from '../../lib/sound';
import { track } from '../../lib/track';
import { useRestingSize, useTyping, useVisualViewport } from '../../lib/viewport';
import { Serious } from './Serious';
import { NoteView } from './NoteView';

type Phase = 'write' | 'reading' | 'asked' | 'serious';
/** how much each blank takes: a name or a role, and what they do in a line */
export const WHO_MAX = 28, WHAT_MAX = 80;
/** what the blanks suggest while they're empty, a pair at a time: something sweet, or something they shouldn't have */
const EXAMPLES: [string, string][] = [
  ['my crush', 'saved the last puff-puff for me on purpose'],
  ['Tobi', 'left me on read for three days, then liked my story'],
  ['my mum', 'call me just to ask if I’ve eaten'],
  ['Emeka', 'only call me when your data finishes'],
  ['my bestie', 'know my food order before I say it'],
  ['Chidi', 'ate my jollof and blamed the generator'],
  ['Kemi', 'queued at that ATM with me for two hours'],
  ['my guy', 'borrowed my charger in 2023 and never returned it'],
  ['my bed', 'hold me better than anyone ever has'],
];
/** who's on stage while Peruzzi reads, left to right: the band, Peruzzi in the middle, the crowd. They give their
 *  word in that order, Peruzzi last. */
const PANEL = (nameplate: string) => ['The band', nameplate, 'The crowd'];
/** What everyone gets up to while Peruzzi reads, each line with whoever it's about (by their place), about the person
 *  the note is for as the writer named them ("your crush", "Tolu"). */
const reading = (nameplate: string, who: string): [number, string][] => {
  const them = who.trim().replace(/^my /i, 'your ') || 'them';
  const theirs = `${them}’s`;
  return [
    [1, `${nameplate} is reading it twice…`],
    [0, 'The drummer is holding the beat…'],
    [2, `The crowd wants to know who ${them} is…`],
    [1, `${nameplate} is squinting at your handwriting…`],
    [0, 'The backing singers are exchanging looks…'],
    [2, 'Someone near the front already said “awww”…'],
    [1, 'Checking it’s love and not just December…'],
    [0, 'The band is looking for the right key…'],
    [2, 'Phones are going up all over the room…'],
    [1, `${nameplate} is looking for ${them} in the crowd…`],
    [2, `The crowd is chanting ${theirs} name…`],
    [1, `${nameplate} has read enough.`],
  ];
};
/** How the room takes each note. */
const ROOM: Record<NoteKind, Reaction> = { love: 'aww', not_love: 'laugh', nonsense: 'laugh' };
/** however soon the reading is in, the first line of the wait lands before anyone gives their word */
const FIRST_WORD_AFTER = 1100;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A note, start to finish, in one sentence: "Dear ___, you ___.", the two blanks filled in by the writer (what they
 *  did kept short by its count). Once they stop typing, Peruzzi starts on his reading, so by the time they hand it up
 *  it's ready, or nearly: the lights come up on the band and the crowd, Peruzzi last, the drummer's crash, and the
 *  note, with what they did as Peruzzi tells it and his question. The screen is pinned to the part of the page that can be seen,
 *  so the keyboard pushes the sheet up instead of sliding the stage off the top. */
export function Write({ cfg, notebook, back, notes, onAsked, onStopped, onNext, onNotes, onSave, onShare, onSend }: {
  cfg: StageConfig; notebook: { id: string; token: string }; back?: Back | null; notes: NoteInfo[];
  /** the note is read: called the moment it arrives, so the notebook has it before the note lands */
  onAsked: (n: NoteInfo) => void;
  /** the stage won't take a note now (the day's notes are used up, or it's paused) */
  onStopped: (e: ApiError) => void;
  onNext: () => void; onNotes: () => void;
  onSave: (n: NoteInfo) => void; onShare: (n: NoteInfo) => void; onSend: (n: NoteInfo) => void;
}) {
  useVisualViewport(true);
  const typing = useTyping();
  const stage = useRef<StageHandle>(null);
  const [phase, setPhase] = useState<Phase>('write');
  const [who, setWho] = useState(back?.sender || '');
  const [what, setWhat] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<NoteInfo | null>(null);
  const [serious, setSerious] = useState('');
  const [lit, setLit] = useState(0);
  const [voicing, setVoicing] = useState(false);
  const [jolt, setJolt] = useState(false);
  const [ex, setEx] = useState(() => Math.floor(Math.random() * EXAMPLES.length));
  const whoRef = useRef<HTMLInputElement>(null); const whatRef = useRef<HTMLTextAreaElement>(null);
  const voiceOn = cfg.voice.mode !== 'off';
  const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; sound.stopVoice(); }; }, []);
  const pulse = (set: (v: boolean) => void, ms: number) => { set(false); requestAnimationFrame(() => { set(true); window.setTimeout(() => set(false), ms); }); };

  // the show opens: the room settles, a finger on the mic twice ("Make some noise!", when the stage has a voice)
  useEffect(() => {
    let off = false;
    (async () => {
      await sleep(150); if (off) return;
      sound.play('whoosh', { duration: 0.6 }); sound.play('murmur', { duration: 2.2, strength: 0.7 });
      await sleep(400); if (off) return;
      await stage.current?.tap(2);
      if (off) return;
      if (voiceOn) sound.speak(api.lineUrl('open', cfg.voice.v));
    })();
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the blanks suggest a note at a time while they're empty
  const empty = !who.trim() && !what.trim();
  useEffect(() => { if (!empty || phase !== 'write') return; const t = window.setInterval(() => setEx((i) => (i + 1) % EXAMPLES.length), 3400); return () => window.clearInterval(t); }, [empty, phase]);

  // once they stop typing, Peruzzi starts on his reading (once for each version of the words)
  const drafted = useRef('');
  useEffect(() => {
    const a = who.trim(), b = what.trim(); const key = `${a}|${b}`.toLowerCase();
    if (phase !== 'write' || a.length < 2 || b.length < 6 || key === drafted.current) return;
    const t = window.setTimeout(() => { drafted.current = key; api.draft(notebook.id, notebook.token, { who: a, what: b }).catch(() => {}); }, 700);
    return () => window.clearTimeout(t);
  }, [who, what, phase, notebook.id, notebook.token]);

  /** "Peruzzi, help me ask": he reads it. */
  const handUp = () => {
    const a = who.trim(), b = what.trim();
    if (a.length < 2) { setHint('Who’s it for? A first name, or “my crush”, “my mum”.'); whoRef.current?.focus(); return; }
    if (b.length < 3) { setHint('And what do they do?'); whatRef.current?.focus(); return; }
    setHint(null); setError(null);
    (document.activeElement as HTMLElement | null)?.blur?.();   // the keyboard goes: Peruzzi has the floor
    track('write', { back: !!back, length: b.length });
    read(api.ask(notebook.id, notebook.token, { who: a, what: b }));
  };

  /** The reading: everyone on stage is up to something while it comes in (a line at a time, for as long as it takes),
   *  the lights come up on each of them, the drummer's crash, and the note, read out when the stage has a voice. */
  const read = async (asking: Promise<Asked>) => {
    setPhase('reading'); setLit(0);
    const t0 = performance.now();
    sound.play('murmur', { duration: 1.4, strength: 0.55 }); sound.play('drumroll', { duration: 2 });
    // the drumroll keeps going while Peruzzi reads
    let rolls = 1;
    const stalling = window.setInterval(() => { if (performance.now() - t0 > 1900 * rolls) { rolls++; sound.play('drumroll', { duration: 2 }); } }, 400);
    let r: Asked;
    try { r = await asking; }
    catch (e) {
      window.clearInterval(stalling);
      const err = e as ApiError;
      if (err.reason === 'daily' || err.reason === 'network' || err.reason === 'paused') { onStopped(err); return; }
      if (!mounted.current) return;
      setPhase('write'); setError(err.reason === 'offline' ? 'The connection dropped before Peruzzi could read it. Try again.' : err.message);
      return;
    }
    window.clearInterval(stalling);
    // in the notebook at once, even if they've left the stage meanwhile
    if (!r.serious) onAsked(r.note);
    if (!mounted.current) return;
    setNote(r.note);
    if (r.serious || !r.note.kind) { setSerious(r.line || ''); setPhase('serious'); sound.stopMusic(1.5); track('help_view'); return; }
    const voice = r.voice && voiceOn ? sound.prefetch(api.voiceUrl(r.note.id, { t: notebook.token })) : Promise.resolve(null);
    const early = FIRST_WORD_AFTER - (performance.now() - t0);
    if (early > 0) await sleep(early);
    for (let i = 0; i < 3; i++) {
      if (i) await sleep(220);
      if (!mounted.current) return;
      setLit(i + 1); sound.play('paper');
    }
    // the lights are up, long enough to see it, then the drummer's crash and the note
    await sleep(650);
    if (!mounted.current) return;
    sound.play('crash', { strength: 1 }); stage.current?.flash(1);
    pulse(setJolt, 420); setPhase('asked');
    await sleep(900);
    stage.current?.react(ROOM[r.note.kind] || 'aww');
    if (r.note.kind === 'love') sound.play('chime');
    const url = await voice;
    if (url && mounted.current) { setVoicing(true); await sound.speak(url); if (mounted.current) setVoicing(false); }
  };

  // the note as the notebook has it, once it's there: it knows when the note has been sent
  const kept = note ? notes.find((k) => k.id === note.id) || note : null;
  const done = phase === 'asked' || phase === 'serious';
  const writing = phase === 'write';
  // The stage is a picture of the room, so it keeps one shape and size through the whole note, the result too: it's
  // sized from the screen's width, and only kept from taking too much of a short screen (one turned on its side), so a
  // keyboard or a browser's bars never squeeze or stretch it. When a blank is tapped on a phone, it slides up behind the
  // top bar, all but its front edge and nameplate, before the keyboard is up: the blanks are clear of the keyboard by
  // the time it is, so the phone has nothing to scroll or move (which on an iPhone can leave the caret behind, away from
  // the words).
  const size = useRestingSize();
  const stageH = Math.round(Math.min(size.h * 0.4, Math.max(180, Math.min(size.w, 520) / 1.6)));
  const slide = typing && !done ? Math.round(stageH * 0.8) : 0;
  const formId = useId();
  const box = useRef<HTMLDivElement>(null);
  // the typing over or the note handed up: back to the top, the stage in full
  useEffect(() => { if (!writing || !typing) box.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [writing, typing]);
  return (
    <OnScreen>
      <div data-write className={`absolute inset-x-0 z-10 mx-auto flex w-full max-w-[520px] flex-col overflow-hidden bg-ink ${jolt ? 'jolt' : ''}`} style={{ top: 'var(--vvt, 0px)', bottom: 'var(--kb, 0px)' }}>
        <TopBar onExit={onNotes} left={
          <p className="truncate pl-2"><span className="caps text-[11px] text-bone/80">{note ? `Note ${note.noteNo}` : back ? 'Writing back' : 'Peruzzi Asks'}</span>{phase === 'asked' && note && <span className="text-[13px] text-bone/50"> · {note.title}</span>}</p>
        } className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent" />
        <div ref={box} className={`no-scrollbar relative flex min-h-0 flex-1 flex-col ${writing ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <StageScene ref={stage} nameplate={cfg.nameplate} className="shrink-0"
            style={{ height: stageH, marginTop: -slide, transition: 'height 0.5s, margin-top 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }} />
          <div className={`relative flex flex-1 flex-col ${writing ? '' : 'min-h-0'}`}>
            {/* each part gets its own scrolling box (the keys), so the note opens at its top */}
            {phase === 'serious' ? (
              <div key="serious" className="flex-1 overflow-y-auto"><Serious help={cfg.help} line={serious} onAnother={onNext} onLeave={onNotes} /></div>
            ) : phase === 'asked' && kept ? (
              <div key="asked" role="region" aria-label="Your note" className="no-scrollbar flex-1 overflow-y-auto">
                <NoteView note={kept} cfg={cfg} notes={notes} voicing={voicing}
                  primary={{ label: 'Write another note', go: onNext }}
                  onSave={() => onSave(kept)} onShare={() => onShare(kept)} onSend={() => onSend(kept)} onNotes={onNotes} />
              </div>
            ) : (
              <>
                <form id={formId} key="write" aria-label="Your note" className="flex flex-1 flex-col px-5 pt-4" onSubmit={(e) => { e.preventDefault(); handUp(); }}>
                  {!typing && (
                    <motion.div className="mb-3 text-center" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>
                      <p className="caps text-[11px] text-bone/50">{back ? `${back.sender} sent you a note` : 'Write them a note. Peruzzi will ask.'}</p>
                      <h1 className="display mt-0.5 text-[25px] leading-tight text-bone/90">{back ? `write ${back.sender} back` : 'who’s on your mind?'}</h1>
                    </motion.div>
                  )}
                  <Sheet who={who} what={what} example={EXAMPLES[ex]} whoRef={whoRef} whatRef={whatRef} locked={phase !== 'write'} nameplate={cfg.nameplate}
                    onWho={(t) => { setWho(t); setHint(null); }} onWhat={(t) => { setWhat(t); setHint(null); }} onNext={() => whatRef.current?.focus()} onHandUp={handUp} />
                  {(hint || error) && <p role="alert" className="mt-2.5 px-1 text-[15px] leading-snug text-[#ff9aae]">{hint || error}</p>}
                  {cfg.readLive && !typing && <p className="mt-3 flex items-start gap-2 px-1 text-[14.5px] leading-snug text-bone/65"><MicrophoneStageIcon size={16} className="mt-0.5 shrink-0 text-[#ff8a6b]" /><span>Make it a good one. {cfg.artist} could read the best notes out live.</span></p>}
                  <div aria-hidden className="h-6" />
                </form>
                <AnimatePresence>{phase === 'reading' && <Reading panel={PANEL(cfg.nameplate)} lines={reading(cfg.nameplate, who)} lit={lit} nameplate={cfg.nameplate} />}</AnimatePresence>
              </>
            )}
          </div>
        </div>
        {/* the foot of the screen, under the stage and the note rather than in them: there with the keyboard up, and
            never moved by the note growing or shrinking above it */}
        {writing && (
          <div className={`shrink-0 border-t border-bone/10 bg-coal/90 px-5 pt-3 ${typing ? 'pb-3' : 'safe-b'}`}>
            <button type="submit" form={formId}
              className="fire flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-xl px-6 text-[17.5px] font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,45,85,0.7)] transition-[transform,filter,opacity] duration-150 hover:brightness-110 active:scale-[0.985] disabled:opacity-60">
              <MicrophoneStageIcon size={20} weight="bold" /> {cfg.nameplate}, help me ask
            </button>
          </div>
        )}
      </div>
    </OnScreen>
  );
}

/** The note, on the stage's paper: "Dear", the first blank, "You", the second, and under them Peruzzi's question and
 *  the three boxes it will be answered in, as the note will have them. The second counts down to its limit; Return in
 *  the first goes on to the second, and in the second hands the note up. */
function Sheet({ who, what, example, whoRef, whatRef, locked, nameplate, onWho, onWhat, onNext, onHandUp }: {
  who: string; what: string; example: [string, string]; whoRef: React.RefObject<HTMLInputElement>; whatRef: React.RefObject<HTMLTextAreaElement>; locked: boolean;
  nameplate: string; onWho: (t: string) => void; onWhat: (t: string) => void; onNext: () => void; onHandUp: () => void;
}) {
  const left = WHAT_MAX - what.length;
  const word = 'display shrink-0 text-[23px] leading-none text-paper-ink';
  const blank = 'min-w-0 flex-1 rounded-none border-0 border-b-2 border-dashed border-paper-ink/35 bg-transparent px-1 text-[20px] italic text-paper-ink placeholder:text-paper-ink/35 placeholder:not-italic focus:border-solid focus:border-fire focus:outline-none disabled:opacity-70';
  /** the second blank's lines: with one in it, it's as tall as the first blank (36px) */
  const lines = 'block w-full resize-none overflow-hidden pb-1 pt-0.5 leading-[28px]';
  // the second blank is as tall as what's in it (the example, while it's empty), so its line sits under the words: a
  // line, more when it wraps, easing from one example to the next. Its twin, out of sight, holds the same words, so
  // the breaks are the browser's own.
  const twin = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const fit = () => { const t = twin.current, el = whatRef.current; if (t && el) el.style.height = `${t.scrollHeight + t.offsetHeight - t.clientHeight}px`; };
    fit(); window.addEventListener('resize', fit); document.fonts.ready.then(fit);
    return () => window.removeEventListener('resize', fit);
  }, [what, example, whatRef]);
  return (
    <div className="paper relative -rotate-[0.4deg] overflow-hidden rounded-xl px-4 pb-3.5 pt-3 shadow-[0_22px_44px_-20px_rgba(0,0,0,0.95)]">
      <span aria-hidden className="fire absolute inset-x-0 top-0 h-[5px]" />
      <p className="caps border-b border-paper-ink/15 pb-1.5 text-[10px] text-paper-ink/55">Peruzzi Asks · Your note</p>
      <label className="mt-3.5 flex items-end gap-3">
        <span className={word}>Dear</span>
        <input ref={whoRef} value={who} onChange={(e) => onWho(e.target.value.slice(0, WHO_MAX))} maxLength={WHO_MAX} disabled={locked}
          placeholder={example[0]} aria-label="Who it’s for" enterKeyHint="next" autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onNext(); } }}
          className={`${blank} h-9 pb-0.5`} />
        <span className={`${word} -ml-2`}>,</span>
      </label>
      {/* "You" sits on the first line as "Dear" sits on its blank */}
      <label className="mt-3 flex items-start gap-3">
        <span className={`${word} pt-[13px]`}>You</span>
        <span className="relative min-w-0 flex-1">
          <textarea ref={whatRef} value={what} onChange={(e) => onWhat(e.target.value.replace(/\n/g, ' ').slice(0, WHAT_MAX))} maxLength={WHAT_MAX} disabled={locked} rows={1}
            placeholder={example[1]} aria-label="What they did" aria-describedby="what-count" enterKeyHint="go"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onHandUp(); } }}
            className={`${blank} ${lines} ${what ? '' : 'motion-safe:transition-[height] motion-safe:duration-200'}`} />
          <textarea ref={twin} value={what || example[1]} readOnly disabled tabIndex={-1} aria-hidden rows={1}
            className={`${blank} ${lines} pointer-events-none invisible absolute inset-x-0 top-0`} style={{ fontStyle: what ? 'italic' : 'normal' }} />
        </span>
      </label>
      <p className="mt-1 text-right"><span id="what-count" className={`tabular text-[12.5px] ${left <= 10 ? 'text-fire' : 'text-paper-ink/45'}`}>{what.length}/{WHAT_MAX}</span></p>
      {/* Peruzzi's question, and the boxes they'll answer in, faint until then: the third is Peruzzi's to write */}
      <div className="fire mt-2 rounded-lg px-3 py-2 text-center text-white">
        <p className="caps text-[9.5px] text-white/90">{nameplate} asks</p>
        <p className="display text-[21px] leading-tight">Could this be love?</p>
      </div>
      <p aria-hidden className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-paper-ink/45">
        {['Yes', 'No', '…'].map((l) => <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block h-[13px] w-[13px] rounded-[2px] border-[1.5px] border-paper-ink/40" />{l}</span>)}
        <span className="caps text-[9px] text-paper-ink/40">They tick one</span>
      </p>
    </div>
  );
}

/** Peruzzi reads: the band, Peruzzi and the crowd on their slips, each up to something (the guitar strumming, the mic
 *  swaying, the crowd clapping), and over them, typed out a line at a time, what they're doing about the note, for as
 *  long as it takes. Then the lights come up on each of them in turn, Peruzzi's last. */
function Reading({ panel, lines, lit, nameplate }: { panel: string[]; lines: [number, string][]; lit: number; nameplate: string }) {
  // a line every 1.3 s, typed out, starting from a different one each note
  const [at, setAt] = useState(() => Math.floor(Math.random() * lines.length));
  const [typed, setTyped] = useState(0);
  const [who, line] = lines[at % lines.length];
  useEffect(() => { if (lit) return; const t = window.setInterval(() => { setAt((x) => x + 1); setTyped(0); }, 1300); return () => window.clearInterval(t); }, [lit]);
  useEffect(() => { if (typed >= line.length) return; const t = window.setTimeout(() => setTyped((n) => Math.min(line.length, n + 2)), 28); return () => window.clearTimeout(t); }, [typed, line]);
  const status = lit >= 3 ? `${nameplate} has it.` : lit > 0 ? 'The lights are coming up…' : null;
  return (
    <motion.div className="absolute inset-0 z-10 flex flex-col items-center bg-ink/[0.94] px-5 pt-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <p className="display text-center text-[30px] leading-tight text-bone">{nameplate.toLowerCase()} is reading it</p>
      <p data-ticker className="mt-2 flex min-h-[46px] max-w-sm items-start justify-center text-center text-[16px] italic leading-snug text-bone/75" aria-live="polite">
        {status ? <span className="caps pt-1 text-[12px] not-italic text-bone/85">{status}</span>
          : <span>{line.slice(0, typed)}<span className="caret ml-[2px] inline-block h-[0.9em] w-[2px] translate-y-[2px] bg-bone/60" /></span>}
      </p>
      <div className="mt-4 grid w-full max-w-sm grid-cols-3 items-end gap-2.5">
        {panel.map((p, i) => {
          const on = [0, 2, 1].indexOf(i) < lit;   // Peruzzi, in the middle, gets his light last
          const busy = !status && who === i;
          return (
            <div key={p} className="flex flex-col items-center">
              <motion.div data-lit={on ? '' : undefined} className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl px-1.5 shadow-[0_14px_30px_-14px_rgba(0,0,0,0.9)] transition-[background-color,box-shadow,color] duration-200 ${on ? 'fire text-white shadow-[0_0_34px_-4px_rgba(255,45,85,0.75)]' : 'paper text-paper-ink/80'} ${i === 1 ? 'h-[122px]' : 'h-[108px]'}`}
                style={{ rotate: [-2, 0.8, 1.6][i] }} animate={{ y: busy ? -7 : 0, scale: busy || on ? 1.04 : 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
                {busy && <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-fire/60" />}
                <SlipArt place={i} />
                <span className="mt-1.5 flex h-[24px] items-center">{on ? <span className="caps text-[11px] text-white">Ready</span> : <Dots />}</span>
              </motion.div>
              <p className={`caps mt-2 text-center text-[9px] leading-snug ${busy || on ? 'text-bone' : 'text-bone/60'}`}>{p}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/** What each one is up to: the band's guitar strumming, Peruzzi's mic swaying, the crowd clapping. */
function SlipArt({ place }: { place: number }) {
  if (place === 1) return (
    <motion.span aria-hidden className="block" style={{ originX: 0.5, originY: 0.95 }} animate={{ rotate: [0, -10, 6, -4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
      <MicrophoneStageIcon size={40} weight="fill" />
    </motion.span>
  );
  if (place === 0) return (
    <motion.span aria-hidden className="block" style={{ originX: 0.3, originY: 0.7 }} animate={{ rotate: [0, -6, 0, -6, 0], y: [0, 1, 0, 1, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}>
      <GuitarIcon size={40} weight="fill" />
    </motion.span>
  );
  return (
    <motion.span aria-hidden className="block" animate={{ scale: [1, 0.86, 1, 0.86, 1] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}>
      <HandsClappingIcon size={40} weight="fill" />
    </motion.span>
  );
}
