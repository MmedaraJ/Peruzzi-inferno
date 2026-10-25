import { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** The crowd: two rows of people seen from behind, against the lit stage, the way you'd see them from the back of the
 *  room. Heads, shoulders, arms, a few phones up, all leaning one way and then the other with the song's beat (the
 *  stage sets how far: see useBeat). They react to each note when the stage says they do. */
export type Reaction = 'none' | 'ooh' | 'gasp' | 'laugh' | 'murmur' | 'aww' | 'cheer';
export const CROWD_WORDS: Record<Exclude<Reaction, 'none'>, string> = {
  ooh: 'Ooooh.', gasp: 'The crowd gasps.', laugh: 'The crowd laughs.', murmur: 'The crowd murmurs.', aww: 'Awww.', cheer: 'The crowd goes wild.',
};

type Hair = 'crop' | 'afro' | 'gele' | 'cap' | 'bun' | 'braids' | 'beanie';
type Arms = 'down' | 'left' | 'right' | 'both';
/** One person: where they stand (x along the crowd), which row, how big, their hair, their arms, a phone in a raised
 *  hand, how hard they lean (k) and with which half of the room they move (b: a touch behind). */
interface Person { x: number; back?: boolean; s: number; hair: Hair; arms?: Arms; phone?: boolean; k: number; b?: boolean }

// drawn around (0, 0) at the foot of the frame, about 54 wide and 68 tall to the top of the head (86 to a phone held up)
const BODY = 'M-27 0 C-28 -15 -28 -26 -24 -31 C-20 -35 -12 -36 -6 -38 L6 -38 C12 -36 20 -35 24 -31 C28 -26 28 -15 27 0 Z';
const NECK = 'M-5.5 -37 L-5 -46 L5 -46 L5.5 -37 Z';
const HAIR: Record<Hair, string> = {
  crop: '',
  afro: 'M0 -73 C10 -73 16 -66 16 -58 C16 -50 11 -45 6 -44 L-6 -44 C-11 -45 -16 -50 -16 -58 C-16 -66 -10 -73 0 -73 Z',
  gele: 'M-12 -60 C-25 -61 -27 -76 -15 -80 C-9 -90 9 -90 15 -82 C27 -81 27 -64 13 -61 Z',
  cap: 'M-11 -60 C-12 -73 11 -73 11 -61 L23 -60 C23 -57 18 -56 10 -57 Z',
  bun: 'M0 -77 C4 -77 6.5 -74.5 6.5 -71 C6.5 -68 4 -66 0 -66 C-4 -66 -6.5 -68 -6.5 -71 C-6.5 -74.5 -4 -77 0 -77 Z',
  braids: 'M-10 -60 C-15 -46 -16 -37 -14 -30 L-8 -31 C-9 -40 -8 -48 -6 -55 Z M10 -60 C15 -46 16 -37 14 -30 L8 -31 C9 -40 8 -48 6 -55 Z',
  beanie: 'M-11 -57 C-12 -72 12 -72 11 -57 Z',
};
/** whose ears show: hair or a wrap that covers them hides them */
const EARS: Hair[] = ['crop', 'cap', 'bun', 'beanie'];
/** a raised arm, bent at the elbow, holding the hand up by the head: the right one, mirrored for the left */
const arm = (side: 1 | -1, spread = 0) => `M${19 * side} -32 C${(27 + spread) * side} -40 ${(30 + spread) * side} -50 ${(29 + spread) * side} -56 C${(28 + spread) * side} -62 ${(26 + spread) * side} -68 ${(25 + spread) * side} -72`;
const hand = (side: 1 | -1, spread = 0) => ({ x: (25 + spread) * side, y: -73 });

const PEOPLE: Person[] = [
  // the back row, further off: smaller, higher up, mostly hidden
  { x: 4, back: true, s: 0.6, hair: 'crop', k: 0.8, b: true },
  { x: 56, back: true, s: 0.62, hair: 'gele', arms: 'right', phone: true, k: 0.9, b: true },
  { x: 112, back: true, s: 0.6, hair: 'braids', k: 1, b: true },
  { x: 170, back: true, s: 0.6, hair: 'afro', k: 1.1, b: true },
  { x: 230, back: true, s: 0.62, hair: 'beanie', k: 0.9, b: true },
  { x: 286, back: true, s: 0.6, hair: 'bun', arms: 'left', phone: true, k: 1, b: true },
  { x: 342, back: true, s: 0.61, hair: 'cap', k: 0.85, b: true },
  { x: 398, back: true, s: 0.6, hair: 'afro', k: 0.9, b: true },
  // the front row
  { x: 26, s: 0.86, hair: 'afro', k: 1 },
  { x: 84, s: 0.82, hair: 'crop', arms: 'right', phone: true, k: 1.2 },
  { x: 142, s: 0.88, hair: 'gele', k: 0.9 },
  { x: 200, s: 0.82, hair: 'braids', k: 1.05 },
  { x: 258, s: 0.86, hair: 'cap', arms: 'both', k: 1.25 },
  { x: 316, s: 0.88, hair: 'bun', k: 0.95 },
  { x: 374, s: 0.83, hair: 'beanie', arms: 'left', phone: true, k: 1.1 },
];

