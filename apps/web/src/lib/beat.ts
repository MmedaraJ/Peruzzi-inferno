import { RefObject, useEffect } from 'react';
import { sound } from './sound';

/** Inferno's beat, measured from the song file (public/media/audio/inferno.mp3): 102.97 beats a minute, the first at
 *  0.277 s, steady through the whole clip. Measure again if the file changes. */
export const BPM = 102.97;
export const FIRST_BEAT = 0.277;
const BEAT = 60 / BPM;

/** Where the song is, in beats from its first, and whether that's the song's own time: while it isn't playing, a clock
 *  at its tempo stands in. */
export function beatAt() {
  const t = sound.songTime();
  return t != null ? { beats: (t - FIRST_BEAT) / BEAT, live: true } : { beats: performance.now() / 1000 / BEAT, live: false };
}

/** Keeps the room moving to the song: on `ref`'s element, every frame, `--sa` and `--sb` (how far the crowd leans,
 *  one way on a beat and back the other way on the next, the second group a touch behind the first), `--bob` (how
 *  far down they dip, lowest on each beat) and `--pulse` (the lights, brightest on each beat, fading until the next).
 *  The beat is the song's own while it plays; while it doesn't, the crowd keeps its tempo, more gently, and the lights
 *  rest. Nothing moves with reduced motion, or when `still`. */
export function useBeat(ref: RefObject<HTMLElement>, still = false) {
  useEffect(() => {
    const el = ref.current;
    if (!el || still || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const frame = () => {
      const { beats, live } = beatAt();
      const amp = live ? 1 : 0.55;
      const lean = (b: number) => Math.cos(Math.PI * b) * 4.5 * amp;
      el.style.setProperty('--sa', `${lean(beats).toFixed(2)}deg`);
      el.style.setProperty('--sb', `${lean(beats - 0.14).toFixed(2)}deg`);
      el.style.setProperty('--bob', `${((1 - Math.abs(Math.sin(Math.PI * beats))) * 2.4 * amp).toFixed(2)}px`);
      el.style.setProperty('--pulse', (live ? Math.exp(-(beats - Math.floor(beats)) * 4) : 0).toFixed(3));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ref, still]);
}
