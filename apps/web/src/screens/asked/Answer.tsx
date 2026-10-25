import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowBendUpLeftIcon, DownloadSimpleIcon, EnvelopeOpenIcon, PencilSimpleIcon, ShareNetworkIcon, WhatsappLogoIcon } from '@phosphor-icons/react';
import { Answer as AnswerT, ApiError, ForAsk, StageConfig, api } from '../../lib/api';
import { StageHandle, StageScene } from '../../components/StageScene';
import { Reaction } from '../../components/Crowd';
import { TopBar } from '../../components/TopBar';
import { Button } from '../../components/ui';
import { ListenButton } from '../../components/Listen';
import { NotePaper } from '../../components/NotePaper';
import { SessionSign } from '../../components/SessionSign';
import { choiceLabel, noteCard, toBlob } from '../../lib/cards';
import { saveFile, shareFile } from '../../lib/share';
import { sound } from '../../lib/sound';
import { deviceId, store } from '../../lib/store';
import { track } from '../../lib/track';
import { useRestingSize } from '../../lib/viewport';
import { paperOf } from './NoteView';

type Phase = 'arrive' | 'open' | 'answered';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** How the room takes each answer, and what Peruzzi says to it (his recorded line, when there is one). */
const ROOM: Record<AnswerT, Reaction> = { yes: 'cheer', no: 'aww', escape: 'laugh' };
export const SAYS: Record<AnswerT, string> = { yes: 'I knew it.', no: 'Respect.', escape: 'Hmm. I don’t believe you.' };

/** The note, for the person it was sent to. They arrive on the stage, with who it's from; one tap opens it (and starts
 *  the song): the spotlight swings off the stage and lands on them, the note comes down with Peruzzi's question on it,
 *  and they tick one box. The room answers with them, Peruzzi says his piece, and the ticked note is theirs to send
 *  back, post, or answer with a note of their own. Coming back to a note already answered shows the answer. */
