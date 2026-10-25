import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crowd, CROWD_WORDS, Reaction } from './Crowd';
import { sound } from '../lib/sound';
import { useBeat } from '../lib/beat';

/** The stage, seen from the back of the room: Peruzzi in the light, the rig's coloured beams pulsing with the song,
 *  the stage's front edge with its LED strip and nameplate, and the crowd in front, a few phones up, swaying to the
 *  beat. */
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
  const room = useRef<HTMLDivElement>(null);
  useBeat(room, still);

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

  /** a beam from the rig: from (x, top) down to the stage, leaning by `lean`, in `color`, brighter on the beat */
  const beam = (x: string, lean: number, color: string, width: string, rest: number) => (
    <div className={`pointer-events-none absolute top-[-8%] h-[115%] ${still ? '' : 'sway'}`} style={{ left: x, width, transform: `translateX(-50%) rotate(${lean}deg)`, transformOrigin: '50% 0',
      background: `linear-gradient(180deg, ${color} 0%, transparent 88%)`, clipPath: 'polygon(45% 0, 55% 0, 100% 100%, 0 100%)', filter: 'blur(9px)', mixBlendMode: 'screen',
      opacity: `calc(${rest} + var(--pulse, 0) * 0.3)` } as React.CSSProperties} />
  );
  return (
    <div ref={room} className={`relative overflow-hidden bg-[#12050f] ${className}`} style={style}>
      {/* the haze the light falls through: magenta and violet above */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_0%,rgba(212,21,126,0.45),transparent_70%),radial-gradient(60%_55%_at_90%_5%,rgba(106,31,214,0.4),transparent_70%)]" />
      {/* Peruzzi, in the light: the photo falls away into the dark at its edges */}
      <motion.img src="/media/img/stage-1200.webp" srcSet="/media/img/stage-600.webp 600w, /media/img/stage-1200.webp 1200w" sizes="(max-width: 520px) 100vw, 520px"
        alt="" aria-hidden draggable={false} decoding="async"
        className="pointer-events-none absolute left-1/2 top-0 h-[118%] w-auto max-w-none -translate-x-1/2 select-none object-cover [filter:saturate(1.1)_contrast(1.04)] [mask-image:radial-gradient(48%_62%_at_50%_34%,#000_48%,transparent_100%)]"
        initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: 'easeOut' }} />
      {/* the stage lights on him: magenta from the left, flame from the right */}
      <div className="pointer-events-none absolute inset-0 mix-blend-soft-light bg-[linear-gradient(90deg,rgba(255,45,140,0.55)_0%,transparent_45%,transparent_55%,rgba(255,120,30,0.55)_100%)]" />
      {/* the rig's beams: magenta, gold on Peruzzi, flame */}
      {beam('22%', -16, 'rgba(255,70,170,0.55)', '62%', 0.45)}
      {beam('50%', 0, 'rgba(255,220,160,0.45)', '78%', 0.5)}
      {beam('78%', 16, 'rgba(255,130,50,0.55)', '62%', 0.45)}
      {/* the stage's front edge, its LED strip in the song's colours, with the nameplate */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-[linear-gradient(180deg,#2a0d24_0%,#1a0716_45%,#10040d_100%)]">
        <div className="fire absolute inset-x-0 top-0 h-[3px] shadow-[0_0_14px_2px_rgba(255,60,110,0.75)]" style={{ opacity: 'calc(0.75 + var(--pulse, 0) * 0.25)' }} />
      </div>
      {/* a tap on the mic: a ring where the sound comes from, and the light jumps */}
      <AnimatePresence>
        {taps > 0 && !reduce && (
          <motion.span key={taps} className="pointer-events-none absolute left-1/2 top-[44%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bone/40"
            initial={{ opacity: 0.8, scale: 0.4 }} animate={{ opacity: 0, scale: 2.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }} />
        )}
      </AnimatePresence>
      <Crowd reaction={reaction.r} nonce={reaction.n} className="pointer-events-none absolute inset-x-[-3%] bottom-[-1%] h-[33%] w-[106%]" />
      {/* the nameplate on the stage's front edge, over the crowd's heads so it always reads */}
      <div className="fire pointer-events-none absolute bottom-[21%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[4px] p-px shadow-[0_0_12px_rgba(255,45,85,0.5)]">
        <span className="caps block rounded-[3px] bg-[#1a0716] px-3 py-[3px] text-[9.5px] text-bone/90">{nameplate} · live</span>
      </div>
      <AnimatePresence>
        {caption && (
          <motion.p key={caption.n} className="pointer-events-none absolute bottom-[34%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#1a0716]/75 px-3 py-1 text-[13px] italic text-bone/95 backdrop-blur-sm"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
            {caption.text}
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flashN.n > 0 && !reduce && (
          <motion.div key={flashN.n} className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_40%,rgba(255,226,200,0.55),rgba(255,60,140,0.18)_45%,transparent_72%)]"
            initial={{ opacity: 0.9 * flashN.s }} animate={{ opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} />
        )}
      </AnimatePresence>
      {/* the spotlight leaving the stage: it swings out over the crowd and lands on the one looking */}
      <AnimatePresence>
        {swept > 0 && !reduce && (
          <motion.div key={`sweep-${swept}`} className="pointer-events-none absolute inset-0"
            initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 1.6, duration: 0.8 }}>
            <motion.div className="absolute h-[140%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgba(255,236,214,0.6),rgba(255,120,170,0.16)_60%,transparent)] mix-blend-screen"
              initial={{ left: '-40%', top: '-30%' }} animate={{ left: ['-40%', '70%', '20%'], top: ['-30%', '10%', '0%'] }} transition={{ duration: 1.1, times: [0, 0.6, 1], ease: 'easeInOut' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
