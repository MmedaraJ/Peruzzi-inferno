import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NoteCardData, noteCard, toBlob, tracklistCard } from '../lib/cards';
import { Wordmark } from '../components/ui';

// Development only: the link previews to screenshot (1200×630), and every kind of card to look over.

/** The link previews, at their exact size: ?kind=site (the site's own) or ?kind=ask (a note sent to someone, kept
 *  folded). A headless browser screenshots them into public/media/img/og.jpg and og-ask.jpg. */
export function OgLab() {
  const [q] = useSearchParams(); const ask = q.get('kind') === 'ask';
  return (
    <div data-og className="concrete relative flex overflow-hidden" style={{ width: 1200, height: 630 }}>
      <div className="relative h-full w-[520px] shrink-0 overflow-hidden">
        <img src="/media/img/stage-1200.webp" alt="" className="absolute left-1/2 top-0 h-[150%] w-auto max-w-none -translate-x-1/2 [mask-image:radial-gradient(55%_60%_at_50%_36%,#000_50%,transparent_100%)]" />
        <div className="beam absolute left-1/2 top-[-6%] h-[112%] w-[90%] -translate-x-1/2" />
      </div>
      <div className="relative flex flex-1 flex-col justify-center pr-16">
        <Wordmark size="lg" className="self-start text-bone" />
        {ask ? (
          <>
            <h1 className="display mt-8 text-[64px] leading-[1.02] text-bone">peruzzi asked you something</h1>
            <div className="paper mt-8 flex w-[440px] -rotate-[1.2deg] items-center gap-4 px-6 py-5 shadow-[0_22px_44px_-20px_rgba(0,0,0,0.95)]">
              <span className="display text-[30px] text-paper-ink">Could this be love?</span>
            </div>
            <p className="caps mt-6 text-[16px] text-bone/70">A note for you · open it to answer</p>
          </>
        ) : (
          <>
            <h1 className="display mt-8 text-[70px] leading-[1.0] text-bone">who’s on your mind?</h1>
            <p className="mt-6 max-w-[560px] text-[27px] leading-snug text-bone/80">Write them a note. Peruzzi asks them for you: could this be love?</p>
            <div className="mt-8 flex items-center gap-6 text-[22px] text-bone/70">
              {['Yes', 'No', '…'].map((l) => <span key={l} className="flex items-center gap-2"><span className="inline-block h-[22px] w-[22px] border-2 border-bone/60" />{l}</span>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const SAMPLE: NoteCardData = {
  noteNo: '0042', title: 'Last Puff-Puff', dear: 'Tolu', line: 'I think you saved the last puff-puff for me on purpose.', peruzzi: 'Tolu, nobody saves the last puff-puff by accident.',
  escape: 'I was full.', kind: 'love', stamp: 'Love', site: 'peruzzi-asked.example.com', song: 'Inferno', artist: 'Peruzzi', nameplate: 'Peruzzi',
};
const LONG: NoteCardData = { ...SAMPLE, noteNo: '0043', title: 'Two Hours at the ATM', dear: 'Kemi', line: 'I think you queued at that ATM with me for two hours on purpose, and never once complained.', peruzzi: 'Kemi, two hours in an ATM queue is a wedding vow.', escape: 'I was also withdrawing money.' };
const NOT: NoteCardData = { ...SAMPLE, noteNo: '0044', title: 'Low Data', dear: 'Emeka', line: 'I think you only call me when your data finishes.', peruzzi: 'Emeka, that’s not love. That’s a data plan.', escape: 'My data finished again.', kind: 'not_love', stamp: 'Not love' };

/** Every card, drawn: a note as asked and as answered, story and square, and a tracklist. */
export function CardLab() {
  const [urls, setUrls] = useState<{ label: string; url: string }[]>([]);
  useEffect(() => {
    (async () => {
      const out: { label: string; url: string }[] = [];
      const add = async (label: string, c: HTMLCanvasElement) => out.push({ label, url: URL.createObjectURL(await toBlob(c, 0.9)) });
      await add('story · asked', await noteCard(SAMPLE, 'story'));
      await add('story · answered yes', await noteCard({ ...SAMPLE, answer: 'yes' }, 'story'));
      await add('story · long, third box', await noteCard({ ...LONG, answer: 'escape' }, 'story'));
      await add('story · not love', await noteCard(NOT, 'story'));
      await add('square · asked', await noteCard(SAMPLE, 'square'));
      await add('square · answered no', await noteCard({ ...LONG, answer: 'no' }, 'square'));
      const notes = [SAMPLE, LONG, NOT].map((n, i) => ({ noteNo: n.noteNo, title: n.title, dear: n.dear, answer: (['yes', null, 'escape'] as const)[i], escape: n.escape }));
      await add('tracklist story', await tracklistCard({ name: 'Tọ́kẹ́’s notes', meta: '3 notes · 2 answered · Lagos · 25 October', notes, site: SAMPLE.site, song: 'Inferno', artist: 'Peruzzi' }, 'story'));
      await add('tracklist square', await tracklistCard({ name: 'Love Notes', meta: '3 notes · 2 answered', notes, site: SAMPLE.site }, 'square'));
      setUrls(out);
    })();
  }, []);
  return (
    <div className="flex flex-wrap gap-6 bg-ink p-6">
      {urls.map((u) => <figure key={u.label} data-card={u.label} className="w-[360px]"><img src={u.url} alt={u.label} className="w-full" /><figcaption className="caps mt-2 text-[11px] text-bone/60">{u.label}</figcaption></figure>)}
    </div>
  );
}
