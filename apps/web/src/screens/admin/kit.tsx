import { ReactNode, useEffect, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';

/** A page's settings as they're being edited, and whether they differ from what's saved. */
export function useDraft<T>(value: T) {
  const [d, setD] = useState<T>(value);
  useEffect(() => setD(value), [JSON.stringify(value)]);
  return [d, setD, JSON.stringify(d) !== JSON.stringify(value)] as const;
}

/** The admin's form pieces: plain, legible, consistent. */
export function Section({ title, note, children, right }: { title: string; note?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-6 border border-bone/10 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-start gap-3"><div className="flex-1"><h2 className="text-[19px] font-medium">{title}</h2>{note && <p className="mt-0.5 text-[14px] text-bone/55">{note}</p>}</div>{right}</div>
      {children}
    </section>
  );
}
export const inputCls = 'min-h-11 w-full border border-bone/20 bg-black/30 px-3 text-[15.5px] text-bone placeholder:text-bone/30 focus:border-bone/60 focus:outline-none';
/** A setting with its name over it. One that's a set of buttons (`group`) isn't a <label>: a label passes a click
 *  anywhere on it (its hint, say) to the first button. */
export function Field({ label, hint, group = false, children }: { label: string; hint?: string; group?: boolean; children: ReactNode }) {
  const inner = <><span className="caps block text-[10.5px] text-bone/55">{label}</span><div className="mt-1.5">{children}</div>{hint && <span className="mt-1 block text-[13px] text-bone/45">{hint}</span>}</>;
  return group ? <div role="group" aria-label={label} className="block">{inner}</div> : <label className="block">{inner}</label>;
}
export function Text({ value, onChange, placeholder, area, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; area?: boolean; rows?: number }) {
  return area ? <textarea rows={rows} className={`${inputCls} py-2 leading-snug`} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    : <input className={inputCls} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
export function Num({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return <input type="number" className={`${inputCls} tabular w-28`} value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />;
}
export function Toggle({ on, onChange, label, note }: { on: boolean; onChange: (v: boolean) => void; label: string; note?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-start gap-3 text-left">
      <span className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-bone' : 'bg-bone/20'}`}><span className={`h-5 w-5 rounded-full transition-transform ${on ? 'translate-x-5 bg-ink' : 'bg-bone/70'}`} /></span>
      <span><span className="block text-[15.5px]">{label}</span>{note && <span className="block text-[13.5px] text-bone/50">{note}</span>}</span>
    </button>
  );
}
export function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string, string?][]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(([v, label, note]) => (
        <button type="button" key={v} onClick={() => onChange(v)} className={`border px-3.5 py-2.5 text-left ${value === v ? 'border-bone bg-bone/[0.08]' : 'border-bone/15 hover:border-bone/35'}`}>
          <span className="block text-[15.5px]">{label}</span>{note && <span className="block text-[13px] leading-snug text-bone/50">{note}</span>}
        </button>
      ))}
    </div>
  );
}
/** A list of short strings. */
export function StringList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [add, setAdd] = useState('');
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input className={inputCls} value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <Move i={i} n={items.length} onMove={(a, b) => { const c = items.slice(); [c[a], c[b]] = [c[b], c[a]]; onChange(c); }} />
          <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} className="flex w-11 shrink-0 items-center justify-center border border-bone/15 text-bone/60 hover:text-bone"><TrashIcon size={16} /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <input className={inputCls} value={add} placeholder={placeholder || 'Add one'} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && add.trim()) { e.preventDefault(); onChange([...items, add.trim()]); setAdd(''); } }} />
        <button type="button" aria-label="Add" disabled={!add.trim()} onClick={() => { onChange([...items, add.trim()]); setAdd(''); }} className="flex w-11 shrink-0 items-center justify-center border border-bone/25 disabled:opacity-30"><PlusIcon size={16} /></button>
      </div>
    </div>
  );
}
export function Move({ i, n, onMove }: { i: number; n: number; onMove: (a: number, b: number) => void }) {
  return (
    <div className="flex shrink-0 flex-col">
      <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => onMove(i, i - 1)} className="flex h-[22px] w-8 items-center justify-center border border-bone/15 text-bone/60 disabled:opacity-25"><ArrowUpIcon size={12} /></button>
      <button type="button" aria-label="Move down" disabled={i === n - 1} onClick={() => onMove(i, i + 1)} className="flex h-[22px] w-8 items-center justify-center border border-t-0 border-bone/15 text-bone/60 disabled:opacity-25"><ArrowDownIcon size={12} /></button>
    </div>
  );
}
/** Save and reset, with what happened. */
export function SaveBar({ dirty, onSave, onReset, saved }: { dirty: boolean; onSave: () => Promise<any>; onReset?: () => Promise<any>; saved?: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  const run = async (f: () => Promise<any>, done: string) => { setState('saving'); try { await f(); setState(done); window.setTimeout(() => setState('idle'), 2500); } catch (e: any) { setState(e?.message || 'Couldn’t save.'); } };
  return (
    <div className="dock-bottom sticky bottom-0 z-20 -mx-4 mt-2 flex items-center gap-3 border-t border-bone/10 bg-[#11100e]/95 px-4 py-3 backdrop-blur [--dock-bg:#11100e]">
      <button disabled={!dirty || state === 'saving'} onClick={() => run(onSave, saved || 'Saved. Live within 15 seconds.')} className="min-h-11 bg-bone px-5 font-semibold text-ink disabled:opacity-35">{state === 'saving' ? 'Saving…' : 'Save changes'}</button>
      {onReset && <button onClick={() => { if (confirm('Put every setting on this page back to the default?')) run(onReset, 'Back to the defaults.'); }} className="text-[14px] text-bone/55 underline decoration-bone/25 underline-offset-4">Reset to defaults</button>}
      <span className="text-[14px] text-bone/65">{state !== 'idle' && state !== 'saving' ? state : dirty ? 'Unsaved changes' : ''}</span>
    </div>
  );
}
export const ago = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
