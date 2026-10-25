import { ReactNode } from 'react';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { streaming } from '../lib/stream';
import { track } from '../lib/track';

/** The way to the song, the same everywhere it appears: the cover as a sleeve with the record sliding out of it and
 *  turning (its label the cover again), the light falling across it, and what to play. */
export function ListenButton({ href, from, label = 'Listen to Inferno', kicker = 'The song · Peruzzi', className = '' }: {
  /** where it was tapped, for the insights */
  href: string; from: string; label?: ReactNode; kicker?: ReactNode; className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={() => { track('stream_click', { from }); streaming.leftAt = Date.now(); }}
      className={`group relative flex min-h-[72px] items-center gap-3.5 overflow-hidden border border-bone/25 bg-[linear-gradient(105deg,#2a241c_0%,#16130f_52%,#0e0d0b_100%)] py-2.5 pl-2.5 pr-4 text-left text-bone shadow-[0_16px_34px_-18px_rgba(0,0,0,0.95)] transition-colors hover:border-bone/60 ${className}`}>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,transparent_28%,rgba(236,229,216,0.08)_44%,transparent_60%)]" />
      {/* the sleeve, and the record coming out of it */}
      <span aria-hidden className="relative h-[52px] w-[80px] shrink-0">
        <span className="absolute left-[22px] top-[2px] h-[48px] w-[48px] transition-transform duration-500 ease-out group-hover:translate-x-[9px]">
          <span className="vinyl absolute inset-0 rounded-full motion-safe:animate-[spin_4.5s_linear_infinite]">
            <img src="/media/img/cover-168.webp" alt="" width={16} height={16} loading="lazy" decoding="async" className="absolute inset-[33%] rounded-full object-cover shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]" />
          </span>
          <span className="vinyl-sheen absolute inset-0 rounded-full" />
        </span>
        <img src="/media/img/cover-168.webp" alt="" width={52} height={52} loading="lazy" decoding="async" className="absolute left-0 top-0 h-[52px] w-[52px] object-cover shadow-[4px_0_12px_rgba(0,0,0,0.75)]" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="caps block text-[10px] text-bone/55">{kicker}</span>
        <span className="mt-0.5 block text-[17px] leading-snug">{label}</span>
      </span>
      <ArrowRightIcon size={18} className="relative shrink-0 text-bone/70 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}
