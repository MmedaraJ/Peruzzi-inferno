/** A choice circled in red ink, by hand: a loop that doesn't quite close, drawn as if by pen (see .circle-draw). Put it
 *  inside the thing it circles (which must be positioned); `tilt` turns it a little, so no two look alike. A lighter
 *  `ink` shows on a dark ground. */
export function InkCircle({ tilt = 0, delay = 0, ink = '#a11d2a' }: { tilt?: number; delay?: number; ink?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-2 -inset-y-1.5 h-[calc(100%+12px)] w-[calc(100%+16px)] overflow-visible" style={{ transform: `rotate(${tilt}deg)` }}>
      <path pathLength={1} className="circle-draw" style={delay ? { animationDelay: `${delay}s` } : undefined} fill="none" stroke={ink} strokeWidth="2.1" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        d="M 9 25 C 3 13, 28 3, 57 4 C 86 5, 99 14, 96 24 C 93 35, 66 39, 44 38 C 20 37, 2 32, 5 21 C 8 12, 21 7, 35 6" />
    </svg>
  );
}