const MOVES: Record<Reaction, (i: number) => any> = {
  none: () => ({ y: 0, rotate: 0 }),
  ooh: (i) => ({ y: [0, -2.5, 0], rotate: [0, i % 2 ? 3 : -3, 0], transition: { duration: 1.3, ease: 'easeInOut', delay: (i % 3) * 0.06 } }),
  gasp: (i) => ({ y: [0, -7, -5, 0], transition: { duration: 0.75, times: [0, 0.18, 0.5, 1], ease: 'easeOut', delay: (i * 37 % 5) * 0.03 } }),
  laugh: (i) => ({ y: [0, -3, 0, -3, 0, -2, 0], rotate: [0, -1.5, 1, -1.5, 0.5, 0, 0], transition: { duration: 1.3, ease: 'easeInOut', delay: (i % 4) * 0.05 } }),
  murmur: (i) => ({ rotate: [0, (i % 2 ? 1 : -1) * 2, (i % 2 ? -1 : 1), 0], x: [0, i % 2 ? 1.5 : -1.5, 0], transition: { duration: 1.8, ease: 'easeInOut', delay: (i % 3) * 0.12 } }),
  aww: (i) => ({ rotate: [0, i % 2 ? 7 : -7, i % 2 ? 7 : -7, 0], transition: { duration: 1.6, times: [0, 0.3, 0.75, 1], ease: 'easeInOut', delay: (i % 3) * 0.08 } }),
  cheer: (i) => ({ y: [0, -11, 0, -9, 0], transition: { duration: 0.95, ease: 'easeOut', delay: (i * 29 % 6) * 0.04 } }),
};

/** a person's lean and dip with the beat (the stage sets --sa, --sb and --bob every frame) */
const groove = (p: Person): CSSProperties => ({
  transformBox: 'fill-box', transformOrigin: '50% 100%',
  transform: `rotate(calc(var(${p.b ? '--sb' : '--sa'}, 0deg) * ${p.k})) translateY(calc(var(--bob, 0px) * ${p.back ? 0.7 : 1}))`,
});

export function Crowd({ reaction, nonce, className = '' }: { reaction: Reaction; nonce: number; className?: string }) {
  const reduce = useReducedMotion();
  const loud = reaction === 'cheer' || reaction === 'aww';
  return (
    <svg viewBox="0 -74 400 76" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <radialGradient id="phone-glow"><stop offset="0" stopColor="#fff8f0" stopOpacity="0.95" /><stop offset="0.35" stopColor="#ffe6f0" stopOpacity="0.4" /><stop offset="1" stopColor="#ffe6f0" stopOpacity="0" /></radialGradient>
        {/* silhouettes against the stage: dark, a little of its light on their heads and shoulders */}
        <linearGradient id="crowd-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b0a23" /><stop offset="0.4" stopColor="#120410" /><stop offset="1" stopColor="#070106" /></linearGradient>
        <linearGradient id="crowd-front-2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a0e2f" /><stop offset="0.4" stopColor="#1a0616" /><stop offset="1" stopColor="#0b0209" /></linearGradient>
        <linearGradient id="crowd-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4d1440" /><stop offset="0.45" stopColor="#260a21" /><stop offset="1" stopColor="#170513" /></linearGradient>
      </defs>
      {PEOPLE.map((p, i) => {
        const sides: (1 | -1)[] = p.arms === 'both' ? [-1, 1] : p.arms === 'left' ? [-1] : p.arms === 'right' ? [1] : [];
        const spread = p.arms === 'both' ? 4 : 0;
        // neighbours in slightly different shades, and each outlined in the stage's light, so no two run together
        const fill = `url(#${p.back ? 'crowd-back' : i % 2 ? 'crowd-front-2' : 'crowd-front'})`;
        const rim = { stroke: p.back ? 'rgba(255,120,190,0.2)' : 'rgba(255,150,110,0.32)', strokeWidth: p.back ? 1.4 : 1.1 };
        return (
          <g key={i} transform={`translate(${p.x} ${p.back ? -12 : 2}) scale(${p.s})`}>
            <motion.g key={`${i}-${nonce}`} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }} animate={reduce ? undefined : MOVES[reaction](i)}>
              <g data-person style={groove(p)}>
                {sides.map((side) => <path key={side} d={arm(side, spread)} fill="none" stroke={rim.stroke} strokeWidth={10 + rim.strokeWidth * 2} strokeLinecap="round" />)}
                {sides.map((side) => <path key={`a${side}`} d={arm(side, spread)} fill="none" stroke={fill} strokeWidth={10} strokeLinecap="round" />)}
                {sides.map((side) => { const h = hand(side, spread); return <ellipse key={`h${side}`} cx={h.x} cy={h.y} rx={5.2} ry={6} fill={fill} {...rim} />; })}
                <path d={BODY} fill={fill} {...rim} />
                <path d={NECK} fill={fill} />
                {EARS.includes(p.hair) && <><ellipse cx={-10} cy={-54} rx={2.6} ry={3.6} fill={fill} {...rim} /><ellipse cx={10} cy={-54} rx={2.6} ry={3.6} fill={fill} {...rim} /></>}
                <ellipse cx={0} cy={-55} rx={9.5} ry={11.5} fill={fill} {...rim} />
                {HAIR[p.hair] && <path d={HAIR[p.hair]} fill={fill} {...rim} />}
                {p.phone && sides.slice(0, 1).map((side) => {
                  const h = hand(side, spread);
                  return (
                    <g key="phone">
                      <circle cx={h.x} cy={h.y - 10} r={loud ? 20 : 15} fill="url(#phone-glow)" style={{ opacity: 'calc(0.7 + var(--pulse, 0) * 0.3)' }} />
                      <rect x={h.x - 4.5} y={h.y - 18} width={9} height={14} rx={1.8} fill="#fffaf2" opacity={0.95} />
                    </g>
                  );
                })}
              </g>
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}
