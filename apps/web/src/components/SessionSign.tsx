import { ReactNode } from 'react';

/** The sign over the stage door, lit while the show is on: red light behind the words, and every so often the flicker
 *  of an old tube (see .session-sign). The stage's own, where any live thing online has a pulsing dot. */
export function SessionSign({ children = 'Live', size = 'md', className = '' }: { children?: ReactNode; size?: 'sm' | 'md'; className?: string }) {
  return <span className={`session-sign caps inline-flex items-center whitespace-nowrap ${size === 'sm' ? 'px-1.5 py-px text-[8.5px]' : 'px-2.5 py-[3px] text-[10px]'} ${className}`}>{children}</span>;
}
