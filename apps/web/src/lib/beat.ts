import { RefObject, useEffect } from 'react';
import { sound } from './sound';

/** Inferno's beat, measured from the song file (public/media/audio/inferno.mp3): 103 beats a minute, the first at
 *  0.341 s, steady through the whole clip (its drums land within 2 ms of it from start to finish). Measure again if
 *  the file changes. */
export const BPM = 103;
export const FIRST_BEAT = 0.341;
const BEAT = 60 / BPM;
/** The clip's shape, in beats from the first (four to a bar, and beat 0 starts one): where its sections start, which
 *  the lights hit, and the break before the drop, two beats with little in them but a hit on each, when the lights go
 *  dark. Measure these again too if the file changes. */
export const SECTIONS = [8, 32, 48, 64, 68];
export const BREAK: readonly [number, number] = [66, 68];

/** The song's clock, smoothed. An audio element's time can move in steps, so between its readings the frame clock
 *  carries it on, each new reading nudging it back on course; a reading out by more than a few hundredths (the loop
 *  back to the start, a seek) moves it straight there, and a song stuck on the network holds it where it stopped. */
let clock: { raw: number; t: number; at: number } | null = null;
function songClock(now: number) {
  const raw = sound.songTime();
  if (raw == null) { clock = null; return null; }
  if (!clock) { clock = { raw, t: raw, at: now }; return raw; }
  const est = clock.t + (now - clock.at) / 1000;
  if (raw !== clock.raw) {
    const off = raw - est;
    clock = Math.abs(off) > 0.12 ? { raw, t: raw, at: now } : { raw, t: est + off * 0.25, at: now };
    return clock.t;
  }
  return Math.min(est, raw + 0.3);
}

/** Where the song is at `now` (a frame's time), in beats from its first, and whether that's the song's own time: while
 *  it isn't playing, a clock at its tempo stands in. */
export function beatAt(now = performance.now()) {
  const t = songClock(now);
  return t != null ? { beats: (t - FIRST_BEAT) / BEAT, live: true } : { beats: now / 1000 / BEAT, live: false };
}

/** The part of the song beat `b` is in, numbered from the start, and the beat it started on: a new part at each of the
 *  song's sections and every four bars between them. Without the song (`live` false), simply every four bars. */
export function partAt(b: number, live: boolean) {
  const p = Math.floor(b / 16);
  let index = p, start = p * 16;
  if (live && b >= 0) for (const s of SECTIONS) if (s <= b) { if (s % 16) index++; if (s > start) start = s; }
  return { index, start };
}
/** whether beat `b` of the song is in the break before the drop */
export const inBreak = (b: number) => b >= BREAK[0] && b < BREAK[1];

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
    const frame = (now: number) => {
      const { beats, live } = beatAt(now);
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
