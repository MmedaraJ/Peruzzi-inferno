import { motion } from 'framer-motion';
import { CaretRightIcon, PlusIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { NoteInfo, Notebook } from '../../lib/api';
import { Button, Label } from '../../components/ui';
import { TopBar } from '../../components/TopBar';
import { store } from '../../lib/store';
import { noteState } from './NoteView';

/** Your notes: every note so far, newest first, each open to its page, with where it's got to (sent, seen, written back).
 *  There's no set number: write as many as you like (the day's limit aside). Each goes on the tracklist, which is a tap
 *  away from the first note on. A note Peruzzi put down for help isn't kept. */
export function Notes({ notebook, onBack, onOpen, onWrite, onTracklist }: {
  notebook: Notebook; onBack: () => void; onOpen: (k: NoteInfo) => void; onWrite: () => void; onTracklist: () => void;
}) {
  const asked = notebook.notes.filter((k) => k.status !== 'serious' && k.kind).reverse();
  const canWrite = notebook.left > 0;
  const seen = asked.filter((k) => k.seenAt).length;
  const note = asked.length ? 'Write as many as you like. Each one goes on your tracklist.' : 'The notes you write will show here.';
  // tracklists this phone made before (from earlier notebooks), so they're never lost
  const tracklists = store.tracklists().slice(0, 3);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <TopBar onBack={onBack} backLabel="Back to the stage" left={<span className="caps text-[11px] text-bone/70">Your notes</span>} />
      <div className="flex flex-1 flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <h1 className="display mt-3 text-[36px] leading-none">{asked.length ? `${asked.length} ${asked.length === 1 ? 'note' : 'notes'}` : 'no notes yet'}</h1>
        <p className="mt-2 text-[16px] text-bone/65">{seen ? `${seen} seen. ` : ''}{note}</p>
        <div className="mt-6 space-y-2.5">
          {/* room for the next one, on top, where the newest note goes */}
          {canWrite && (
            <button onClick={onWrite} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-bone/25 px-4 py-3.5 text-left hover:border-blush/50">
              <div className="flex-1"><Label>Note {asked.length + 1}</Label><p className="mt-0.5 text-[15px] text-bone/70">Write it</p></div>
              <PlusIcon size={20} className="text-bone/70" />
            </button>
          )}
          {asked.map((k, i) => {
            const state = noteState(k);
            return (
              <motion.button key={k.id} data-note={k.code} onClick={() => onOpen(k)} className="paper group flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left shadow-[0_14px_30px_-18px_rgba(0,0,0,0.9)] transition-transform active:scale-[0.99]"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.06 }}>
                <div className="min-w-0 flex-1">
                  <p className="caps truncate text-[9.5px] text-paper-ink/50">Note {k.noteNo} · {k.title}</p>
                  <p className="mt-0.5 text-[17px] font-medium">Dear {k.dear},</p>
                  <p className="mt-0.5 line-clamp-2 text-[14.5px] leading-snug text-paper-ink/75">{k.line}</p>
                  {state && <p className="mt-1 text-[13.5px] leading-snug text-rose">{state}</p>}
                </div>
                <CaretRightIcon size={16} className="shrink-0 text-paper-ink/45 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="mt-8 flex flex-col gap-2.5">
          {canWrite && <Button onClick={onWrite}>{asked.length ? 'Write another note' : 'Write a note'}</Button>}
          {asked.length > 0 && <Button kind="ghost" onClick={onTracklist}>Get my tracklist</Button>}
          {!canWrite && <p className="text-center text-[15px] text-bone/65">That’s your notes for today. Peruzzi will ask again tomorrow.</p>}
        </div>
        {tracklists.length > 0 && (
          <div className="mt-8">
            <Label>Your tracklists</Label>
            <div className="mt-2 flex flex-col gap-1">
              {tracklists.map((r) => <Link key={r.code} to={`/tracks/${r.code}`} className="text-[15.5px] text-bone/75 underline decoration-bone/25 underline-offset-4 hover:text-bone">{r.title} <span className="text-bone/45">· {new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></Link>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
