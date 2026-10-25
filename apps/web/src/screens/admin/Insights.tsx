import { useEffect, useState } from 'react';
import { admin } from '../../lib/api';
import { Section } from './kit';

const KINDS: Record<string, string> = { love: 'Love', not_love: 'Not love', nonsense: 'Nonsense' };
const ANSWERS: Record<string, string> = { yes: 'Yes', no: 'No', escape: 'The third box' };
const n = (x: number) => (x ?? 0).toLocaleString();

/** How it's going: totals only, never anyone's words. */
export function Insights({ token }: { token: string }) {
  const [days, setDays] = useState(7);
  const [r, setR] = useState<any>(null); const [busy, setBusy] = useState(false);
  const load = () => { setBusy(true); admin.insights(token, days).then(setR).finally(() => setBusy(false)); };
  useEffect(load, [days]);
  if (!r) return <p className="text-bone/60">Loading…</p>;
  const t = r.totals; const top = r.funnel[0]?.people || 0;
  const kpis: [string, number, string?][] = [
    ['People', t.visitors], ['Notes written', t.notes], ['Notes Peruzzi asked', t.asked], ['Tracklists', t.tracklists],
    ['Notes sent by link', t.asksLinks], ['Notes emailed', t.asksEmail], ['Opened by the one asked', t.seen],
    ['Answered', t.answered, `${t.yesRate}% ticked yes`], ['Written back', t.backs],
    ['Emails collected', t.contacts, `${n(t.marketing)} said yes to news`], ['Went to stream', t.streamClicks],
  ];
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[[1, 'Today'], [7, '7 days'], [30, '30 days'], [0, 'All time']].map(([d, l]) => <button key={d} onClick={() => setDays(d as number)} className={`min-h-10 border px-3.5 text-[14.5px] ${days === d ? 'border-bone bg-bone text-ink' : 'border-bone/20 text-bone/75'}`}>{l}</button>)}
        <span className="text-[13.5px] text-bone/45">{busy ? 'Refreshing…' : r.counting ? `Counting from ${new Date(r.counting).toLocaleString('en-GB')}` : 'Counting everything'}</span>
        <div className="flex-1" />
        <button onClick={async () => { if (confirm('Start counting from now? Earlier activity (your testing) is left out of these numbers and the public count. Nothing is deleted.')) { await admin.countFrom(token); load(); } }} className="text-[14px] text-bone/60 underline decoration-bone/25 underline-offset-4">Start counting from now</button>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, note]) => <div key={l} className="border border-bone/10 bg-white/[0.02] px-4 py-3"><p className="caps text-[10px] text-bone/50">{l}</p><p className="tabular mt-1 text-[28px] leading-none">{n(v)}</p>{note && <p className="mt-1 text-[12.5px] text-bone/45">{note}</p>}</div>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="From the stage to sharing" note="People, not visits">
          {r.funnel.map((f: any) => <Bar key={f.step} label={f.step} value={f.people} max={top} right={top ? `${Math.min(100, Math.round((f.people / top) * 100))}%` : ''} />)}
        </Section>
        <Section title="The answers" note="What the people asked ticked">
          {r.answers.length ? r.answers.map((v: any) => <Bar key={v.answer} label={ANSWERS[v.answer] || v.answer} value={v.n} max={r.answers[0].n} />) : <Empty />}
        </Section>
        <Section title="Peruzzi’s stamps">
          {r.kinds.length ? r.kinds.map((v: any) => <Bar key={v.kind} label={KINDS[v.kind] || v.kind} value={v.n} max={r.kinds[0].n} />) : <Empty />}
        </Section>
        <Section title="Who the notes are for">{r.dears.length ? r.dears.map((c: any) => <Bar key={c.label} label={c.label} value={c.n} max={r.dears[0].n} />) : <Empty />}</Section>
        <Section title="Notes per day"><Days rows={r.perDay} /></Section>
        <Section title="Busiest hours" note="Lagos time"><Hours hours={r.perHour} /></Section>
        <Section title="Cities" note="When people add one to their tracklist">{r.cities.length ? r.cities.map((c: any) => <Bar key={c.label} label={c.label} value={c.n} max={r.cities[0].n} />) : <Empty />}</Section>
        <Section title="Peruzzi’s lines (the AI)">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
            <Stat k="Model" v={r.ai.model} /><Stat k="Spent (estimate)" v={`$${r.ai.cost.toFixed(2)}`} />
            <Stat k="Per note" v={`$${r.ai.perNote.toFixed(4)}`} />
            <Stat k="Time to read" v={`${r.ai.avgThinkSec}s`} /><Stat k="Prepared lines used" v={`${n(t.fallbacks)} notes`} />
            <Stat k="Put down for help" v={`${n(t.serious)} notes`} /><Stat k="Tokens" v={`${n(r.ai.tokensIn)} in · ${n(r.ai.tokensOut)} out`} />
          </dl>
        </Section>
      </div>
    </div>
  );
}
function Bar({ label, value, max, right }: { label: string; value: number; max: number; right?: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[14.5px]"><span className="truncate pr-3">{label}</span><span className="tabular text-bone/70">{n(value)}{right ? <span className="ml-2 text-bone/40">{right}</span> : null}</span></div>
      <div className="mt-1 h-1.5 bg-bone/10"><div className="h-full bg-bone/70" style={{ width: `${max ? Math.min(100, Math.max(2, (value / max) * 100)) : 0}%` }} /></div>
    </div>
  );
}
function Days({ rows }: { rows: { day: string; n: number }[] }) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.map((r) => r.n)); const last = rows.slice(-30);
  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]">{last.map((r) => <div key={r.day} title={`${r.day}: ${r.n}`} className="flex-1 bg-bone/70" style={{ height: `${Math.max(3, (r.n / max) * 100)}%` }} />)}</div>
      <div className="mt-1.5 flex justify-between text-[12px] text-bone/45"><span>{last[0].day}</span><span>{last[last.length - 1].day}</span></div>
    </div>
  );
}
function Hours({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours); const peak = hours.indexOf(Math.max(...hours));
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]">{hours.map((v, h) => <div key={h} title={`${h}:00 · ${v}`} className={`flex-1 ${h === peak && v ? 'bg-bone' : 'bg-bone/45'}`} style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />)}</div>
      <div className="mt-1.5 flex justify-between text-[12px] text-bone/45"><span>midnight</span><span>6am</span><span>noon</span><span>6pm</span><span>11pm</span></div>
      {hours.some(Boolean) && <p className="mt-2 text-[14px] text-bone/65">Busiest at {peak}:00. {hours.slice(0, 5).reduce((a, b) => a + b, 0)} notes written between midnight and 5am.</p>}
    </div>
  );
}
const Stat = ({ k, v }: { k: string; v: string }) => <div><dt className="caps text-[10px] text-bone/50">{k}</dt><dd className="mt-0.5">{v}</dd></div>;
const Empty = () => <p className="text-[14.5px] text-bone/45">Nothing yet.</p>;
