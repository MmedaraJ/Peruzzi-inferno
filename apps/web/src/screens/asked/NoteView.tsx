import { motion } from 'framer-motion';
import { ArrowRightIcon, DownloadSimpleIcon, PaperPlaneTiltIcon, ShareNetworkIcon } from '@phosphor-icons/react';
import { NoteInfo, StageConfig } from '../../lib/api';
import { STAMP_INK } from '../../components/Stamp';
import { Button } from '../../components/ui';
import { ListenButton } from '../../components/Listen';
import { NotePaper } from '../../components/NotePaper';
import { choiceLabel, NoteData } from '../../lib/cards';

/** What the paper needs from a note. */
export const paperOf = (n: { noteNo: string; title: string; dear: string; line: string | null; peruzzi: string | null; escape: string | null; kind: NoteInfo['kind']; stamp: string | null; answer?: NoteInfo['answer'] }, nameplate?: string): NoteData => ({
  noteNo: n.noteNo, title: n.title, dear: n.dear, line: n.line || '', peruzzi: n.peruzzi || '', escape: n.escape || '', kind: n.kind, stamp: n.stamp || 'Love', answer: n.answer ?? null, nameplate,
});

/** How far a note has got, in a few words: "Seen 2:14am. No tick yet." */
export function noteState(n: NoteInfo) {
  const time = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase();
  if (n.thing) return null;
  if (n.answer) return `${n.dear} ticked ${n.answer === 'escape' ? `“${(n.escape || '').replace(/[.]$/, '')}”` : choiceLabel(n.answer, '')}.`;
  if (n.seenAt) return `Seen ${time(n.seenAt)}. No tick yet.`;
  if (n.sent) return `Sent. ${n.dear} hasn’t opened it yet.`;
  return null;
}

/** The note: the story card's own paper, drawn on the page by the card's hand, so what's on screen is what gets
 *  posted. While Peruzzi's line is read out, a word under it says so. */
