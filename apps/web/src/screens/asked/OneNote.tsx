import { useEffect } from 'react';
import { NoteInfo, StageConfig } from '../../lib/api';
import { TopBar } from '../../components/TopBar';
import { track } from '../../lib/track';
import { pageBox } from '../../lib/history';
import { NoteView } from './NoteView';

/** A note already asked, opened from your notes: the same page the writing ended on, to save, post or send it, and to
 *  see whether it's been answered. */
export function OneNote({ cfg, note, notes, primary, onBack, onNotes, onSave, onShare, onSend }: {
  cfg: StageConfig; note: NoteInfo; notes: NoteInfo[]; primary: { label: string; go: () => void } | null;
  onBack: () => void; onNotes: () => void;
  onSave: (n: NoteInfo) => void; onShare: (n: NoteInfo) => void; onSend: (n: NoteInfo) => void;
}) {
  useEffect(() => { track('note_view', { kind: note.kind || '', answered: !!note.answer }); pageBox()?.scrollTo(0, 0); }, [note.id, note.kind, note.answer]);
  return (
    <div className="night relative min-h-dvh">
      <div className="shafts" />
      <div className="relative mx-auto max-w-[520px]">
        <TopBar onBack={onBack} backLabel="Back to your notes" left={<p className="truncate"><span className="caps text-[11px] text-bone/80">Note {note.noteNo}</span><span className="text-[13px] text-bone/50"> · {note.title}</span></p>} />
        <NoteView note={note} cfg={cfg} notes={notes} land={false} primary={primary}
          onSave={() => onSave(note)} onShare={() => onShare(note)} onSend={() => onSend(note)} onNotes={onNotes} />
      </div>
    </div>
  );
}
