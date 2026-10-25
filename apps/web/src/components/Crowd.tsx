import { motion, useReducedMotion } from 'framer-motion';

/** The crowd: a row of people seen from behind, in silhouette against the lit stage, the way you'd see them from the
 *  back of the room, a few phones held up. They react to each note when the stage says they do. */
export type Reaction = 'none' | 'ooh' | 'gasp' | 'laugh' | 'murmur' | 'aww' | 'cheer';
export const CROWD_WORDS: Record<Exclude<Reaction, 'none'>, string> = {
  ooh: 'Ooooh.', gasp: 'The crowd gasps.', laugh: 'The crowd laughs.', murmur: 'The crowd murmurs.', aww: 'Awww.', cheer: 'The crowd goes wild.',
};
/** the phones held up over the crowd: where (in the crowd's own units), and how high */
const PHONES = [{ x: 40, y: -66 }, { x: 128, y: -80 }, { x: 218, y: -70 }, { x: 306, y: -84 }, { x: 356, y: -64 }];

// head-and-shoulders outlines, drawn around (0,0) at the base of the shoulders, about 44 wide and 70 tall
const PEOPLE: { d: string; x: number; s: number; tone: string }[] = [
  // gele, tied high and wide
  { x: 18, s: 0.95, tone: '#070706', d: 'M-24 0 C-24 -18 -14 -24 -6 -26 L-6 -31 C-12 -33 -14 -39 -12 -45 C-20 -46 -24 -54 -18 -60 C-10 -68 6 -68 16 -62 C24 -58 26 -50 20 -46 C22 -40 20 -34 12 -31 L6 -26 C14 -24 24 -18 24 0 Z' },
  // close crop
  { x: 62, s: 0.85, tone: '#0b0a09', d: 'M-22 0 C-22 -17 -12 -22 -6 -23 L-5 -28 C-11 -31 -13 -38 -12 -45 C-11 -54 -6 -58 0 -58 C7 -58 12 -54 12 -45 C13 -38 11 -31 5 -28 L6 -23 C12 -22 22 -17 22 0 Z' },
  // afro
  { x: 104, s: 1, tone: '#060605', d: 'M-25 0 C-25 -18 -15 -24 -7 -25 L-6 -30 C-17 -33 -24 -42 -23 -53 C-22 -66 -11 -74 0 -74 C11 -74 22 -66 23 -53 C24 -42 17 -33 6 -30 L7 -25 C15 -24 25 -18 25 0 Z' },
  // fitted cap, brim forward
  { x: 150, s: 0.9, tone: '#0a0908', d: 'M-23 0 C-23 -17 -13 -23 -6 -24 L-5 -29 C-11 -32 -13 -38 -12 -44 L-14 -46 C-14 -56 -7 -61 0 -61 C8 -61 14 -56 13 -48 L22 -47 C23 -45 21 -44 12 -43 C12 -37 10 -32 5 -29 L6 -24 C13 -23 23 -17 23 0 Z' },
  // long braids
  { x: 196, s: 0.97, tone: '#070706', d: 'M-25 0 C-25 -17 -16 -22 -14 -22 C-17 -32 -17 -42 -14 -50 C-11 -59 -5 -62 0 -62 C6 -62 12 -59 14 -50 C17 -42 17 -32 14 -22 C16 -22 25 -17 25 0 Z' },
  // bun on top
  { x: 240, s: 0.88, tone: '#0b0a09', d: 'M-22 0 C-22 -17 -12 -22 -6 -23 L-5 -28 C-11 -31 -13 -38 -12 -45 C-12 -51 -9 -55 -5 -57 C-8 -60 -7 -67 0 -67 C7 -67 8 -60 5 -57 C9 -55 12 -51 12 -45 C13 -38 11 -31 5 -28 L6 -23 C12 -22 22 -17 22 0 Z' },
  // beanie, locs out the back
  { x: 284, s: 1, tone: '#060605', d: 'M-25 0 C-25 -18 -15 -24 -9 -24 C-14 -29 -15 -36 -13 -42 C-15 -48 -13 -58 -6 -63 C-2 -65 4 -65 8 -63 C15 -58 16 -48 13 -42 C15 -36 14 -28 10 -24 C15 -24 25 -18 25 0 Z' },
  // low gele, sideways knot
  { x: 330, s: 0.9, tone: '#0a0908', d: 'M-23 0 C-23 -17 -13 -23 -6 -24 L-5 -29 C-11 -32 -13 -38 -12 -45 C-17 -47 -19 -54 -13 -58 C-7 -63 7 -63 13 -59 C20 -60 24 -55 20 -51 C17 -49 14 -48 12 -46 C12 -38 10 -32 5 -29 L6 -24 C13 -23 23 -17 23 0 Z' },
  // headphones round the neck
  { x: 374, s: 0.86, tone: '#070706', d: 'M-23 0 C-23 -17 -14 -23 -7 -24 C-12 -24 -13 -27 -9 -29 C-12 -32 -13 -38 -12 -45 C-11 -54 -6 -58 0 -58 C7 -58 12 -54 12 -45 C13 -38 12 -32 9 -29 C13 -27 12 -24 7 -24 C14 -23 23 -17 23 0 Z' },
];

