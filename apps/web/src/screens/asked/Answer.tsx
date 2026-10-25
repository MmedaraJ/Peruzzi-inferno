import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowBendUpLeftIcon, DownloadSimpleIcon, EnvelopeOpenIcon, PencilSimpleIcon, ShareNetworkIcon } from '@phosphor-icons/react';
import { ApiError, ForAsk, StageConfig, api } from '../../lib/api';
import { StageHandle, StageScene } from '../../components/StageScene';
import { TopBar } from '../../components/TopBar';
import { Button } from '../../components/ui';
import { ListenButton } from '../../components/Listen';
import { NotePaper } from '../../components/NotePaper';
import { SessionSign } from '../../components/SessionSign';
import { noteCard, toBlob } from '../../lib/cards';
import { saveFile, shareFile } from '../../lib/share';
import { sound } from '../../lib/sound';
import { store } from '../../lib/store';
import { track } from '../../lib/track';
import { useRestingSize } from '../../lib/viewport';
import { paperOf, Step } from './NoteView';

type Phase = 'arrive' | 'open' | 'opened';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The note, for the person it was sent to. They arrive on the stage, with who it's from; one tap opens it: the
 *  spotlight swings off the stage and lands on them, and the note comes down with Peruzzi's question on it. Then it's
 *  theirs: write a note back, post it, the song. Coming back to a note already opened shows it at once. */
export function Answer({ cfg, code, onBack, onWriteBack, onWrite }: {
  cfg: StageConfig; code: string; onBack: () => void; onWriteBack: (sender: string) => void; onWrite: () => void;
}) {
  const stage = useRef<StageHandle>(null);
  const [ask, setAsk] = useState<ForAsk | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(() => (store.opened()[code] ? 'opened' : 'arrive'));
  const [card, setCard] = useState<File | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const voiceOn = cfg.voice.mode !== 'off';
  const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; sound.stopVoice(); }; }, []);

  useEffect(() => {
    api.forAsk(code).then((a) => { setAsk(a); track('answer_view', { opened: !!store.opened()[code] }); })
      .catch((e: ApiError) => setGone(e.status === 404 ? 'This note can’t be found. It may have been taken down.' : e.message));
  }, [code]);

  // the note's card, drawn once it's open, so Save and Post open the share sheet at once
  const open = phase !== 'arrive';
  useEffect(() => {
    if (!ask || !open) return;
    noteCard({ ...paperOf(ask.note, cfg), site: location.host }, 'story').then((c) => toBlob(c, 0.9))
      .then((b) => setCard(new File([b], `peruzzi-asks-${ask.note.noteNo}.jpg`, { type: 'image/jpeg' }))).catch(() => {});
  }, [ask, open, cfg]);

  /** "Open it": the spotlight finds them, and the note comes down. */
  const openIt = async () => {
    sound.unlock(); sound.startMusic();
    track('answer_open');
    store.setOpened(code);
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
  const noteUrl = ask ? `${location.origin}/q/${ask.note.code}` : '';
  return (
    <div className="relative mx-auto min-h-dvh max-w-[520px] bg-ink">
      <div className="relative">
        <StageScene ref={stage} nameplate={cfg.nameplate} style={{ height: stageH }} />
        <div className="absolute inset-x-0 top-0 z-20 bg-[#1d1418]/70">
          <TopBar onBack={onBack} backLabel="Write your own note" left={<span className="flex items-center gap-2"><SessionSign size="sm" /><span className="caps truncate text-[11px] text-bone/75">{ask ? `Note ${ask.note.noteNo}` : ''}</span></span>} />
        </div>
      </div>
      <div className="px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {!ask ? <div className="mt-6 h-80 animate-pulse rounded-xl bg-stone" /> : (
          <>
            <div className="px-1 pt-5 text-center">
              <p className="caps text-[11px] text-bone/55">A note from {ask.sender}</p>
              <h1 className="display mt-1 text-[28px] leading-tight text-bone">{who}, {cfg.nameplate.toLowerCase()} asked you something</h1>
            </div>
            <AnimatePresence mode="wait">
              {!open ? (
                <motion.div key="sealed" className="mt-5" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                  <div className="paper relative mx-auto max-w-sm -rotate-[0.6deg] rounded-xl px-5 py-5 text-center shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)]">
                    <EnvelopeOpenIcon size={30} className="mx-auto text-rose" />
                    <p className="mt-2 text-[17px] leading-snug">{ask.sender} wrote you a note, and {cfg.nameplate} is asking it for them.</p>
                  </div>
                  <div className="dock-bottom sticky bottom-0 z-10 -mx-4 mt-6 bg-ink px-4 pb-[max(4px,env(safe-area-inset-bottom))] pt-7">
                    <Button className="w-full" onClick={openIt}>Open it</Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="note" className="mt-5" initial={phase === 'open' ? { y: 70, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={{ delay: phase === 'open' ? 1.5 : 0, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                  <NotePaper note={paperOf(ask.note, cfg)} />
                  <motion.div initial={phase === 'open' ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: phase === 'open' ? 3.2 : 0, duration: 0.5 }}>
                    <button onClick={async () => { if (!card) { setToast('One moment, drawing it…'); return; } sound.keepThrough(); const r = await saveFile(card); track('answer_save', { how: r }); }}
                      className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-bone/20 px-2 text-[15px] text-bone/85 hover:border-blush/50"><DownloadSimpleIcon size={18} />Save image</button>
                    <section aria-label="Next steps" className="mt-8">
                      <p className="caps text-[11px] text-bone/55">Next steps</p>
                      <p className="mt-1.5 text-[17px] leading-snug text-bone/85">Your turn: tell {ask.sender} what they did.</p>
                      <ol className="mt-3.5 flex flex-col gap-2.5">
                        <li><Step n={1} filled kicker="Write back" label={<>Write {ask.sender} back</>} icon={<ArrowBendUpLeftIcon size={19} weight="bold" />} onClick={() => { track('back_click'); onWriteBack(ask.sender); }} /></li>
                        <li><Step n={2} kicker="Post it" label="Put it on your story" icon={<ShareNetworkIcon size={19} weight="bold" />} onClick={async () => {
                          if (!card) { setToast('One moment, drawing it…'); return; }
                          sound.keepThrough(); const r = await shareFile(card, `${cfg.nameplate} asked me: could this be love?`, noteUrl); track('answer_share', { how: r }); if (r === 'copied') setToast('Link copied.');
                        }} /></li>
                        <li><ListenButton href={cfg.smartLink} from="answer" kicker="3 · The song" label={<>Listen to {cfg.song} by {cfg.artist}</>} /></li>
                      </ol>
                    </section>
                    <Button kind="ghost" className="mt-8 w-full" onClick={() => { track('write_own_click', { from: 'answer' }); onWrite(); }}><PencilSimpleIcon size={18} /> Write your own note</Button>
                  </motion.div>
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
