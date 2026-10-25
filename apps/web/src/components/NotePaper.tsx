import { useEffect, useRef, useState } from 'react';
import { drawNote, NoteData, NoteLayout } from '../lib/cards';

/** how far, in page pixels, the paper's canvas reaches past its sides into the page's margin (for its shadow and the
 *  cover pinned to its corner): the pages that show it leave at least this much */
const BLEED = 16;

/** The note on the page: the very paper the story card carries, drawn by the card's own hand at the width the page
 *  gives it, so the two never differ. What it says is there as text too, for screen readers. */
export function NotePaper({ note, heading: Heading = 'h2' }: { note: NoteData; heading?: 'h1' | 'h2' }) {
  const box = useRef<HTMLDivElement>(null), sheet = useRef<HTMLCanvasElement>(null);
  const [laid, setLaid] = useState<NoteLayout | null>(null);
  const key = JSON.stringify([note.noteNo, note.title, note.dear, note.line, note.nameplate, note.song, note.artist]);
  useEffect(() => {
    let live = true, drawnAt = 0;
    // drawn again whenever its width changes (a phone turned on its side)
    const draw = () => {
      const width = Math.round(box.current?.clientWidth ?? 0);
      if (!width || width === drawnAt || !sheet.current) return;
      drawnAt = width;
      drawNote(sheet.current, note, width, BLEED).then((j) => { if (live) setLaid(j); }, () => {});
    };
    draw();
    const watch = new ResizeObserver(draw); if (box.current) watch.observe(box.current);
    return () => { live = false; watch.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <div ref={box} className="relative" style={laid ? { height: laid.top + laid.height } : { aspectRatio: '928 / 1000' }}>
      <canvas ref={sheet} aria-hidden data-paper data-drawn={laid ? '' : undefined} className="pointer-events-none absolute top-0"
        style={laid ? { left: laid.sheet.left, width: laid.sheet.width, height: laid.sheet.height } : { visibility: 'hidden' }} />
      <div className="sr-only">
        <p>Note {note.noteNo} · {note.title}</p>
        <Heading>Dear {note.dear},</Heading>
        <p>{note.line}</p>
        <p>{note.nameplate || 'Peruzzi'} asks: Could this be love?</p>
        <p>{note.song || 'Inferno'} by {note.artist || 'Peruzzi'}</p>
      </div>
    </div>
  );
}