const MOVES: Record<Reaction, (i: number) => any> = {
  none: () => ({ y: 0, rotate: 0 }),
  ooh: (i) => ({ y: [0, -2.5, 0], rotate: [0, i < 4 ? 3 : -3, 0], transition: { duration: 1.3, ease: 'easeInOut', delay: (i % 3) * 0.06 } }),
  gasp: (i) => ({ y: [0, -7, -5, 0], transition: { duration: 0.75, times: [0, 0.18, 0.5, 1], ease: 'easeOut', delay: (i * 37 % 5) * 0.03 } }),
  laugh: (i) => ({ y: [0, -3, 0, -3, 0, -2, 0], rotate: [0, -1.5, 1, -1.5, 0.5, 0, 0], transition: { duration: 1.3, ease: 'easeInOut', delay: (i % 4) * 0.05 } }),
  murmur: (i) => ({ rotate: [0, (i % 2 ? 1 : -1) * 2, (i % 2 ? -1 : 1), 0], x: [0, i % 2 ? 1.5 : -1.5, 0], transition: { duration: 1.8, ease: 'easeInOut', delay: (i % 3) * 0.12 } }),
  aww: (i) => ({ rotate: [0, i % 2 ? 7 : -7, i % 2 ? 7 : -7, 0], transition: { duration: 1.6, times: [0, 0.3, 0.75, 1], ease: 'easeInOut', delay: (i % 3) * 0.08 } }),
  cheer: (i) => ({ y: [0, -11, 0, -9, 0], transition: { duration: 0.95, ease: 'easeOut', delay: (i * 29 % 6) * 0.04 } }),
};

export function Crowd({ reaction, nonce, className = '' }: { reaction: Reaction; nonce: number; className?: string }) {
  const reduce = useReducedMotion();
  const loud = reaction === 'cheer' || reaction === 'aww';
  return (
    <svg viewBox="0 -96 400 98" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <radialGradient id="phone-glow"><stop offset="0" stopColor="#fff8e8" stopOpacity="0.95" /><stop offset="0.35" stopColor="#fff2d6" stopOpacity="0.4" /><stop offset="1" stopColor="#fff2d6" stopOpacity="0" /></radialGradient>
      </defs>
      {/* phones held up, swaying; a cheer or an "awww" brings them all up */}
      {PHONES.map((p, i) => (
        <motion.g key={`phone-${i}-${nonce}`} animate={reduce ? undefined : { y: loud ? [0, -6, 0] : [0, -1.5, 0], x: [0, i % 2 ? 1.5 : -1.5, 0] }}
          transition={{ duration: loud ? 0.9 : 3.2 + i * 0.4, repeat: loud ? 2 : Infinity, ease: 'easeInOut', delay: i * 0.15 }}>
          <circle cx={p.x} cy={p.y} r={loud ? 11 : 8} fill="url(#phone-glow)" />
          <rect x={p.x - 2.2} y={p.y - 3.6} width={4.4} height={7.2} rx={0.8} fill="#fffaf0" opacity={0.92} />
        </motion.g>
      ))}
      {PEOPLE.map((p, i) => (
        <motion.g key={`${i}-${nonce}`} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }} animate={reduce ? undefined : MOVES[reaction](i)}>
          <path d={p.d} fill={p.tone} transform={`translate(${p.x} 2) scale(${p.s})`} />
        </motion.g>
      ))}
    </svg>
  );
}
