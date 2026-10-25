import { NoteKind } from '../lib/api';

/** Peruzzi's ink: red for love; black when he calls it something else. */
export const STAMP_INK: Record<NoteKind, string> = { love: '#a11d2a', not_love: '#24201b', nonsense: '#24201b' };
/** how far the stamp sits askew, in degrees */
export const STAMP_TILT = -7;

const WORN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='120'><filter id='w'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.55'/></filter><rect width='300' height='120' filter='url(%23w)'/></svg>\")";

/** The stamp's mark itself, worn at the edges like a real rubber stamp, without the landing. The stage lands it with
 *  framer-motion (Stamp); the shared pages land it in CSS (.stamp-land), so they needn't download framer-motion. */
export function StampMark({ kind, text, size = 'lg' }: { kind: NoteKind; text: string; size?: 'lg' | 'md' | 'sm' }) {
  const ink = STAMP_INK[kind];
  const long = text.length > 14;
  const fs = size === 'lg' ? (long ? 'text-[25px]' : 'text-[46px]') : size === 'md' ? (long ? 'text-[16px]' : 'text-[26px]') : (long ? 'text-[11px]' : 'text-[15px]');
  const pad = size === 'lg' ? 'px-5 py-2.5' : size === 'md' ? 'px-3.5 py-1.5' : 'px-2 py-0.5';
  return (
    <div className={`relative select-none border-[3px] text-center uppercase leading-[0.95] ${pad} ${fs}`}
      style={{ color: ink, borderColor: ink, fontFamily: 'var(--font-caps)', letterSpacing: '0.09em', WebkitMaskImage: WORN, maskImage: WORN, WebkitMaskSize: '300px 120px', maskSize: '300px 120px', boxShadow: `inset 0 0 0 2px transparent, 0 0 0 0 ${ink}` }}>
      <div className="pointer-events-none absolute inset-[3px] border" style={{ borderColor: ink }} />
      <span className="block">{text}</span>
    </div>
  );
}
