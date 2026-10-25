import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// The small parts the shared pages share with the stage. Nothing here animates with framer-motion, so the shared pages
// don't download it; what needs it (the sheet) lives in its own module.

/** What's laid over the page and holds text fields (the note being written, the sheets), put straight in the page's body
 *  rather than in its scrolling box (#root, see styles.css), so it sits on the page itself (see useVisualViewport); and
 *  what has to show above it. */
export function OnScreen({ children }: { children: ReactNode }) { return createPortal(children, document.body); }

/** "Peruzzi Asks", in the display face, spaced wide, with a short rule under it. */
export function Wordmark({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const fs = size === 'lg' ? 'text-[30px]' : size === 'md' ? 'text-[20px]' : 'text-[14px]';
  return (
    <span className={`inline-flex flex-col items-center ${className}`}>
      <span className={`display whitespace-nowrap uppercase tracking-[0.16em] ${fs}`}>Peruzzi Asks</span>
      <span aria-hidden className={`mt-1 block h-px bg-current opacity-40 ${size === 'sm' ? 'w-12' : 'w-20'}`} />
    </span>
  );
}

type BtnKind = 'primary' | 'ghost' | 'quiet' | 'paper';
export function Button({ kind = 'primary', className = '', children, ...p }: { kind?: BtnKind } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'relative inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-6 text-[17px] transition-[transform,opacity,background-color,filter] duration-150 active:scale-[0.985] disabled:opacity-40 disabled:active:scale-100 aria-disabled:opacity-40';
  const k = {
    primary: 'bg-rose text-white font-semibold hover:bg-rose-deep',
    ghost: 'border border-bone/30 text-bone hover:border-blush/60',
    quiet: 'text-bone/80 underline decoration-bone/30 underline-offset-4 min-h-11 rounded-none px-2 hover:text-bone',
    paper: 'bg-paper-ink text-paper font-semibold',
  }[kind];
  return <button {...p} className={`${base} ${k} ${className}`}>{children}</button>;
}

export function Chip({ on, children, className = '', ...p }: { on?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-pressed={on} {...p}
      className={`min-h-10 rounded-full border px-4 text-[15px] leading-tight transition-colors duration-150 ${on ? 'border-rose bg-rose text-white' : 'border-bone/25 bg-stone text-bone/90 hover:border-blush/50'} ${className}`}>
      {children}
    </button>
  );
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`caps text-[11px] text-bone/55 ${className}`}>{children}</p>;
}

/** A quiet line at the foot of the shared pages: the demo notice while there is one, and who made it. */
export function Footnote({ demo, credit, className = '' }: { demo?: string | null; credit?: boolean; className?: string }) {
  if (!demo && !credit) return null;
  return (
    <footer className={`text-center text-[12px] leading-relaxed text-bone/45 ${className}`}>
      {demo && <p>{demo}</p>}
      {credit && <p className="mt-1">Made by <a className="text-bone/65 underline decoration-bone/25 underline-offset-[3px] hover:text-bone" href={`mailto:mmedarajosiah@gmail.com?subject=${encodeURIComponent('About Peruzzi Asks')}`}>Mmedara Josiah</a></p>}
    </footer>
  );
}

/** Spinner for waits that need one: three dots that breathe. */
export function Dots({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex gap-1 ${className}`} aria-hidden>
      {[0, 1, 2].map((i) => <span key={i} className="dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 0.18}s` }} />)}
    </span>
  );
}
