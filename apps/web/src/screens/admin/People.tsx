import { useEffect, useState } from 'react';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import { admin } from '../../lib/api';
import { ago, Section } from './kit';

/** Who gave an email (and whether they said yes to Peruzzi's news), and the notes sent to people. */
export function People({ token }: { token: string }) {
  const [c, setC] = useState<any>(null); const [s, setS] = useState<any[]>([]);
  useEffect(() => { admin.contacts(token).then(setC); admin.asks(token).then(setS); }, []);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Emails" note={c ? `${c.total.toLocaleString()} in all · ${c.news.toLocaleString()} said yes to news from Peruzzi` : ''}
        right={<button onClick={async () => { const b = await admin.contactsCsv(token); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'peruzzi-asks-contacts.csv'; a.click(); }} className="flex shrink-0 items-center gap-2 border border-bone/25 px-3 py-1.5 text-[14px]"><DownloadSimpleIcon size={15} /> CSV</button>}>
        <p className="mb-3 text-[13.5px] text-bone/50">Only those who said yes to news can be emailed about Peruzzi. Everyone else gave their address for one thing: their tracklist, or sending a note.</p>
        <div className="divide-y divide-bone/10 border border-bone/10">
          {c?.rows.map((r: any) => (
            <div key={r.email} className="flex items-center gap-3 px-3.5 py-2.5 text-[14.5px]">
              <span className="min-w-0 flex-1 truncate">{r.email}{r.name ? <span className="text-bone/45"> · {r.name}</span> : null}</span>
              <span className="shrink-0 text-[12.5px] text-bone/45">{[r.source, r.verified && 'confirmed', r.unsubscribed && 'unsubscribed'].filter(Boolean).join(' · ')}</span>
              <span className={`caps shrink-0 text-[10px] ${r.marketing ? 'text-[#a9cfa9]' : 'text-bone/35'}`}>{r.marketing ? 'News: yes' : 'News: no'}</span>
            </div>
          ))}
          {c && !c.rows.length && <p className="px-3.5 py-4 text-bone/50">None yet.</p>}
        </div>
      </Section>
      <Section title="Notes sent to people" note="Addresses are kept masked; the full address isn't stored">
        <div className="divide-y divide-bone/10 border border-bone/10">
          {s.map((r) => (
            <div key={r.code} className="px-3.5 py-2.5 text-[14.5px]">
              <p className="truncate">{r.senderName} → {r.recipientName || r.recipientMask || r.dear} <span className="text-bone/45">· note {r.noteNo} · {r.title}</span></p>
              <p className="text-[12.5px] text-bone/45">{[r.channel === 'email' ? `emailed (${r.status})` : 'link', r.openedAt && 'opened', r.answer && `ticked ${r.answer === 'escape' ? 'the third box' : r.answer}`, r.backAt && 'written back', ago(r.createdAt)].filter(Boolean).join(' · ')}</p>
            </div>
          ))}
          {!s.length && <p className="px-3.5 py-4 text-bone/50">None yet.</p>}
        </div>
      </Section>
    </div>
  );
}
