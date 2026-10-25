import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crowd, CROWD_WORDS, Reaction } from './Crowd';
import { sound } from '../lib/sound';

/** The stage, seen from the back of the room: the dark with a spotlight falling on Peruzzi, the stage's front edge and
 *  its nameplate, and the crowd in silhouette in front, a few phones up. */
export interface StageHandle {
  react(r: Reaction): void;
  /** a line under the stage for something happening in the room ("Peruzzi taps the mic") */
  say(text: string, ms?: number): void;
  /** the light jumps */
  flash(strength?: number): void;
  /** a finger on the mic, `n` times; resolves once the last tap has landed */
  tap(n?: number): Promise<void>;
  /** the spotlight swings round off the stage and lands on whoever's looking */
  sweep(): Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const StageScene = forwardRef<StageHandle, { nameplate: string; className?: string; style?: React.CSSProperties; still?: boolean }>(function StageScene({ nameplate, className = '', style, still = false }, ref) {
  const reduce = useReducedMotion();
  const [reaction, setReaction] = useState<{ r: Reaction; n: number }>({ r: 'none', n: 0 });
  const [caption, setCaption] = useState<{ text: string; n: number } | null>(null);
  const [flashN, setFlashN] = useState<{ n: number; s: number }>({ n: 0, s: 0 });
  const [taps, setTaps] = useState(0);
  const [swept, setSwept] = useState(0);
  const capTimer = useRef(0);

  const say = useCallback((text: string, ms = 2400) => {
    setCaption((x) => ({ text, n: (x?.n ?? 0) + 1 }));
    window.clearTimeout(capTimer.current); capTimer.current = window.setTimeout(() => setCaption(null), ms);
  }, []);
  const react = useCallback((r: Reaction) => {
    if (r === 'none') return;
    setReaction((x) => ({ r, n: x.n + 1 }));
    say(CROWD_WORDS[r], 2200);
    sound.crowd(r);
  }, [say]);
  const flash = useCallback((s = 1) => setFlashN((x) => ({ n: x.n + 1, s })), []);
  const tap = useCallback(async (n = 2) => {
    for (let i = 0; i < n; i++) { if (i) await sleep(260); setTaps((t) => t + 1); sound.play('mic', { strength: 0.9 }); flash(0.35); }
    await sleep(200);
  }, [flash]);
  const sweep = useCallback(async () => { setSwept((s) => s + 1); sound.play('whoosh', { duration: 0.9 }); await sleep(reduce ? 200 : 1100); flash(1); }, [flash, reduce]);
  useImperativeHandle(ref, () => ({ react, say, flash, tap, sweep }), [react, say, flash, tap, sweep]);

  return (
    <div className={`relative overflow-hidden bg-[#0b0a09] ${className}`} style={style}>
      {/* the haze the light falls through */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,rgba(236,229,216,0.10),transparent_70%)]" />
      {/* Peruzzi, in the spotlight: the photo falls away into the dark at its edges */}
      <motion.img src="/media/img/stage-1200.webp" srcSet="/media/img/stage-600.webp 600w, /media/img/stage-1200.webp 1200w" sizes="(max-width: 520px) 100vw, 520px"
        alt="" aria-hidden draggable={false} decoding="async"
        className="pointer-events-none absolute left-1/2 top-0 h-[118%] w-auto max-w-none -translate-x-1/2 select-none object-cover [filter:brightness(1.05)_contrast(1.05)] [mask-image:radial-gradient(48%_62%_at_50%_34%,#000_48%,transparent_100%)]"
        initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: 'easeOut' }} />
      {/* the spotlight's beam, from the rig above, swaying a little */}
      <div className={`beam pointer-events-none absolute left-1/2 top-[-6%] h-[112%] w-[78%] -translate-x-1/2 ${still ? '' : 'sway'}`} />
      {/* the stage's front edge, with the nameplate */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[21%] bg-[linear-gradient(180deg,#26221d_0%,#1c1915_45%,#141210_100%)] shadow-[0_-1px_0_rgba(236,229,216,0.22),0_-14px_24px_-10px_rgba(0,0,0,0.65)]">
        <div className="absolute inset-0 opacity-50 [background:repeating-linear-gradient(90deg,transparent_0_86px,rgba(0,0,0,0.35)_86px_88px,rgba(255,255,255,0.04)_88px_89px)]" />
      </div>
      {/* a tap on the mic: a ring where the sound comes from, and the light jumps */}
      <AnimatePresence>
        {taps > 0 && !reduce && (
          <motion.span key={taps} className="pointer-events-none absolute left-1/2 top-[44%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bone/40"
            initial={{ opacity: 0.8, scale: 0.4 }} animate={{ opacity: 0, scale: 2.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }} />
        )}
      </AnimatePresence>
      <Crowd reaction={reaction.r} nonce={reaction.n} className="pointer-events-none absolute inset-x-[-4%] bottom-[-3%] h-[15%] w-[108%] drop-shadow-[0_-2px_6px_rgba(0,0,0,0.5)]" />
      {/* the nameplate on the stage's front edge, over the crowd's heads so it always reads */}
      <div className="pointer-events-none absolute bottom-[16.5%] left-1/2 -translate-x-1/2 whitespace-nowrap border border-bone/25 bg-gradient-to-b from-[#2a2722] to-[#1a1815] px-3 py-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(0,0,0,0.6)]">
        <span className="caps block text-[9.5px] text-bone/75">{nameplate} · live</span>
      </div>
      <AnimatePresence>
        {caption && (
          <motion.p key={caption.n} className="pointer-events-none absolute bottom-[27%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-[13px] italic text-bone/90 backdrop-blur-sm"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
            {caption.text}
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flashN.n > 0 && !reduce && (
          <motion.div key={flashN.n} className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_40%,rgba(255,248,235,0.5),transparent_70%)]"
            initial={{ opacity: 0.9 * flashN.s }} animate={{ opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} />
        )}
      </AnimatePresence>
      {/* the spotlight leaving the stage: it swings out over the crowd and lands on the one looking */}
      <AnimatePresence>
        {swept > 0 && !reduce && (
          <motion.div key={`sweep-${swept}`} className="pointer-events-none absolute inset-0"
            initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 1.6, duration: 0.8 }}>
            <motion.div className="absolute h-[140%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgba(255,248,235,0.55),rgba(255,248,235,0.12)_60%,transparent)] mix-blend-screen"
              initial={{ left: '-40%', top: '-30%' }} animate={{ left: ['-40%', '70%', '20%'], top: ['-30%', '10%', '0%'] }} transition={{ duration: 1.1, times: [0, 0.6, 1], ease: 'easeInOut' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
