import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NoteCardData, noteCard, toBlob, tracklistCard } from '../lib/cards';
import { Wordmark } from '../components/ui';
import { StageScene } from '../components/StageScene';

// Development only: the link previews to screenshot (1200×630), and every kind of card to look over.

/** The link previews, at their exact size: ?kind=site (the site's own) or ?kind=ask (a note sent to someone, kept
 *  folded). The stage on the left, as the site has it, held still; Peruzzi's question on the right. A headless browser
 *  screenshots them into public/media/img/og.jpg and og-ask.jpg. */
export function OgLab() {
  const [q] = useSearchParams(); const ask = q.get('kind') === 'ask';
  return (
    <div data-og className="night relative flex overflow-hidden" style={{ width: 1200, height: 630 }}>
      <StageScene still nameplate="Peruzzi" className="h-full w-[540px] shrink-0" />
      <div className="relative flex flex-1 flex-col justify-center pl-14 pr-14">
        <Wordmark size="lg" className="self-start text-blush" />
        <h1 className="display mt-8 text-[64px] leading-[1.02] text-bone">{ask ? 'peruzzi asked you something' : 'who’s on your mind?'}</h1>
        {!ask && <p className="mt-5 max-w-[540px] text-[27px] leading-snug text-bone/85">Tell them what they did. Peruzzi asks them for you:</p>}
        <div className={`${ask ? 'mt-8 -rotate-[1.2deg]' : 'mt-5'} w-[440px] rounded-2xl bg-rose px-7 py-5 text-white`}>
          <p className="caps text-[15px] text-blush">Peruzzi asks</p>
          <p className="display text-[40px] leading-tight">Could this be love?</p>
        </div>
        {ask && <p className="caps mt-6 text-[16px] text-bone/75">A note for you · open it to see</p>}
      </div>
    </div>
  );
}

const SAMPLE: NoteCardData = {
  noteNo: '0042', title: 'Blue Ticks', dear: 'Tobi', line: 'You left me on read for three days, then liked my story like nothing happened.', verdict: 'Blue-Tick Love',
  site: 'peruzziasks.com', song: 'Inferno', artist: 'Peruzzi', nameplate: 'Peruzzi',
};
const LONG: NoteCardData = { ...SAMPLE, noteNo: '0043', title: 'The Generator Did It', dear: 'Chidi', line: 'You ate my jollof, then blamed the generator like it has a mouth.', verdict: 'Generator Love' };
const NOT: NoteCardData = { ...SAMPLE, noteNo: '0044', title: 'Low Data', dear: 'Emeka', line: 'You only remember my number when your data finishes, like I’m customer care.', verdict: 'Customer Care' };

/** Every card, drawn: a note, story and square, and a tracklist. */
export function CardLab() {
  const [urls, setUrls] = useState<{ label: string; url: string }[]>([]);
  useEffect(() => {
    (async () => {
      const out: { label: string; url: string }[] = [];
      const add = async (label: string, c: HTMLCanvasElement) => out.push({ label, url: URL.createObjectURL(await toBlob(c, 0.9)) });
      await add('story', await noteCard(SAMPLE, 'story'));
      await add('story · a long name', await noteCard({ ...LONG, dear: 'Oluwadamilare' }, 'story'));
      await add('story · another', await noteCard(LONG, 'story'));
      await add('story · and another', await noteCard(NOT, 'story'));
      await add('square', await noteCard(SAMPLE, 'square'));
      await add('square · another', await noteCard(LONG, 'square'));
      const notes = [SAMPLE, LONG, NOT].map((n) => ({ noteNo: n.noteNo, title: n.title, dear: n.dear }));
      await add('tracklist story', await tracklistCard({ name: 'Tọ́kẹ́’s tracklist', meta: '3 notes · Lagos · 25 October', notes, site: SAMPLE.site, song: 'Inferno', artist: 'Peruzzi' }, 'story'));
      await add('tracklist square', await tracklistCard({ name: 'My tracklist', meta: '3 notes', notes, site: SAMPLE.site }, 'square'));
      setUrls(out);
    })();
  }, []);
  return (
    <div className="flex flex-wrap gap-6 bg-ink p-6">
      {urls.map((u) => <figure key={u.label} data-card={u.label} className="w-[360px]"><img src={u.url} alt={u.label} className="w-full" /><figcaption className="caps mt-2 text-[11px] text-bone/60">{u.label}</figcaption></figure>)}
    </div>
  );
}
