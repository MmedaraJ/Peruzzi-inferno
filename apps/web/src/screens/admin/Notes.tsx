import { useEffect, useState } from 'react';
import { WarningIcon } from '@phosphor-icons/react';
import { admin } from '../../lib/api';
import { Sheet } from '../../components/Sheet';
import { ago, inputCls } from './kit';

const FILTERS: [string, string][] = [['all', 'All'], ['flagged', 'Flagged'], ['serious', 'Put down for help'], ['fallback', 'Prepared lines'], ['hidden', 'Hidden'], ['seen', 'Opened'], ['love', 'Sweet'], ['not_love', 'Not so sweet'], ['nonsense', 'Nonsense']];
const FLAG_WORDS: Record<string, string> = { injection: 'tried to steer Peruzzi', refusal: 'AI declined', error: 'AI error', slow: 'AI too slow', ceiling: 'hour’s AI limit reached', 'danger-words': 'danger words', redacted: 'details removed', serious: 'serious' };
const KINDS: Record<string, string> = { love: 'Sweet', not_love: 'Not so sweet', nonsense: 'Nonsense' };

/** Every note, newest first, to keep the stage safe: what was written, what Peruzzi said, where it was sent, whether
 *  it was opened. What people typed is wiped after the retention period (Admin → The stage). */
export function Notes({ token }: { token: string }) {
  const [filter, setFilter] = useState('all'); const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]); const [more, setMore] = useState(true); const [open, setOpen] = useState<any | null>(null);
  const load = async (reset: boolean) => {
    const before = reset ? undefined : rows[rows.length - 1]?.seq;
    const r = await admin.notes(token, filter === 'all' ? '' : filter, before, q.trim() || undefined);
    setRows((x) => (reset ? r : [...x, ...r])); setMore(r.length === 40);
  };
  useEffect(() => { load(true); }, [filter]);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`min-h-9 border px-3 text-[14px] ${filter === k ? 'border-bone bg-bone text-ink' : 'border-bone/20 text-bone/75'}`}>{l}</button>)}</div>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); load(true); }}><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, who it’s to and what was written" /><button className="min-h-11 border border-bone/25 px-4">Search</button></form>
      <div className="divide-y divide-bone/10 border border-bone/10">
        {rows.map((k) => (
          <button key={k.id} onClick={async () => setOpen(await admin.note(token, k.id))} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
            <span className="tabular w-12 shrink-0 text-[13px] text-bone/45">{k.noteNo}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[15.5px]">Dear {k.dear} · {k.title}</span>
              <span className="block truncate text-[13px] text-bone/45">{[k.writer, k.city, k.back ? 'written back' : '', k.asks ? `${k.asks} sent` : '', k.seen ? 'opened' : '', ago(k.createdAt)].filter(Boolean).join(' · ')}</span></span>
            {(k.flags.some((f: string) => ['injection', 'refusal', 'error', 'danger-words', 'serious'].includes(f)) || k.fallback) && <WarningIcon size={17} className="shrink-0 text-[#d9a35b]" />}
            {k.hidden && <span className="caps shrink-0 text-[10px] text-bone/45">Hidden</span>}
            <span className={`caps shrink-0 text-[10.5px] ${k.kind ? 'text-petal' : 'text-bone/40'}`}>{k.kind ? KINDS[k.kind] || k.kind : k.status === 'serious' ? 'Put down' : k.status}</span>
          </button>
        ))}
        {!rows.length && <p className="px-4 py-6 text-[15px] text-bone/50">No notes here yet.</p>}
      </div>
      {more && rows.length > 0 && <button onClick={() => load(false)} className="mt-4 min-h-11 border border-bone/25 px-4 text-[15px]">Show older</button>}
      <Sheet open={!!open} onClose={() => setOpen(null)} label="Note">
        {open && <NoteDetail k={open} onHide={async (h) => { await admin.hide(token, open.id, h); setOpen({ ...open, hidden: h }); setRows((r) => r.map((x) => (x.id === open.id ? { ...x, hidden: h } : x))); }} />}
      </Sheet>
    </div>
  );
}

function NoteDetail({ k, onHide }: { k: any; onHide: (hidden: boolean) => void }) {
  return (
    <div className="pr-8">
      <p className="caps text-[11px] text-bone/55">Note {k.noteNo} · {new Date(k.createdAt).toLocaleString('en-GB')}</p>
      <h2 className="mt-1 text-[22px]">Dear {k.dear} · {k.title}</h2>
      <p className="mt-1 text-[14px] text-bone/55">{[k.notebook.name && `From ${k.notebook.name}`, k.notebook.city, k.thing && 'to a thing', k.model, `${(k.ms / 1000).toFixed(1)}s to read`, k.fallback && 'a prepared line'].filter(Boolean).join(' · ')}</p>
      {k.flags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{k.flags.map((f: string) => <span key={f} className="border border-[#d9a35b]/50 px-2 py-0.5 text-[12.5px] text-[#e5c08f]">{FLAG_WORDS[f] || f}</span>)}</div>}
      <div className="mt-5 space-y-3">
        <div className="ml-6 border-l-2 border-bone/20 pl-3"><p className="caps text-[9.5px] text-bone/45">As written</p><p className="mt-0.5 text-[15.5px] italic leading-snug text-bone/80">{k.statement}</p></div>
        {k.status === 'asked' ? (
          <div className="border border-bone/15 p-3 text-[14.5px]">
            <p className="caps text-[10px] text-petal">{KINDS[k.kind] || k.kind}</p>
            <p className="mt-1">{k.line}</p>
            <p className="mt-1">Peruzzi asks: Could this be love?{k.verdict ? <> <span className="text-petal">{k.verdict}.</span></> : null}</p>
            {k.seenAt && <p className="mt-1 text-petal">Opened {new Date(k.seenAt).toLocaleString('en-GB')}</p>}
          </div>
        ) : <p className="text-[14.5px] text-bone/70">Peruzzi put the mic down and showed where to get help.</p>}
      </div>
      {k.asks.length > 0 && <div className="mt-5"><p className="caps text-[10.5px] text-bone/55">Sent</p>{k.asks.map((a: any, i: number) => <p key={i} className="mt-1 text-[14.5px] text-bone/75">{a.channel === 'email' ? `Emailed to ${a.recipientMask}` : `Link${a.recipientName ? ` for ${a.recipientName}` : ''}`} by {a.senderName} · {a.status}{a.openedAt ? ' · opened' : ''}{a.backAt ? ' · written back' : ''}</p>)}</div>}
      <div className="mt-6 flex gap-3">
        <button onClick={() => onHide(!k.hidden)} className="min-h-11 border border-bone/30 px-4">{k.hidden ? 'Show it again' : 'Hide from public links'}</button>
        {k.status === 'asked' && !k.hidden && <a href={`/question/${k.code}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center px-2 text-[14.5px] underline decoration-bone/30 underline-offset-4">Open its public page</a>}
      </div>
    </div>
  );
}
