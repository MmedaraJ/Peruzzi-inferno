import { CSSProperties, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PublicNote, PublicTracklist, Site, api } from '../lib/api';
import { Footnote, Wordmark } from '../components/ui';
import { ListenButton } from '../components/Listen';
import { NotePaper } from '../components/NotePaper';
import { choiceLabel } from '../lib/cards';
import { track } from '../lib/track';
import { whenIdle } from '../lib/idle';
import { loadStage } from '../lazy';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
function useSite() { const [s, set] = useState<Site | null>(null); useEffect(() => { api.site().then(set).catch(() => {}); }, []); return s; }
const answered = (n: PublicNote) => (n.answer === 'escape' ? `“${n.escape.replace(/[.]$/, '')}”` : n.answer ? choiceLabel(n.answer, '') : '');

function Shell({ children, site }: { children: React.ReactNode; site: Site | null }) {
  // the stage's code, fetched while the page is read, so a tap on the way in opens it at once
  useEffect(() => whenIdle(() => { loadStage().catch(() => {}); }), []);
  return (
    <div className="night relative min-h-dvh overflow-hidden">
      <div className="shafts breathe" />
      <div className="relative mx-auto max-w-md px-5 pb-10 pt-[max(28px,env(safe-area-inset-top))]">
        <Link to="/" className="mx-auto flex w-fit flex-col items-center text-bone"><Wordmark /></Link>
        {children}
        <Footnote demo={site?.demoNotice ? site.demoText : null} credit={site?.credit} className="mt-10" />
      </div>
    </div>
  );
}
function Missing({ site }: { site: Site | null }) {
  return <Shell site={site}><h1 className="display mt-10 text-center text-[32px]">this note is gone</h1><p className="mt-3 text-center text-bone/70">It can’t be found. It may have been taken down.</p><Link to="/" className="mt-8 flex min-h-[52px] items-center justify-center rounded-xl text-[17px] font-semibold text-white fire shadow-[0_12px_32px_-12px_rgba(255,45,85,0.7)]">Write your own note</Link></Shell>;
}

/** A note someone posted, as anyone with the link sees it: Peruzzi's words and the tidied line, and the answer once
 *  it's ticked. Only the person it was sent to can tick it (their link is the key), so here it's to read, and to start
 *  one of your own. */
export function PublicNotePage() {
  const { code = '' } = useParams();
  const site = useSite();
  const [n, setN] = useState<PublicNote | null>(null); const [gone, setGone] = useState(false);
  useEffect(() => { api.note(code).then((r) => { setN(r); track('public_note_view', { answered: !!r.answer }); }).catch(() => setGone(true)); }, [code]);
  if (gone) return <Missing site={site} />;
  if (!n) return <Shell site={site}><div className="mt-12 h-96 animate-pulse bg-stone/60" /></Shell>;
  const nameplate = site?.artist || 'Peruzzi';
  return (
    <Shell site={site}>
      <p className="caps mt-5 text-center text-[11px] text-bone/70">{n.answer ? `${n.dear} answered` : `A note from ${n.writer || 'someone'}`}</p>
      <h1 className="display mt-2 text-center text-[30px] leading-tight">{n.answer ? `${n.dear} ticked ${answered(n)}` : `could this be love, ${n.dear}?`}</h1>
      {/* the pages people open from a shared link animate in CSS, so they don't wait for framer-motion; the paper is the
          story card's own, drawn on the page */}
      <div className="rise mt-6" style={{ '--rise-delay': '0s' } as CSSProperties}>
        <NotePaper note={{ noteNo: n.noteNo, title: n.title, dear: n.dear, line: n.line, escape: n.escape, nameplate, song: site?.song, artist: site?.artist }} answer={n.answer} heading="h2" />
      </div>
      <p className="mt-4 text-center text-[13.5px] leading-snug text-bone/55">From {n.writer || 'someone'} · {n.title}<br />{fmt(n.date)}{n.city ? ` · ${n.city}` : ''}</p>
      <div className="mt-6 flex flex-col gap-2.5">
        <Link to="/" onClick={() => track('write_own_click', { from: 'public_note' })} className="flex min-h-[54px] items-center justify-center rounded-xl text-[17px] font-semibold text-white fire shadow-[0_12px_32px_-12px_rgba(255,45,85,0.7)]">Who’s on your mind? Write a note</Link>
        {site?.smartLink && <ListenButton href={site.smartLink} from="public_note" kicker={`The song · ${site.artist}`} label={`Listen to ${site.song}`} />}
      </div>
      <p className="mt-4 text-center text-[13.5px] leading-snug text-bone/50">Peruzzi Asks is a fan experience for {site?.song || 'Inferno'} by {nameplate}. Write someone a note, and Peruzzi asks them for you.</p>
    </Shell>
  );
}

/** A tracklist, shared: every note on it so far, newest first, each with its answer once ticked. */
export function PublicTracklistPage() {
  const { code = '' } = useParams(); const site = useSite();
  const [r, setR] = useState<PublicTracklist | null>(null); const [gone, setGone] = useState(false);
  useEffect(() => { api.tracklist(code).then((x) => { setR(x); track('public_tracklist_view'); }).catch(() => setGone(true)); }, [code]);
  if (gone) return <Missing site={site} />;
  if (!r) return <Shell site={site}><div className="mt-12 h-96 animate-pulse bg-stone/60" /></Shell>;
  const done = r.notes.filter((k) => k.answer).length;
  return (
    <Shell site={site}>
      <p className="caps mt-5 text-center text-[11px] text-bone/70">The tracklist</p>
      <h1 className="display mt-2 text-center text-[34px] leading-tight">{r.name ? `${r.name}’s tracklist` : 'A tracklist'}</h1>
      <p className="caps mt-2 text-center text-[10.5px] text-bone/55">{[`${r.count} ${r.count === 1 ? 'note' : 'notes'}`, done ? `${done} answered` : '', r.city, fmt(r.date)].filter(Boolean).join(' · ')}</p>
      <ol className="paper mt-6 divide-y divide-paper-ink/15 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.95)]">
        {r.notes.map((k, i) => (
          <li key={k.code} className="fade-in flex items-center gap-3 px-5 py-3.5" style={{ animationDelay: `${0.15 + Math.min(i, 6) * 0.1}s` }}>
            <span className="caps w-6 shrink-0 text-[13px] text-paper-ink/45">{String(r.count - i).padStart(2, '0')}</span>
            <Link to={`/question/${k.code}`} className="min-w-0 flex-1">
              <span className="display block truncate text-[19px] leading-tight">{k.title}</span>
              <span className="block truncate text-[14.5px] italic text-paper-ink/65">for {k.dear}</span>
            </Link>
            {k.answer && <span className="shrink-0 text-right text-[14px] italic text-fire">✓ {answered(k)}</span>}
          </li>
        ))}
      </ol>
      <div className="mt-7 flex flex-col gap-2.5">
        <Link to="/" onClick={() => track('write_own_click', { from: 'public_tracklist' })} className="flex min-h-[54px] items-center justify-center rounded-xl text-[17px] font-semibold text-white fire shadow-[0_12px_32px_-12px_rgba(255,45,85,0.7)]">Who’s on your mind? Write a note</Link>
        {site?.smartLink && <ListenButton href={site.smartLink} from="public_tracklist" kicker={`The song · ${site.artist}`} label={`Listen to ${site.song}`} />}
      </div>
    </Shell>
  );
}
