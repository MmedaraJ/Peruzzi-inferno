import { ReactNode, useEffect, useRef, useState } from 'react';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { admin } from '../../lib/api';
import { Field, inputCls, SaveBar, Section, useDraft } from './kit';

/** What the site pays for, each with its colour: the first three of the categorical palette, stepped for a dark
 *  surface (checked for colour-blind separation and contrast on the admin's background). Colour follows the part. */
const PARTS = [
  { key: 'plans', label: 'Bills', note: 'hosting and plans', color: '#3987e5' },
  { key: 'ai', label: 'The AI', note: 'Peruzzi’s lines', color: '#d95926' },
  { key: 'voice', label: 'Voice', note: 'beyond its plan', color: '#199e70' },
] as const;
const AI = PARTS[1].color; const VOICE = PARTS[2].color;

const money = (x: number) => (x ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const short = (x: number) => (x >= 1e6 ? `$${Math.round(x / 1e5) / 10}M` : x >= 1000 ? `$${Math.round(x / 100) / 10}K` : x >= 100 ? `$${Math.round(x)}` : `$${Math.round(x * 100) / 100}`);
/** Dollars, to the cent below a hundred and to the dollar above. */
const dollars = (x: number) => (Math.abs(x) >= 100 ? (x ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : money(x));
const monthName = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);   // Lagos
/** A clean top for an axis: 1, 2 or 5 times a power of ten. */
const niceMax = (x: number) => { const p = 10 ** Math.floor(Math.log10(Math.max(x, 0.01))); return [1, 2, 5, 10].map((k) => k * p).find((v) => v >= x) || 10 * p; };

type Tip = { x: number; y: number; title: string; rows: { color?: string; label: string; value: string; on?: boolean }[] } | null;

/** What the site costs to run, what's been paid towards it and what's still to pay, so Peruzzi's team know what keeps
 *  it up. The AI and the voice are worked out from what the site used; the bills and payments are set here. */
export function Costs({ token, value, voice, onSave }: { token: string; value: any; voice?: { mode: string }; onSave: (v: any) => Promise<any> }) {
  const [r, setR] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  const load = () => admin.costs(token).then(setR, (e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const [d, setD, dirty] = useDraft(value);
  if (err) return <p className="text-[#f0c4c4]">{err}</p>;
  if (!r) return <p className="text-bone/60">Loading…</p>;
  const naira = (x: number) => (r.rate > 0 ? `≈ ₦${Math.round(x * r.rate).toLocaleString('en-NG')}` : undefined);
  const t = r.totals; const m = r.monthly;
  const set = (patch: any) => setD({ ...d, ...patch });
  return (
    <div>
      <div className="mb-5 border border-bone/10 bg-white/[0.02] px-5 py-5">
        <p className="caps text-[11px] text-bone/55">{t.owed >= 0 ? 'Still to pay' : 'Paid ahead'}</p>
        <p className="mt-1.5 text-[54px] font-medium leading-none" data-owed>{money(Math.abs(t.owed))}</p>
        {naira(Math.abs(t.owed)) && <p className="mt-1.5 text-[16px] text-bone/60">{naira(Math.abs(t.owed))}</p>}
        <p className="mt-3 max-w-3xl text-[14.5px] leading-snug text-bone/60">
          {money(t.incurred)} spent since the site opened{r.firstDay ? ` (${new Date(r.firstDay).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })})` : ''}, {money(t.paid)} paid. The AI and the voice are worked out from what the site used, at the providers’ list prices; the bills are the ones set below. The providers’ own invoices are the record.
        </p>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Spent so far" value={money(t.incurred)} sub={naira(t.incurred)} />
        <Tile label="Paid" value={money(t.paid)} sub={naira(t.paid)} />
        <Tile label="This month so far" value={money(t.thisMonth)} sub={naira(t.thisMonth)} />
        <Tile label="To keep it running" value={`${money(m.total)}`} sub={`a month${naira(m.total) ? ` · ${naira(m.total)}` : ''}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Month by month" note="What each month cost: the bills, the AI, and the voice beyond its plan">
          <MonthChart months={r.months} />
        </Section>
        <Section title="The AI, day by day" note="The last 30 days, Lagos time">
          <DayChart days={r.days} />
        </Section>
        <Section title="To keep it running" note="A month, at the pace of the last 30 days">
          <KeepRunning r={r} items={value.items || []} naira={naira} />
        </Section>
        <Section title="The voice this month" note="ElevenLabs credits the stage’s readings used, against the plan set below">
          <VoiceMeter v={r.voice} over={r.months[r.months.length - 1]?.voice || 0} />
        </Section>
      </div>

      <Section title="Projections" note="What the site would cost at a given size, and over a stretch of time: what a note costs now (the AI, the voice), the bills as set below, and hosting that grows with the traffic.">
        <Projections r={r} d={d} set={set} naira={naira} reads={!voice || voice.mode === 'off' ? 'none' : 'note'} />
      </Section>

      <Section title="Payments" note="Money paid towards these costs, by whoever paid it. It comes off what’s still to pay.">
        <div className="space-y-3">
          {d.payments.map((p: any, i: number) => {
            const up = (patch: any) => set({ payments: d.payments.map((x: any, j: number) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={p.id} className="flex gap-2 border border-bone/10 p-3" data-payment>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[0.9fr_0.8fr_0.6fr_0.7fr_1fr]">
                  <Labelled t="Paid on"><input type="date" className={inputCls} value={p.at} onChange={(e) => up({ at: e.target.value })} /></Labelled>
                  <Labelled t="Amount"><input type="number" min={0} step="0.01" className={inputCls} value={p.amount} onChange={(e) => up({ amount: Number(e.target.value) })} /></Labelled>
                  <Labelled t="In"><select className={inputCls} value={p.currency} onChange={(e) => up({ currency: e.target.value, rate: e.target.value === 'NGN' ? p.rate || d.rate || undefined : undefined })}><option value="USD">$ dollars</option><option value="NGN">₦ naira</option></select></Labelled>
                  {p.currency === 'NGN'
                    ? <Labelled t="Naira to the dollar"><input type="number" min={0} className={inputCls} value={p.rate ?? ''} onChange={(e) => up({ rate: Number(e.target.value) || undefined })} /></Labelled>
                    : <span className="hidden sm:block" />}
                  <Labelled t="Paid by" className="col-span-2 sm:col-span-1"><input className={inputCls} value={p.by} onChange={(e) => up({ by: e.target.value })} /></Labelled>
                  <Labelled t="What it was for" className="col-span-2 sm:col-span-5"><input className={inputCls} value={p.note || ''} onChange={(e) => up({ note: e.target.value })} placeholder="October’s bills, the voice plan…" /></Labelled>
                </div>
                <button type="button" aria-label="Remove the payment" onClick={() => set({ payments: d.payments.filter((_: any, j: number) => j !== i) })} className="flex w-10 shrink-0 items-center justify-center border border-bone/15 text-bone/60"><TrashIcon size={16} /></button>
              </div>
            );
          })}
          {!d.payments.length && <p className="text-[14.5px] text-bone/45">No payments yet.</p>}
          <button onClick={() => set({ payments: [{ id: newId(), at: today(), amount: 0, currency: 'USD', by: 'Peruzzi’s team', note: '' }, ...d.payments] })} className="flex min-h-10 items-center gap-2 border border-bone/25 px-4 text-[14.5px]"><PlusIcon size={15} /> Add a payment</button>
        </div>
      </Section>

      <Section title="Bills" note="What the site pays whatever its traffic. Set each to the real bill: the defaults are the usual plans. A bill with no start date started with the site.">
        <div className="space-y-3">
          {d.items.map((it: any, i: number) => {
            const up = (patch: any) => set({ items: d.items.map((x: any, j: number) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={it.id} className="flex gap-2 border border-bone/10 p-3" data-bill>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[1.6fr_0.6fr_0.7fr_0.8fr_0.8fr]">
                  <Labelled t="What it is" className="col-span-2 sm:col-span-1"><input className={inputCls} value={it.name} onChange={(e) => up({ name: e.target.value })} /></Labelled>
                  <Labelled t="Dollars"><input type="number" min={0} step="0.01" className={inputCls} value={it.amount} onChange={(e) => up({ amount: Number(e.target.value) })} /></Labelled>
                  <Labelled t="How often"><select className={inputCls} value={it.every} onChange={(e) => up({ every: e.target.value })}><option value="month">a month</option><option value="year">a year</option><option value="once">once</option></select></Labelled>
                  <Labelled t={it.every === 'once' ? 'When' : 'From (empty: the start)'}><input type="month" className={inputCls} value={(it.from || '').slice(0, 7)} onChange={(e) => up({ from: e.target.value })} /></Labelled>
                  {it.every === 'once' ? <span className="hidden sm:block" /> : <Labelled t="Until (empty: still on)"><input type="month" className={inputCls} value={(it.until || '').slice(0, 7)} onChange={(e) => up({ until: e.target.value || undefined })} /></Labelled>}
                  <Labelled t="Note" className="col-span-2 sm:col-span-5"><input className={inputCls} value={it.note || ''} onChange={(e) => up({ note: e.target.value })} placeholder="The plan, where to find the bill" /></Labelled>
                </div>
                <button type="button" aria-label="Remove the bill" onClick={() => set({ items: d.items.filter((_: any, j: number) => j !== i) })} className="flex w-10 shrink-0 items-center justify-center border border-bone/15 text-bone/60"><TrashIcon size={16} /></button>
              </div>
            );
          })}
          <button onClick={() => set({ items: [...d.items, { id: newId(), name: '', amount: 0, every: 'month', from: today().slice(0, 7), note: '' }] })} className="flex min-h-10 items-center gap-2 border border-bone/25 px-4 text-[14.5px]"><PlusIcon size={15} /> Add a bill</button>
        </div>
      </Section>

      <Section title="Rates">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Naira to the dollar" hint="To show every cost in naira too. 0: dollars only.">
            <input type="number" min={0} aria-label="Naira to the dollar" className={`${inputCls} w-40`} value={d.rate} onChange={(e) => set({ rate: Number(e.target.value) })} />
          </Field>
          <Field label="Voice plan: credits a month" hint="What the ElevenLabs plan includes (Creator: 100,000).">
            <input type="number" min={0} aria-label="Credits a month" className={`${inputCls} w-40`} value={d.voice.credits} onChange={(e) => set({ voice: { ...d.voice, credits: Number(e.target.value) } })} />
          </Field>
          <Field label="Each 1,000 credits beyond it" hint="In dollars (Creator: $0.30).">
            <input type="number" min={0} step="0.01" aria-label="Each 1,000 credits beyond the plan" className={`${inputCls} w-40`} value={d.voice.overPer1k} onChange={(e) => set({ voice: { ...d.voice, overPer1k: Number(e.target.value) } })} />
          </Field>
        </div>
      </Section>
      <SaveBar dirty={dirty} onSave={async () => { await onSave(d); await load(); }} saved="Saved. The totals are up to date." />
    </div>
  );
}

/** A row of choices with its name over it: a group, not a label, so each button keeps its own name. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return <div role="group" aria-label={label}><span className="caps block text-[10.5px] text-bone/55">{label}</span><div className="mt-1.5">{children}</div></div>;
}

/** A form field with its name over it (a date box shows no hint of its own). */
function Labelled({ t, className = '', children }: { t: string; className?: string; children: ReactNode }) {
  return <label className={`block min-w-0 ${className}`}><span className="mb-1 block text-[12px] text-bone/50">{t}</span>{children}</label>;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="border border-bone/10 bg-white/[0.02] px-4 py-3"><p className="text-[13px] text-bone/55">{label}</p><p className="mt-1 text-[27px] leading-tight">{value}</p>{sub && <p className="mt-0.5 text-[12.5px] text-bone/45">{sub}</p>}</div>;
}

/** The tooltip over a chart: values first, then what they are, keyed by a short stroke of their colour. */
function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div role="status" className="pointer-events-none absolute z-10 min-w-[170px] -translate-x-1/2 -translate-y-full border border-bone/15 bg-[#1d1b18] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]" style={{ left: tip.x, top: tip.y - 8 }}>
      <p className="text-[12px] text-bone/55">{tip.title}</p>
      {tip.rows.map((row) => (
        <p key={row.label} className={`mt-1 flex items-center gap-2 text-[13.5px] ${row.on === false ? 'text-bone/50' : ''}`}>
          {row.color && <span className="h-[2px] w-3 shrink-0" style={{ background: row.color }} />}
          <span className="font-semibold text-bone">{row.value}</span><span className="text-bone/60">{row.label}</span>
        </p>
      ))}
    </div>
  );
}
/** A column's tooltip: over its middle, at the top of what's drawn in it. */
const at = (e: { currentTarget: Element }, box: HTMLElement | null, fromTop: number) => {
  const a = e.currentTarget.getBoundingClientRect(); const b = box?.getBoundingClientRect();
  return { x: a.left + a.width / 2 - (b?.left ?? 0), y: fromTop };
};
/** The value lines of a chart, from its baseline (`base` px up from the bottom of the box) over `scale` px. */
function Grid({ ticks, max, base, scale }: { ticks: number[]; max: number; base: number; scale: number }) {
  return <>{ticks.map((v) => (
    <div key={v} className={`absolute left-11 right-0 border-t ${v ? 'border-bone/[0.08]' : 'border-bone/25'}`} style={{ bottom: base + (v / max) * scale }}>
      <span className="tabular absolute -left-11 -top-2 w-9 text-right text-[11.5px] text-bone/45">{short(v)}</span>
    </div>
  ))}</>;
}

/** The parts' colours, named. */
function Legend({ voiceNote = PARTS[2].note, billsNote = PARTS[0].note }: { voiceNote?: string; billsNote?: string }) {
  return <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-bone/70">{PARTS.map((p) => <span key={p.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: p.color }} />{p.label} <span className="text-bone/40">{p.key === 'voice' ? voiceNote : p.key === 'plans' ? billsNote : p.note}</span></span>)}</div>;
}

type StackRow = { month: string; plans: number; ai: number; voice: number; total: number; notes?: number; plan?: string | null };
/** A column a month, stacked bills, AI, voice. With a few months, each total sits on its column; with many, only the
 *  biggest and the last are labelled (the rest are in the table, and on pointing at or tabbing to a month). */
function StackChart({ rows }: { rows: StackRow[] }) {
  const box = useRef<HTMLDivElement>(null); const [tip, setTip] = useState<Tip>(null);
  // as many months named under it as there's room for (about 72px each)
  const [width, setWidth] = useState(600);
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setWidth(el.clientWidth)); ro.observe(el); return () => ro.disconnect(); }, []);
  const H = 190, BASE = 24, S = H - BASE - 26;   // the box, the band for the months under it, the room for the bars
  const max = niceMax(Math.max(0.01, ...rows.map((x) => x.total))); const many = rows.length > Math.max(2, Math.floor((width - 44) / 72));
  const peak = rows.reduce((b, x, i) => (x.total > rows[b].total ? i : b), 0); const every = Math.ceil(rows.length / Math.max(2, Math.floor((width - 44) / 72)));
  return (
    <div ref={box} className="relative" style={{ height: H }} onPointerLeave={() => setTip(null)}>
      <Grid ticks={[0, max / 2, max]} max={max} base={BASE} scale={S} />
      <div className="absolute bottom-0 left-11 right-0 flex justify-around" style={{ height: H }}>
        {rows.map((x, i) => {
          const parts = PARTS.filter((p) => (x as any)[p.key] > 0); const top = parts[parts.length - 1]?.key;
          const h = parts.reduce((s, p) => s + Math.max(2, ((x as any)[p.key] / max) * S) + 2, -2);
          const rowsOf = [...PARTS.map((p) => ({ color: p.color, label: p.key === 'voice' && x.plan ? `Voice (${x.plan})` : p.label, value: money((x as any)[p.key]) })), ...(x.notes != null ? [{ label: 'notes', value: x.notes.toLocaleString() }] : []), { label: 'in all', value: money(x.total) }];
          const show = (e: any) => setTip({ ...at(e, box.current, H - BASE - Math.max(0, h) - 20), title: monthName(x.month), rows: rowsOf });
          const labelled = !many || i === peak || i === rows.length - 1;
          return (
            <div key={x.month} tabIndex={0} aria-label={`${monthName(x.month)}: ${PARTS.map((p) => `${p.label} ${money((x as any)[p.key])}`).join(', ')}; ${money(x.total)} in all`}
              className="flex min-w-0 max-w-[120px] flex-1 flex-col items-center justify-end focus:outline-none [&:focus>div]:opacity-80" onPointerEnter={show} onFocus={show} onBlur={() => setTip(null)}>
              {labelled && <span className="mb-1 whitespace-nowrap text-[12px] text-bone/80">{short(x.total)}</span>}
              <div className="flex w-[70%] max-w-[24px] flex-col-reverse gap-[2px]">
                {parts.map((p) => <div key={p.key} className={p.key === top ? 'rounded-t-[4px]' : ''} style={{ height: Math.max(2, ((x as any)[p.key] / max) * S), background: p.color }} />)}
              </div>
              <span className="flex items-end whitespace-nowrap text-[12px] text-bone/55" style={{ height: BASE }}>{i % every === 0 ? monthName(x.month) : ''}</span>
            </div>
          );
        })}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Each month the site has run (the last twelve on the chart), and all of them in the table under it. */
function MonthChart({ months }: { months: any[] }) {
  return (
    <div>
      <Legend />
      <StackChart rows={months.slice(-12)} />
      <table className="mt-4 w-full text-[13.5px]">
        <thead><tr className="text-left text-bone/50"><th className="py-1 font-normal">Month</th>{PARTS.map((p) => <th key={p.key} className="py-1 text-right font-normal">{p.label}</th>)}<th className="py-1 text-right font-normal">In all</th></tr></thead>
        <tbody>{months.slice().reverse().map((x) => (
          <tr key={x.month} className="border-t border-bone/10"><td className="py-1.5">{monthName(x.month)}</td>{PARTS.map((p) => <td key={p.key} className="tabular py-1.5 text-right text-bone/80">{money(x[p.key])}</td>)}<td className="tabular py-1.5 text-right">{money(x.total)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** The AI's spend each day for the last 30, with the busiest day's labelled. Each day's whole column answers the
 *  pointer, not only its bar. */
function DayChart({ days }: { days: { day: string; ai: number; notes: number }[] }) {
  const box = useRef<HTMLDivElement>(null); const [tip, setTip] = useState<Tip>(null);
  const H = 176, BASE = 22, S = H - BASE - 22;
  const top = Math.max(0.01, ...days.map((x) => x.ai)); const max = niceMax(top); const peak = days.findIndex((x) => x.ai === top);
  return (
    <div>
      <p className="mb-3 text-[14px] text-bone/65">{money(days.reduce((s, x) => s + x.ai, 0))} in 30 days, over {days.reduce((s, x) => s + x.notes, 0).toLocaleString()} notes.</p>
      <div ref={box} className="relative" style={{ height: H }} onPointerLeave={() => setTip(null)}>
        <Grid ticks={[0, max]} max={max} base={BASE} scale={S} />
        <div className="absolute left-11 right-0 flex items-end gap-[2px]" style={{ bottom: BASE, height: H - BASE }}>
          {days.map((x, i) => {
            const h = x.ai > 0 ? Math.max(2, (x.ai / max) * S) : 0;
            const show = (e: any) => setTip({ ...at(e, box.current, H - BASE - h - 4), title: dayName(x.day), rows: [{ color: AI, label: 'the AI', value: money(x.ai) }, { label: x.notes === 1 ? 'note' : 'notes', value: x.notes.toLocaleString() }] });
            return (
              <div key={x.day} tabIndex={0} aria-label={`${dayName(x.day)}: ${money(x.ai)}, ${x.notes} notes`} onPointerEnter={show} onFocus={show} onBlur={() => setTip(null)}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end focus:outline-none [&:focus>div]:opacity-80">
                {i === peak && x.ai > 0 && <span className="mb-1 whitespace-nowrap text-[11.5px] text-bone/80">{money(x.ai)}</span>}
                <div className="w-full max-w-[24px] rounded-t-[4px]" style={{ height: h, background: AI }} />
              </div>
            );
          })}
        </div>
        <div className="absolute bottom-0 left-11 right-0 flex justify-between text-[12px] text-bone/50"><span>{dayName(days[0].day)}</span><span>{dayName(days[days.length - 1].day)}</span></div>
        <Tooltip tip={tip} />
      </div>
    </div>
  );
}

/** What a month takes, bill by bill, and the AI and the voice at the last 30 days' pace. */
function KeepRunning({ r, items, naira }: { r: any; items: any[]; naira: (x: number) => string | undefined }) {
  const month = new Date(Date.now() + 3600_000).toISOString().slice(0, 7); const m = r.monthly;
  const bills = items.filter((it) => it.amount > 0 && it.every !== 'once' && (!it.until || it.until.slice(0, 7) >= month));
  const row = (label: string, value: number, note?: string, color?: string) => (
    <div key={label} className="flex items-baseline gap-3 border-t border-bone/10 py-2 text-[14.5px]">
      {color && <span className="h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[2px]" style={{ background: color }} />}
      <span className="min-w-0 flex-1">{label}{note && <span className="block text-[12.5px] text-bone/45">{note}</span>}</span>
      <span className="tabular whitespace-nowrap">{money(value)}</span>
    </div>
  );
  return (
    <div>
      {bills.map((it) => row(it.name, it.every === 'year' ? it.amount / 12 : it.amount, it.every === 'year' ? `${money(it.amount)} a year` : it.note, PARTS[0].color))}
      {row('The AI', m.ai, m.notes ? `${m.notes.toLocaleString()} notes in the last 30 days, about ${money(m.perNote)} each` : 'No notes in the last 30 days', AI)}
      {row('Voice beyond its plan', m.voice, m.notes ? `About ${m.charsPerNote.toLocaleString()} characters read per note` : undefined, VOICE)}
      <div className="flex items-baseline justify-between border-t border-bone/30 pt-2.5 text-[16px]"><span>A month</span><span className="text-right"><span className="tabular">{money(m.total)}</span>{naira(m.total) && <span className="block text-[12.5px] text-bone/50">{naira(m.total)}</span>}</span></div>
    </div>
  );
}

const MILESTONES = [
  { name: 'A quiet start', notes: 1_000 },
  { name: 'Word gets out', notes: 10_000 },
  { name: 'It catches on', notes: 50_000 },
  { name: 'It goes viral', notes: 250_000 },
];
type Reads = 'note' | 'none';
const READS: [Reads, string][] = [['note', 'Every note'], ['none', 'Nothing: no voice']];
type Plan = { name: string; fee: number; credits: number; overPer1k: number };
type Unit = { ai: number; note: number; perChar: number; hostingPer10k: number; plans: Plan[]; asYouGo: number; aiNotes: number; voiceNotes: number };
const MEASURED = 20;   // notes before a per-note cost is the site's own, not an assumption
/** The bills that don't grow with the traffic, a month (ElevenLabs is left out: the projections pick its plan). */
const steadyBills = (items: any[]) => {
  const month = new Date(Date.now() + 3600_000).toISOString().slice(0, 7);
  return items.filter((it) => it.id !== 'elevenlabs' && !/elevenlabs/i.test(it.name || '') && it.amount > 0 && it.every !== 'once' && (!it.until || it.until.slice(0, 7) >= month))
    .reduce((s, it) => s + (it.every === 'year' ? it.amount / 12 : it.amount), 0);
};
/** A month at this many notes: the AI and the voice at what a note costs now, the cheapest ElevenLabs plan for the
 *  credits, and the bills, with hosting growing with the traffic. */
function monthAt(notes: number, u: Unit, reads: Reads, bills: number) {
  const credits = notes * (reads === 'note' ? u.note : 0) * u.perChar;
  const options = u.plans.length ? u.plans.map((p) => ({ name: p.name, cost: p.fee + (Math.max(0, credits - p.credits) / 1000) * p.overPer1k })) : [{ name: 'as used', cost: (credits / 1000) * u.asYouGo }];
  const plan = credits > 0 ? options.sort((a, b) => a.cost - b.cost)[0] : null;
  const ai = notes * u.ai; const voice = plan?.cost ?? 0; const plans = bills + (notes / 10_000) * u.hostingPer10k;
  return { notes, ai, voice, plan: plan?.name ?? null, plans, total: ai + voice + plans };
}
const nextMonths = (n: number) => {
  const [y, m] = new Date(Date.now() + 3600_000).toISOString().slice(0, 7).split('-').map(Number);
  return Array.from({ length: n }, (_, i) => { const k = m + i; return `${y + Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`; });
};

/** What the site would cost: a month at four sizes, and any size over any stretch, growing or not. Built from what a
 *  note costs now (measured once Peruzzi has read enough notes), so the team can see what each milestone takes. */
function Projections({ r, d, set, naira, reads: readsNow }: { r: any; d: any; set: (patch: any) => void; naira: (x: number) => string | undefined; reads: Reads }) {
  const [notes, setNotes] = useState(10_000); const [growth, setGrowth] = useState(0); const [months, setMonths] = useState(6); const [reads, setReads] = useState<Reads>(readsNow);
  const a = d.projection; const un = r.unit;
  const u: Unit = { ai: un.aiNotes >= MEASURED ? un.aiPerNote : a.aiPerNote, note: un.voiceNotes >= MEASURED ? un.charsNote : a.charsNote,
    perChar: un.creditsPerChar, hostingPer10k: a.hostingPer10k, plans: a.voicePlans || [], asYouGo: d.voice.overPer1k, aiNotes: un.aiNotes, voiceNotes: un.voiceNotes };
  const bills = steadyBills(d.items || []);
  const rows = nextMonths(months).map((month, i) => ({ month, ...monthAt(Math.round(Math.max(0, notes) * (1 + growth / 100) ** i), u, reads, bills) }));
  const total = rows.reduce((s, x) => s + x.total, 0); const all = rows.reduce((s, x) => s + x.notes, 0);
  const setA = (patch: any) => set({ projection: { ...a, ...patch } });
  const plans: Plan[] = a.voicePlans || [];
  const choice = (on: boolean) => `min-h-10 border px-3 text-[14px] ${on ? 'border-bone bg-bone text-ink' : 'border-bone/20 text-bone/75 hover:border-bone/40'}`;
  return (
    <div>
      <p className="mb-3 text-[14px] text-bone/60">A month at each size, with the voice reading {reads === 'note' ? 'every note' : 'nothing'}. Tap one to work with it below.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MILESTONES.map((ms) => {
          const x = monthAt(ms.notes, u, reads, bills);
          return (
            <button key={ms.name} type="button" data-milestone={ms.notes} onClick={() => setNotes(ms.notes)}
              className={`border px-4 py-3 text-left transition-colors ${notes === ms.notes ? 'border-bone/60 bg-bone/[0.07]' : 'border-bone/10 bg-white/[0.02] hover:border-bone/30'}`}>
              <p className="text-[13px] text-bone/55">{ms.name}</p>
              <p className="text-[14px] text-bone/80">{ms.notes.toLocaleString()} notes a month</p>
              <p className="mt-2 text-[26px] leading-tight">{dollars(x.total)}<span className="text-[14px] text-bone/50"> a month</span></p>
              <p className="mt-0.5 text-[12.5px] text-bone/45">{money(x.total / ms.notes)} a note{naira(x.total) ? ` · ${naira(x.total)}` : ''}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Field label="Notes a month"><input type="number" min={0} step={1000} aria-label="Notes a month" className={`${inputCls} w-40`} value={notes} onChange={(e) => setNotes(Math.max(0, Math.round(Number(e.target.value) || 0)))} /></Field>
          <Field label="Growing each month by" hint="0: the same every month. 50: half as many again each month.">
            <span className="flex items-center gap-2"><input type="number" min={-50} max={300} step={5} aria-label="Growth a month, in percent" className={`${inputCls} w-28`} value={growth} onChange={(e) => setGrowth(Math.min(300, Math.max(-50, Number(e.target.value) || 0)))} /><span className="text-bone/60">%</span></span>
          </Field>
          <Group label="For">
            <span className="flex flex-wrap gap-2">{[1, 3, 6, 12, 24].map((m) => <button key={m} type="button" aria-pressed={months === m} className={choice(months === m)} onClick={() => setMonths(m)}>{m} {m === 1 ? 'month' : 'months'}</button>)}</span>
          </Group>
          <Group label="The voice reads">
            <span className="flex flex-col gap-2">{READS.map(([k, l]) => <button key={k} type="button" aria-pressed={reads === k} className={`${choice(reads === k)} text-left`} onClick={() => setReads(k)}>{l}</button>)}</span>
          </Group>
        </div>
        <div className="min-w-0">
          <p className="caps text-[11px] text-bone/55">Over {months === 1 ? 'a month' : `${months} months`}</p>
          <p className="mt-1.5 text-[46px] font-medium leading-none" data-projected>{dollars(total)}</p>
          <p className="mt-2 text-[14px] text-bone/60">{naira(total) ? `${naira(total)}. ` : ''}{all.toLocaleString()} notes, about {money(all ? total / all : 0)} each{months > 1 ? `; ${dollars(total / months)} a month on average` : ''}.</p>
          <div className="mt-5"><Legend billsNote="the bills and hosting" voiceNote="its ElevenLabs plan" /><StackChart rows={rows} /></div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead><tr className="text-left text-bone/50"><th className="py-1 font-normal">Month</th><th className="py-1 text-right font-normal">Notes</th>{PARTS.map((p) => <th key={p.key} className="py-1 text-right font-normal">{p.label}</th>)}<th className="py-1 text-right font-normal">In all</th></tr></thead>
              <tbody>{rows.map((x) => (
                <tr key={x.month} className="border-t border-bone/10">
                  <td className="py-1.5">{monthName(x.month)}</td><td className="tabular py-1.5 text-right text-bone/80">{x.notes.toLocaleString()}</td>
                  <td className="tabular py-1.5 text-right text-bone/80">{dollars(x.plans)}</td><td className="tabular py-1.5 text-right text-bone/80">{dollars(x.ai)}</td>
                  <td className="tabular py-1.5 text-right text-bone/80">{dollars(x.voice)}{x.plan ? <span className="block text-[11.5px] text-bone/45">{x.plan}</span> : null}</td>
                  <td className="tabular py-1.5 text-right">{dollars(x.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>

      <details className="mt-6 border-t border-bone/10 pt-4">
        <summary className="cursor-pointer text-[15px]">How it’s worked out, and what it assumes</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-snug text-bone/70">
          <li>The AI: {money(u.ai)} a note, {u.aiNotes >= MEASURED ? `what the last ${u.aiNotes.toLocaleString()} notes cost` : `assumed (set below) until Peruzzi has read ${MEASURED} notes`}, at Anthropic’s list prices.</li>
          <li>The voice: {u.note.toLocaleString()} characters a note, Peruzzi’s line and the question ({u.voiceNotes >= MEASURED ? `as the last ${u.voiceNotes.toLocaleString()} notes ran` : 'assumed until 20 notes are in'}), at {u.perChar} credit a character, on whichever ElevenLabs plan below is cheapest for each month. Its fixed lines (“Make some noise!”) are read once and kept, so they’re left out.</li>
          <li>Bills and hosting: the bills set below that don’t grow with traffic, {dollars(bills)} a month (ElevenLabs is priced above instead), and {money(u.hostingPer10k)} more for every 10,000 notes a month as the server and the database grow.</li>
          <li>Not in it yet: email (it starts when the site has a web address of its own; Resend’s free plan covers 3,000 emails a month), and anything the providers change about their prices.</li>
        </ul>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="The AI a note, until measured" hint="In dollars."><input type="number" min={0} step="0.001" aria-label="AI a note" className={inputCls} value={a.aiPerNote} onChange={(e) => setA({ aiPerNote: Number(e.target.value) })} /></Field>
          <Field label="Characters a note" hint="Read aloud. Until measured."><input type="number" min={0} step={10} aria-label="Characters a note" className={inputCls} value={a.charsNote} onChange={(e) => setA({ charsNote: Number(e.target.value) })} /></Field>
          <Field label="Hosting per 10,000 notes a month" hint="In dollars, on top of the bills."><input type="number" min={0} step={1} aria-label="Hosting per 10,000 notes a month" className={inputCls} value={a.hostingPer10k} onChange={(e) => setA({ hostingPer10k: Number(e.target.value) })} /></Field>
        </div>
        <p className="mt-5 text-[14px] text-bone/60">ElevenLabs’ plans, to pick from (as published in 2025: check elevenlabs.io/pricing).</p>
        <div className="mt-2 space-y-2">
          {plans.map((p, i) => {
            const up = (patch: any) => setA({ voicePlans: plans.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="flex gap-2" data-plan>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                  <Labelled t="Plan"><input className={inputCls} value={p.name} onChange={(e) => up({ name: e.target.value })} /></Labelled>
                  <Labelled t="Dollars a month"><input type="number" min={0} className={inputCls} value={p.fee} onChange={(e) => up({ fee: Number(e.target.value) })} /></Labelled>
                  <Labelled t="Credits a month"><input type="number" min={0} step={1000} className={inputCls} value={p.credits} onChange={(e) => up({ credits: Number(e.target.value) })} /></Labelled>
                  <Labelled t="Each 1,000 more"><input type="number" min={0} step="0.01" className={inputCls} value={p.overPer1k} onChange={(e) => up({ overPer1k: Number(e.target.value) })} /></Labelled>
                </div>
                <button type="button" aria-label="Remove the plan" onClick={() => setA({ voicePlans: plans.filter((_, j) => j !== i) })} className="mt-[22px] flex w-10 shrink-0 items-center justify-center border border-bone/15 text-bone/60"><TrashIcon size={16} /></button>
              </div>
            );
          })}
          <button type="button" onClick={() => setA({ voicePlans: [...plans, { name: '', fee: 0, credits: 0, overPer1k: 0 }] })} className="flex min-h-10 items-center gap-2 border border-bone/25 px-4 text-[14.5px]"><PlusIcon size={15} /> Add a plan</button>
        </div>
        <p className="mt-3 text-[13px] text-bone/45">Changes to these assumptions show at once; “Save changes” keeps them.</p>
      </details>
    </div>
  );
}

/** The month's credits against the plan's. */
function VoiceMeter({ v, over }: { v: { chars: number; credits: number; plan: number; perChar: number }; over: number }) {
  const share = v.plan > 0 ? Math.min(1, v.credits / v.plan) : 1;
  return (
    <div>
      <p className="text-[27px] leading-tight">{v.credits.toLocaleString()} <span className="text-[15px] text-bone/55">{v.plan > 0 ? `of ${v.plan.toLocaleString()} credits` : 'credits, paid as they’re used'}</span></p>
      <div className="mt-3 h-2 rounded-full" style={{ background: 'rgba(25,158,112,0.22)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(1, share * 100)}%`, background: VOICE }} /></div>
      <p className="mt-2 text-[13.5px] text-bone/55">{v.chars.toLocaleString()} characters read{v.perChar !== 1 ? ` (${v.perChar} credit each, on the quick model)` : ''}. {over > 0 ? `${money(over)} beyond the plan so far.` : v.plan > 0 ? `${Math.round(share * 100)}% of the plan.` : ''} A line already read in this voice is kept and never paid for twice.</p>
    </div>
  );
}