export function Answer({ cfg, code, onBack, onWriteBack, onWrite }: {
  cfg: StageConfig; code: string; onBack: () => void; onWriteBack: (sender: string) => void; onWrite: () => void;
}) {
  const stage = useRef<StageHandle>(null);
  const [ask, setAsk] = useState<ForAsk | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('arrive');
  const [answer, setAnswer] = useState<AnswerT | null>(null);
  const [tickable, setTickable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState<File | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const voiceOn = cfg.voice.mode !== 'off';
  const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; sound.stopVoice(); }; }, []);

  useEffect(() => {
    api.forAsk(code).then((a) => {
      setAsk(a); track('answer_view', { answered: !!a.note.answer });
      // answered already (here, or by whoever had the link first): the answer, straight away
      if (a.note.answer) { setAnswer(a.note.answer); setPhase('answered'); }
    }).catch((e: ApiError) => setGone(e.status === 404 ? 'This note can’t be found. It may have been taken down.' : e.message));
  }, [code]);

  // the answered note's card, drawn once there's an answer, so Save and Post open the share sheet at once; the square
  // goes up for the link preview the first time
  const sent = useRef(false);
  useEffect(() => {
    if (!ask || !answer) return;
    const d = { ...paperOf({ ...ask.note, answer }, cfg), site: location.host };
    noteCard(d, 'story').then((c) => toBlob(c, 0.9)).then((b) => setCard(new File([b], `peruzzi-asks-${ask.note.noteNo}-answered.jpg`, { type: 'image/jpeg' }))).catch(() => {});
    if (!sent.current && !store.answered()[`card:${code}`]) {
      sent.current = true;
      noteCard(d, 'square').then((c) => toBlob(c, 0.86)).then((b) => api.saveCard('answer', code, '', b)).then(() => store.setAnswered(`card:${code}`, '1')).catch(() => {});
    }
  }, [ask, answer, code, cfg.nameplate, cfg.song, cfg.artist]);

  /** "Open it": the tap that starts the sound. The spotlight finds them, and the note comes down. */
  const open = async () => {
    sound.unlock(); sound.startMusic();
    track('answer_open');
    setPhase('open');
    await sleep(200);
    sound.play('murmur', { duration: 1.6, strength: 0.6 });
    await stage.current?.sweep();
    if (!mounted.current) return;
    if (voiceOn) sound.speak(api.lineUrl('found', cfg.voice.v)); else stage.current?.say(`${cfg.nameplate}: “Somebody here has a question for you.”`, 2600);
    await sleep(900);
    if (!mounted.current) return;
    sound.play('paper', { strength: 0.8 });
    await sleep(500);
    stage.current?.react('ooh');
    await sleep(900);
    if (mounted.current) setTickable(true);
  };

  /** Their tick. The first one counts. */
  const tick = async (a: AnswerT) => {
    if (busy || answer) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.answer(code, a, deviceId());
      const final = r.note.answer || a;
      setAnswer(final); store.setAnswered(code, final);
      setAsk((x) => (x ? { ...x, note: r.note } : x));
      sound.play('tick');
      await sleep(450);
      if (!mounted.current) return;
      stage.current?.react(ROOM[final]);
      if (final === 'yes') sound.play('chime');
      await sleep(700);
      if (!mounted.current) return;
      if (voiceOn) sound.speak(api.lineUrl(final, cfg.voice.v));
      stage.current?.say(`${cfg.nameplate}: “${SAYS[final]}”`, 3000);
      await sleep(1100);
      if (mounted.current) setPhase('answered');
    } catch (e) { setErr((e as ApiError).message); }
    finally { setBusy(false); }
  };

  const size = useRestingSize();
  const stageH = Math.round(Math.min(size.h * 0.42, Math.max(200, Math.min(size.w, 520) / 1.45)));
  if (gone) return (
    <div className="night flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <h1 className="display text-[32px]">this note is gone</h1>
      <p className="mt-3 max-w-sm text-bone/70">{gone}</p>
      <Button className="mt-8 w-full max-w-xs" onClick={onWrite}>Write your own note</Button>
    </div>
  );
  const who = ask ? ask.recipient || ask.note.dear : '';
  const shareText = (a: AnswerT) => `${cfg.nameplate} asked me if this could be love. I ticked ${a === 'escape' ? `“${(ask?.note.escape || '').replace(/[.]$/, '')}”` : choiceLabel(a, '').toLowerCase()}.`;
  const noteUrl = ask ? `${location.origin}/q/${ask.note.code}` : '';
  return (
    <div className="relative mx-auto min-h-dvh max-w-[520px] bg-ink">
      <div className="relative">
        <StageScene ref={stage} nameplate={cfg.nameplate} style={{ height: stageH }} />
        <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 to-transparent">
          <TopBar onBack={onBack} backLabel="Write your own note" left={<span className="flex items-center gap-2"><SessionSign size="sm" /><span className="caps truncate text-[11px] text-bone/75">{ask ? `Note ${ask.note.noteNo}` : ''}</span></span>} />
        </div>
      </div>
      <div className="px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {!ask ? <div className="mt-6 h-80 animate-pulse bg-stone/60" /> : (
          <>
            <div className="px-1 pt-5 text-center">
              <p className="caps text-[11px] text-bone/55">{phase === 'answered' ? 'You answered' : `A note from ${ask.sender}`}</p>
              <h1 className="display mt-1 text-[28px] leading-tight text-bone">{phase === 'answered' ? `you ticked ${answer === 'escape' ? 'the third box' : choiceLabel(answer!, '').toLowerCase()}` : `${who}, ${cfg.nameplate.toLowerCase()} asked you something`}</h1>
            </div>
            <AnimatePresence mode="wait">
              {phase === 'arrive' ? (
                <motion.div key="sealed" className="mt-5" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                  <div className="paper relative mx-auto max-w-sm -rotate-[0.6deg] px-5 py-5 text-center shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)]">
                    <EnvelopeOpenIcon size={30} className="mx-auto text-paper-ink/70" />
                    <p className="mt-2 text-[17px] leading-snug">{ask.sender} wrote you a note, and {cfg.nameplate} is asking it for them.</p>
                    <p className="caps mt-2 text-[10px] text-paper-ink/55">One tick only · Take your time</p>
                  </div>
                  <div className="dock-bottom sticky bottom-0 z-10 -mx-4 mt-6 bg-gradient-to-t from-[#12050f] from-[62%] to-transparent px-4 pb-[max(4px,env(safe-area-inset-bottom))] pt-7">
                    <Button className="w-full" onClick={open}>Open it</Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="note" className="mt-5" initial={phase === 'open' ? { y: 70, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={{ delay: phase === 'open' ? 1.5 : 0, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                  <NotePaper note={paperOf(ask.note, cfg)} answer={answer} onTick={tickable && !answer ? tick : undefined} />
                  <AnimatePresence>
                    {phase === 'open' && !answer && tickable && (
                      <motion.p key="hint" className="caps mt-3 text-center text-[11px] text-bone/70" initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 1.8, repeat: Infinity }}>
                        Tick one box on the note
                      </motion.p>
                    )}
                  </AnimatePresence>
                  {err && <p role="alert" className="mt-3 text-center text-[15px] text-[#ff9aae]">{err}</p>}
                  {phase === 'answered' && answer && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                      <button onClick={async () => { if (!card) { setToast('One moment, drawing it…'); return; } sound.keepThrough(); const r = await saveFile(card); track('answer_save', { how: r }); }}
                        className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-bone/20 px-2 text-[15px] text-bone/85 hover:border-bone/50"><DownloadSimpleIcon size={18} />Save image</button>
                      <section aria-label="Next steps" className="mt-8">
                        <p className="caps text-[11px] text-bone/55">Next steps</p>
                        <p className="mt-1.5 text-[17px] leading-snug text-bone/85">{ask.sender} can see your answer now.</p>
                        <ol className="mt-3.5 flex flex-col gap-2.5">
                          <li><a href={`https://wa.me/?text=${encodeURIComponent(`${ask.sender}, I answered your note. ${noteUrl}`)}`} target="_blank" rel="noreferrer" onClick={() => { sound.keepThrough(); track('answer_send_back'); }}
                            className="fire flex min-h-[64px] items-center gap-3.5 rounded-xl py-2.5 pl-3 pr-4 text-white shadow-[0_12px_32px_-12px_rgba(255,45,85,0.7)]">
                            <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-white/20 text-white"><WhatsappLogoIcon size={20} weight="fill" /></span>
                            <span className="min-w-0 flex-1"><span className="caps block text-[10px] text-white/85">1 · Tell {ask.sender}</span><span className="mt-0.5 block text-[17.5px] font-semibold leading-snug">Send your answer back</span></span>
                          </a></li>
                          <li><button onClick={async () => { if (!card) { setToast('One moment, drawing it…'); return; } sound.keepThrough(); const r = await shareFile(card, shareText(answer), noteUrl); track('answer_share', { how: r }); if (r === 'copied') setToast('Link copied.'); }}
                            className="flex min-h-[64px] w-full items-center gap-3.5 rounded-xl border border-bone/30 py-2.5 pl-3 pr-4 text-left text-bone hover:border-bone/60">
                            <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-bone/35"><ShareNetworkIcon size={19} weight="bold" /></span>
                            <span className="min-w-0 flex-1"><span className="caps block text-[10px] text-bone/55">2 · Post it</span><span className="mt-0.5 block text-[17.5px] font-semibold leading-snug">Put it on your story</span></span>
                          </button></li>
                          <li><ListenButton href={cfg.smartLink} from="answer" kicker="3 · The song" label={<>Listen to {cfg.song} by {cfg.artist}</>} /></li>
                        </ol>
                      </section>
                      <div className="mt-8 flex flex-col gap-2.5">
                        <Button onClick={() => { track('back_click'); onWriteBack(ask.sender); }}><ArrowBendUpLeftIcon size={19} weight="bold" /> Write {ask.sender} back</Button>
                        <Button kind="ghost" onClick={() => { track('write_own_click', { from: 'answer' }); onWrite(); }}><PencilSimpleIcon size={18} /> Write your own note</Button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
      <AnimatePresence>
        {toast && <motion.p className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-bone px-4 py-2 text-[14.5px] text-ink shadow-xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} onAnimationComplete={() => window.setTimeout(() => setToast(null), 1800)}>{toast}</motion.p>}
      </AnimatePresence>
    </div>
  );
}
