import { useEffect, useState } from 'react';
import { admin } from '../../lib/api';
import { Field, inputCls, SaveBar, Section, Text } from './kit';

const KINDS: [string, string, string][] = [
  ['ask', 'The note', 'To the person a note is for, when the writer has it emailed. {sender} {recipient} {senderMask} {site} {artist} {song}'],
  ['answered', 'They answered', 'To the writer of an emailed note, once it’s ticked. {sender} {recipient} {site} {artist} {song}'],
  ['tracklist', 'The tracklist', 'To the writer, when they ask for their tracklist. {name} {site} {artist} {song}'],
  ['code', 'Confirmation code', 'Sent before anyone can email a note, to prove the address. {code} {site}'],
];

/** The words of each email. The note itself, the buttons' links and the opt-out are added around them. */
export function Emails({ token, value, onSave, onReset }: { token: string; value: any; onSave: (v: any) => Promise<any>; onReset: () => Promise<any> }) {
  const [d, setD] = useState<any>(value); useEffect(() => setD(value), [JSON.stringify(value)]);
  const dirty = JSON.stringify(d) !== JSON.stringify(value);
  const [to, setTo] = useState(''); const [preview, setPreview] = useState<{ kind: string; html: string; note: string } | null>(null);
  const set = (k: string, patch: any) => setD((x: any) => ({ ...x, [k]: { ...x[k], ...patch } }));
  return (
    <div>
      {KINDS.map(([k, title, note]) => (
        <Section key={k} title={title} note={note} right={
          <button onClick={async () => { if (dirty) await onSave(d); const r = await admin.testEmail(token, k, to.trim() || 'test@example.com'); setPreview({ kind: k, html: r.html, note: r.dryRun ? 'Not sent: no email service connected yet. This is how it looks.' : `Sent to ${to.trim()}.` }); }}
            className="shrink-0 border border-bone/25 px-3 py-1.5 text-[14px]">Preview{to.trim() ? ' and send' : ''}</button>}>
          <div className="space-y-3">
            <Field label="Subject"><Text value={d[k].subject} onChange={(subject) => set(k, { subject })} /></Field>
            <Field label="Message" hint="A blank line starts a new paragraph"><Text area rows={6} value={d[k].body} onChange={(body) => set(k, { body })} /></Field>
            {k !== 'code' && <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Main button"><Text value={d[k].cta} onChange={(cta) => set(k, { cta })} /></Field>
              <Field label="Second button"><Text value={d[k].cta2 || ''} onChange={(cta2) => set(k, { cta2 })} /></Field>
              <Field label="Third button"><Text value={d[k].cta3 || ''} onChange={(cta3) => set(k, { cta3 })} /></Field>
            </div>}
            <Field label="Small print"><Text value={d[k].footer} onChange={(footer) => set(k, { footer })} /></Field>
          </div>
          {preview?.kind === k && <div className="mt-4"><p className="mb-2 text-[14px] text-bone/65">{preview.note}</p><iframe title="Preview" sandbox="" srcDoc={preview.html} className="h-[560px] w-full max-w-[560px] border border-bone/15 bg-white" /></div>}
        </Section>
      ))}
      <Section title="Send previews to" note="Your own address, to see them in a real inbox">
        <input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" />
      </Section>
      <SaveBar dirty={dirty} onSave={() => onSave(d)} onReset={onReset} />
    </div>
  );
}