export function NoteSheet({ note, cfg, voicing = false, land = true }: { note: NoteInfo; cfg: StageConfig; voicing?: boolean; land?: boolean }) {
  return (
    <motion.div initial={land ? { y: 60, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
      <NotePaper note={paperOf(note, cfg.nameplate)} answer={note.answer} land={land} />
      {voicing && <p className="caps mt-3 flex items-center justify-center gap-2 text-[10px] text-bone/55"><span className="flex items-end gap-[2px]">{[0, 1, 2, 3].map((i) => <motion.span key={i} className="w-[3px] bg-bone/60" animate={{ height: [4, 12, 6, 10, 4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }} />)}</span>{cfg.nameplate} is reading it out{cfg.voice.mode === 'artist_ai' ? ` · ${cfg.voice.aiLabel}` : ''}</p>}
    </motion.div>
  );
}

/** What to do now, in order. Letting Peruzzi ask them comes first: the note is for them, and only they can tick it.
 *  Then posting it (the story-sized card, through the share sheet to wherever they post), and the song. A note to
 *  something that can't answer has nobody to send to, so it starts with posting it. */
export function NextSteps({ note, cfg, onShare, onSend, className = '' }: { note: NoteInfo; cfg: StageConfig; onShare: () => void; onSend: () => void; className?: string }) {
  const short = note.dear.length <= 14 ? note.dear : 'them';
  const state = noteState(note);
  const line = note.thing ? `${note.dear} can’t read it, but everyone else can.` : state || `Now let ${cfg.nameplate} ask ${short}.`;
  let n = 0;
  return (
    <section aria-label="Next steps" className={className}>
      <p className="caps text-[11px] text-bone/55">Next steps</p>
      <p data-state className="mt-1.5 text-[17px] leading-snug text-bone/85">{line}</p>
      <ol className="mt-3.5 flex flex-col gap-2.5">
        {!note.thing && <li><Step n={++n} filled kicker={`Let ${cfg.nameplate} ask`} label={note.sent ? <>Send it to {short} again</> : <>Send it to {short}</>} icon={<PaperPlaneTiltIcon size={19} weight="bold" />} onClick={onSend} /></li>}
        <li><Step n={++n} filled={note.thing} kicker="Post it" label="Put it on your story" icon={<ShareNetworkIcon size={19} weight="bold" />} onClick={onShare} /></li>
        <li><ListenButton href={cfg.smartLink} from="note" kicker={`${++n} · The song`} label={<>Listen to {cfg.song} by {cfg.artist}</>} /></li>
      </ol>
    </section>
  );
}
/** One of the next steps: its number and what it's for, and what to do. */
function Step({ n, kicker, label, icon, filled = false, onClick }: { n: number; kicker: string; label: React.ReactNode; icon: React.ReactNode; filled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`group flex min-h-[72px] w-full items-center gap-3.5 py-2.5 pl-3 pr-4 text-left transition-[transform,background-color,border-color] duration-150 active:scale-[0.99] ${filled ? 'bg-bone text-ink shadow-[0_12px_32px_-12px_rgba(236,229,216,0.45)] hover:bg-white' : 'border border-bone/30 text-bone hover:border-bone/60'}`}>
      <span className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full ${filled ? 'bg-ink text-bone' : 'border border-bone/35 text-bone/90'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`caps block text-[10px] ${filled ? 'text-ink/60' : 'text-bone/55'}`}>{n} · {kicker}</span>
        <span className="mt-0.5 block text-[17.5px] font-semibold leading-snug">{label}</span>
      </span>
      <ArrowRightIcon size={18} weight="bold" className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${filled ? 'text-ink/70' : 'text-bone/60'}`} />
    </button>
  );
}
/** A note on its page: the paper with the way to keep it right under it, the next steps (send it first), the next
 *  note, and the notebook underneath. */
export function NoteView({ note, cfg, notes, voicing = false, land = true, primary, onSave, onShare, onSend, onNotes }: {
  note: NoteInfo; cfg: StageConfig; notes: NoteInfo[]; voicing?: boolean; land?: boolean; primary: { label: string; go: () => void } | null;
  onSave: () => void; onShare: () => void; onSend: () => void; onNotes: () => void;
}) {
  return (
    <div className="px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-4">
      <NoteSheet note={note} cfg={cfg} voicing={voicing} land={land} />
      <motion.div className="mt-3" initial={land ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: land ? 0.9 : 0, duration: 0.5 }}>
        <button onClick={onSave} className="flex min-h-[50px] w-full items-center justify-center gap-2 border border-bone/20 px-2 text-[15px] text-bone/85 hover:border-bone/50"><DownloadSimpleIcon size={18} />Save image</button>
        <NextSteps note={note} cfg={cfg} onShare={onShare} onSend={onSend} className="mt-8" />
        {primary && <Button className="mt-8 w-full" onClick={primary.go}>{primary.label}</Button>}
        <NotesStrip notes={notes} current={note.id} onOpen={onNotes} className={primary ? 'mt-2.5' : 'mt-8'} />
      </motion.div>
    </div>
  );
}

/** The notebook at a glance: how many notes, the latest ones (each stamped, or ticked once answered), and the way in.
 *  Every one of them is on the tracklist. */
export function NotesStrip({ notes, current, onOpen, className = '' }: { notes: NoteInfo[]; current?: string; onOpen: () => void; className?: string }) {
  const kept = notes.filter((k) => k.status !== 'serious' && k.kind);
  const shown = kept.slice(-3);
  const answered = kept.filter((k) => k.answer).length;
  return (
    <button onClick={onOpen} className={`group flex w-full items-center gap-3 border border-bone/15 bg-gradient-to-r from-bone/[0.07] to-transparent px-4 py-3 text-left transition-colors hover:border-bone/40 ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="caps text-[10px] text-bone/55">Your notes</p>
        <p className="mt-0.5 text-[15.5px] leading-snug text-bone/90">{kept.length} {kept.length === 1 ? 'note' : 'notes'}{answered ? ` · ${answered} answered` : ''}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {kept.length > shown.length && <span className="text-[12px] text-bone/50">+{kept.length - shown.length}</span>}
        {shown.map((k) => <Slot key={k.id} k={k} current={k.id === current} />)}
      </div>
      <ArrowRightIcon size={17} className="shrink-0 text-bone/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
function Slot({ k, current }: { k: NoteInfo; current: boolean }) {
  const ink = STAMP_INK[k.kind!];
  return (
    <motion.span className={`paper relative flex h-[42px] w-[32px] items-center justify-center ${current ? 'ring-1 ring-bone/80 ring-offset-2 ring-offset-ink' : ''}`} initial={current ? { y: -6, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }}>
      <span className="absolute inset-x-[5px] top-[7px] h-[2px] bg-paper-ink/15" /><span className="absolute inset-x-[5px] top-[12px] h-[2px] bg-paper-ink/15" />
      {k.answer
        ? <svg aria-hidden viewBox="0 0 20 20" className="mt-2 h-[16px] w-[16px]"><rect x="2" y="4" width="13" height="13" fill="none" stroke="rgba(29,26,22,0.6)" strokeWidth="1.5" /><path d="M4 11 L8 15 L17 3" fill="none" stroke="#a11d2a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        : <span className="mt-2 h-[13px] w-[20px] -rotate-12 border-2" style={{ borderColor: ink }} />}
    </motion.span>
  );
}
