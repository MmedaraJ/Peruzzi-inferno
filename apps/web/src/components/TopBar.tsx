import { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, MusicNotesIcon, SpeakerHighIcon, SpeakerSlashIcon, XIcon } from '@phosphor-icons/react';
import { sound } from '../lib/sound';
import { store } from '../lib/store';
import { track } from '../lib/track';
import { OnScreen } from './ui';

/** The strip across the top of every screen of the stage: the way back (or out) and where you are on the left, sound
 *  on the right, and the way out of a note at the far right. */
export function TopBar({ left, onBack, onExit, backLabel = 'Back', className = '' }: { left: ReactNode; onBack?: () => void; onExit?: () => void; backLabel?: string; className?: string }) {
  const on = useSoundOn();
  return (
    <div className={`safe-t relative z-20 flex min-h-[52px] items-center gap-1 px-2 ${className}`}>
      {onBack ? <button onClick={onBack} aria-label={backLabel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bone/85 hover:bg-white/5"><ArrowLeftIcon size={21} /></button> : <span className="w-2" />}
      <div className="min-w-0 flex-1 truncate">{left}</div>
      <button onClick={() => { const v = !on; sound.setOn(v, true); store.setSoundOn(v); track(v ? 'sound_on' : 'sound_off'); }} aria-label={on ? 'Turn sound off' : 'Turn sound on'}
        className="flex h-10 w-10 items-center justify-center rounded-full text-bone/80 hover:bg-white/5">
        {on ? <SpeakerHighIcon size={21} /> : <SpeakerSlashIcon size={21} />}
      </button>
      {onExit && <button onClick={onExit} aria-label="Leave the note" className="flex h-10 w-10 items-center justify-center rounded-full text-bone/80 hover:bg-white/5"><XIcon size={20} /></button>}
    </div>
  );
}
export function useSoundOn() {
  const [on, setOn] = useState(sound.on);
  useEffect(() => sound.subscribe(() => setOn(sound.on)), []);
  return on;
}

/** When the song should be playing and isn't: a phone that wants a tap before it plays anything (the site just
 *  opened, or back from another app), a song stopped or stuck, or back from streaming it, where the song waits to be
 *  asked so it doesn't cut into the song playing elsewhere. */
export function MusicPill() {
  const [s, setS] = useState({ tap: sound.needsTap, held: sound.held });
  useEffect(() => sound.subscribe(() => setS({ tap: sound.needsTap, held: sound.held })), []);
  const show = s.tap || s.held;
  // in the page's body, as the note being written is (see OnScreen), so it shows above it
  return (
    <OnScreen>
    <AnimatePresence>
      {show && (
        <motion.button key="pill" onClick={() => { sound.resume(); track('music_back', { held: s.held }); }}
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+58px)] z-[55] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-bone px-4 py-2 text-[14.5px] font-medium text-ink shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)]"
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          <MusicNotesIcon size={17} weight="bold" /> {s.held ? 'Bring the music back' : 'Tap to play the music'}
        </motion.button>
      )}
    </AnimatePresence>
    </OnScreen>
  );
}
