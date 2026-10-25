import { CSSProperties, useEffect, useRef, useState } from 'react';
import { Answer } from '../lib/api';
import { CHOICES, choiceLabel, drawNote, NoteData, NoteLayout, TICK } from '../lib/cards';

/** how far, in page pixels, the paper's canvas reaches past its sides into the page's margin (for its shadow and the
 *  cover pinned to its corner): the pages that show it leave at least this much */
const BLEED = 16;

/** The note on the page: the very paper the story card carries, drawn by the card's own hand at the width the page
 *  gives it, so the two never differ. Peruzzi's stamp is drawn the same way and lands on it (unless `land` is off), and
 *  the tick goes in its box in red biro (drawn as it's made when `onTick` was the way it came). With `onTick`, and no
 *  answer yet, each of the three boxes is a button. What it says is there as text too, for screen readers. */
export function NotePaper({ note, answer = null, land = true, stamped = true, onTick, heading: Heading = 'h2' }: {
  note: NoteData; answer?: Answer | null; land?: boolean; stamped?: boolean; onTick?: (a: Answer) => void; heading?: 'h1' | 'h2';
}) {
  const box = useRef<HTMLDivElement>(null), sheet = useRef<HTMLCanvasElement>(null), mark = useRef<HTMLCanvasElement>(null);
  const [laid, setLaid] = useState<NoteLayout | null>(null);
  // a tick made here is drawn as it's made; one that was there already is simply there
  const [fresh, setFresh] = useState(false);
  const was = useRef(answer);
  useEffect(() => { if (answer && !was.current) setFresh(true); was.current = answer; }, [answer]);
  const key = JSON.stringify([note.noteNo, note.dear, note.line, note.peruzzi, note.escape, note.kind, note.stamp, note.nameplate]);
  useEffect(() => {
    let live = true, drawnAt = 0;
    // drawn again whenever its width changes (a phone turned on its side)
    const draw = () => {
      const width = Math.round(box.current?.clientWidth ?? 0);
      if (!width || width === drawnAt || !sheet.current || !mark.current) return;
      drawnAt = width;
      drawNote(sheet.current, mark.current, { ...note, answer: null }, width, BLEED).then((j) => { if (live) setLaid(j); }, () => {});
    };
    draw();
    const watch = new ResizeObserver(draw); if (box.current) watch.observe(box.current);
    return () => { live = false; watch.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const ticking = !!onTick && !answer;
  return (
    <div ref={box} className="relative" style={laid ? { height: laid.top + laid.height } : { aspectRatio: '928 / 1400' }}>
      <canvas ref={sheet} aria-hidden data-paper data-drawn={laid ? '' : undefined} className="pointer-events-none absolute top-0"
        style={laid ? { left: laid.sheet.left, width: laid.sheet.width, height: laid.sheet.height } : { visibility: 'hidden' }} />
      {/* Peruzzi's stamp, pressed into the paper as on the card (multiplied, a touch see-through) */}
      <span aria-hidden data-stamp className={`pointer-events-none absolute ${laid && land ? 'stamp-land' : ''}`}
        style={laid && stamped && note.kind ? { left: laid.stamp.x - laid.stamp.width / 2, top: laid.stamp.y - laid.stamp.height / 2, transform: `rotate(${laid.stamp.angle}deg)`, '--tilt': `${laid.stamp.angle}deg`, mixBlendMode: 'multiply' } as CSSProperties : { visibility: 'hidden' }}>
        <canvas ref={mark} className="block opacity-[0.92]" style={laid ? { width: laid.stamp.width, height: laid.stamp.height } : undefined} />
      </span>
      {/* the tick, in its box */}
      {laid && answer && laid.rows.filter((r) => r.a === answer).map((r) => (
        <svg key={r.a} aria-hidden data-tick={r.a} className="pointer-events-none absolute overflow-visible" style={{ left: r.box.x, top: r.box.y, width: r.box.size, height: r.box.size }} viewBox={`0 0 ${r.box.size} ${r.box.size}`}>
          <path d={TICK(r.box.size)} pathLength={1} className={fresh ? 'circle-draw' : undefined} fill="none" stroke="#a11d2a" strokeWidth={Math.max(2.5, r.box.size * 0.13)} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
      {/* the three boxes, each a button while there's no answer: the whole row, wider than it's drawn, for a thumb */}
      {laid && ticking && laid.rows.map((r) => (
        <button key={r.a} type="button" data-choice={r.a} onClick={() => onTick!(r.a)} aria-label={`Tick: ${choiceLabel(r.a, note.escape)}`}
          className="group absolute left-2 right-2 flex items-center rounded-sm transition-colors hover:bg-[rgba(161,29,42,0.06)] focus-visible:bg-[rgba(161,29,42,0.08)] active:bg-[rgba(161,29,42,0.12)]"
          style={{ top: r.top - 2, height: Math.max(40, r.height + 2) }}>
          <span aria-hidden className="tick-hint absolute rounded-[2px] border-2 border-[#a11d2a]/0 transition-colors group-hover:border-[#a11d2a]/60" style={{ left: r.box.x - 8 - 3, top: (Math.max(40, r.height + 2) - r.box.size) / 2 - 3, width: r.box.size + 6, height: r.box.size + 6 }} />
        </button>
      ))}
      <div className="sr-only">
        <p>Peruzzi Asked · Note {note.noteNo}</p>
        <Heading>Dear {note.dear},</Heading>
        <p>{note.line}</p>
        <p>{note.nameplate || 'Peruzzi'} says: {note.peruzzi}</p>
        {note.kind && <p>Stamped: {note.stamp}</p>}
        <p>Could this be love?</p>
        <ul>{CHOICES.map((a) => <li key={a}>{answer === a ? 'Ticked: ' : ''}{choiceLabel(a, note.escape)}</li>)}</ul>
      </div>
    </div>
  );
}
