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
    <div data-og className="night relative flex overflow-hidden" style={{ width: 1200, height: 630 }}>
      <div className="shafts" />
      <div className="relative h-full w-[520px] shrink-0 overflow-hidden">
        <img src="/media/img/stage-1200.webp" alt="" className="absolute left-1/2 top-0 h-[150%] w-auto max-w-none -translate-x-1/2 [mask-image:radial-gradient(55%_60%_at_50%_36%,#000_50%,transparent_100%)]" />
        <div className="absolute inset-0 mix-blend-soft-light bg-[linear-gradient(90deg,rgba(255,45,140,0.6)_0%,transparent_45%,transparent_55%,rgba(255,120,30,0.6)_100%)]" />
        <div className="beam absolute left-1/2 top-[-6%] h-[112%] w-[90%] -translate-x-1/2" />
      </div>
      <div className="relative flex flex-1 flex-col justify-center pr-16">
        <Wordmark size="lg" className="self-start text-bone" />
        {ask ? (
          <>
            <h1 className="display mt-8 text-[64px] leading-[1.02] text-bone">peruzzi asked you something</h1>
            <div className="fire mt-8 w-[470px] -rotate-[1.2deg] rounded-2xl px-7 py-5 text-white shadow-[0_22px_44px_-18px_rgba(255,45,85,0.7)]">
              <p className="caps text-[15px] text-white/90">Peruzzi asks</p>
              <p className="display text-[40px] leading-tight">Could this be love?</p>
            </div>
            <p className="caps mt-6 text-[16px] text-bone/75">A note for you · open it to answer</p>
          </>
        ) : (
          <>
            <h1 className="display mt-8 text-[70px] leading-[1.0] text-bone">who’s on your mind?</h1>
            <p className="mt-5 max-w-[560px] text-[27px] leading-snug text-bone/85">Tell them what they did. Peruzzi asks them for you:</p>
            <div className="fire mt-5 w-[440px] rounded-2xl px-6 py-4 text-white shadow-[0_22px_44px_-18px_rgba(255,45,85,0.7)]">
              <p className="caps text-[14px] text-white/90">Peruzzi asks</p>
              <p className="display text-[36px] leading-tight">Could this be love?</p>
            </div>
            <div className="mt-6 flex items-center gap-6 text-[22px] text-bone/80">
              {['Yes', 'No', '…'].map((l) => <span key={l} className="flex items-center gap-2"><span className="inline-block h-[22px] w-[22px] rounded-[4px] border-2 border-bone/60" />{l}</span>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const SAMPLE: NoteCardData = {
  noteNo: '0042', title: 'Last Puff-Puff', dear: 'Tolu', line: 'You guarded the last puff-puff for me like it was your WAEC result.',
  escape: 'I was full.', site: 'peruzziasks.com', song: 'Inferno', artist: 'Peruzzi', nameplate: 'Peruzzi',
};
const LONG: NoteCardData = { ...SAMPLE, noteNo: '0043', title: 'Two Hours at the ATM', dear: 'Kemi', line: 'You stood in an ATM queue with me for two hours like it was our first date.', escape: 'I was also withdrawing money.' };
const NOT: NoteCardData = { ...SAMPLE, noteNo: '0044', title: 'Low Data', dear: 'Emeka', line: 'You only remember my number when your data finishes, like I’m customer care.', escape: 'My data finished again.' };

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
      await add('story · not so sweet', await noteCard(NOT, 'story'));
      await add('square · asked', await noteCard(SAMPLE, 'square'));
      await add('square · answered no', await noteCard({ ...LONG, answer: 'no' }, 'square'));
      const notes = [SAMPLE, LONG, NOT].map((n, i) => ({ noteNo: n.noteNo, title: n.title, dear: n.dear, answer: (['yes', null, 'escape'] as const)[i], escape: n.escape }));
      await add('tracklist story', await tracklistCard({ name: 'Tọ́kẹ́’s tracklist', meta: '3 notes · 2 answered · Lagos · 25 October', notes, site: SAMPLE.site, song: 'Inferno', artist: 'Peruzzi' }, 'story'));
      await add('tracklist square', await tracklistCard({ name: 'Your tracklist', meta: '3 notes · 2 answered', notes, site: SAMPLE.site }, 'square'));
      setUrls(out);
    })();
  }, []);
  return (
    <div className="flex flex-wrap gap-6 bg-ink p-6">
      {urls.map((u) => <figure key={u.label} data-card={u.label} className="w-[360px]"><img src={u.url} alt={u.label} className="w-full" /><figcaption className="caps mt-2 text-[11px] text-bone/60">{u.label}</figcaption></figure>)}
    </div>
  );
}
