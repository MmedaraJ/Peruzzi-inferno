import { useEffect, useState } from 'react';
import { EnvelopeSimpleIcon, LinkIcon, ShareNetworkIcon, WhatsappLogoIcon } from '@phosphor-icons/react';
import { ApiError, NoteInfo, api } from '../../lib/api';
import { Button, Label } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { deviceId, store } from '../../lib/store';
import { copy, shareFile } from '../../lib/share';
import { sound } from '../../lib/sound';
import { track } from '../../lib/track';

type Step = 'names' | 'how' | 'email' | 'code' | 'sent';
const field = 'mt-2 min-h-12 w-full rounded-lg border border-bone/20 bg-black/30 px-3.5 text-[17px] text-bone placeholder:text-bone/35 focus:border-bone/60 focus:outline-none';
const mask = (e: string) => { const [u, d] = e.split('@'); return `${u.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(5, u.length - 1)))}@${d}`; };   // as the email shows it

/** Sending a note to the person it's for: the note's card and its link through the phone's share sheet (or a WhatsApp
 *  message, or the link copied), all sent by the writer themselves, or an email the site sends for them once they've
 *  confirmed their own address. The link is the key: whoever has it can open the note, and write one back. It's made
 *  on the address this page is on, so it opens wherever the site does. */
export function SendSheet({ open, onClose, notebook, note, card, nameplate, defaultName, onName, onSent, email }: {
  open: boolean; onClose: () => void; notebook: { id: string; token: string }; note: NoteInfo;
  /** the note's story card, once it's drawn (it goes with the link) */
  card: () => File | null;
  nameplate: string; defaultName: string; onName: (n: string) => void; onSent: () => void; email: boolean;
}) {
  const [step, setStep] = useState<Step>('names');
  const [from, setFrom] = useState(defaultName); const [to, setTo] = useState(note.dear);
  const [link, setLink] = useState<string | null>(null);
  const [mine, setMine] = useState(store.sender()?.email || store.email() || ''); const [code, setCode] = useState(''); const [theirs, setTheirs] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  // fresh each time it opens, and only then: Continue saves the writer's name, which mustn't send the sheet back to the start
  useEffect(() => { if (open) { setStep('names'); setErr(null); setMsg(null); setLink(null); setFrom(defaultName); setTo(note.dear); track('note_send_open'); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  const short = note.dear.length <= 14 ? note.dear : 'them';
  const words = () => `${to.trim() || note.dear}, ${from.trim() || 'someone'} wrote you a note, and ${nameplate} is asking it for them.`;
  const text = (url: string) => `${words()} Open it: ${url}`;
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(null); try { await f(); } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); } };
  const verified = () => { const s = store.sender(); return s && s.email.toLowerCase() === mine.trim().toLowerCase() ? s : null; };

  return (
    <Sheet open={open} onClose={onClose} label="Send the note">
      <div className="pr-8">
        <p className="caps text-[11px] text-bone/55">Let {nameplate} ask</p>
        <h2 className="display mt-1.5 text-[28px] leading-tight">send it to {short}</h2>
      </div>
      {step === 'names' && (
        <div className="mt-4">
          <Label>From</Label>
          <input className={field} value={from} onChange={(e) => setFrom(e.target.value.slice(0, 24))} placeholder="Your first name" autoComplete="given-name" />
          <Label className="mt-4">To</Label>
          <input className={field} value={to} onChange={(e) => setTo(e.target.value.slice(0, 24))} placeholder="Their first name" />
          <p className="mt-3 text-[14px] leading-snug text-bone/55">They’ll open your note on the stage, with {nameplate}’s question on it, and can write you one back.</p>
          {err && <p className="mt-3 text-[14.5px] text-petal">{err}</p>}
          <Button className="mt-5 w-full" disabled={busy || from.trim().length < 2} onClick={() => run(async () => {
            const r = await api.sendLink(note.id, notebook.token, from.trim(), to.trim() || undefined); setLink(`${location.origin}/a/${r.code}`); onName(from.trim()); store.setName(from.trim()); onSent(); setStep('how');
          })}>{busy ? 'One moment…' : 'Continue'}</Button>
        </div>
      )}
      {step === 'how' && link && (
        <div className="mt-5 flex flex-col gap-2.5">
          {/* the card and the link together, through the phone's share sheet (just the link where it can't take a picture) */}
          <button onClick={async () => {
            sound.keepThrough(); const r = await shareFile(card(), words(), link);
            track('note_share', { via: 'native', how: r }); if (r === 'copied') setMsg('Copied. Paste it to them anywhere.');
          }} className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl bg-rose text-[17px] font-semibold text-white transition-colors hover:bg-rose-deep"><ShareNetworkIcon size={21} weight="bold" /> Send it with the card</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(text(link))}`} target="_blank" rel="noreferrer" onClick={() => track('note_share', { via: 'whatsapp' })}
            className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl border border-bone/30 text-[17px] hover:border-blush/60"><WhatsappLogoIcon size={22} weight="fill" /> Send on WhatsApp</a>
          <button onClick={async () => { if (await copy(text(link))) { setMsg('Copied. Paste it to them anywhere.'); track('note_share', { via: 'copy' }); } }}
            className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl border border-bone/30 text-[17px] hover:border-blush/60"><LinkIcon size={20} /> Copy the link</button>
          {email && <button onClick={() => setStep('email')} className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl border border-bone/30 text-[17px] hover:border-blush/60"><EnvelopeSimpleIcon size={20} /> Have it emailed</button>}
          {msg && <p className="text-center text-[14.5px] text-bone/70">{msg}</p>}
          {err && <p className="text-[14.5px] text-petal">{err}</p>}
          <p className="mt-1 text-center text-[13.5px] leading-snug text-bone/50">You’ll see here when they open it, and when they write you back.</p>
        </div>
      )}
      {step === 'email' && (
        <div className="mt-4">
          <Label>Your email</Label>
          <input className={field} type="email" inputMode="email" autoComplete="email" value={mine} onChange={(e) => setMine(e.target.value)} placeholder="you@example.com" />
          {verified() ? <p className="mt-2 text-[14px] text-bone/60">Confirmed. It will say it’s from {from.trim()} ({mask(mine.trim())}).</p>
            : <p className="mt-2 text-[14px] text-bone/55">We confirm your address first, so nobody can send notes in your name.</p>}
          {verified() && <>
            <Label className="mt-4">Their email</Label>
            <input className={field} type="email" inputMode="email" value={theirs} onChange={(e) => setTheirs(e.target.value)} placeholder="them@example.com" />
            <p className="mt-2 text-[13.5px] leading-snug text-bone/50">We send one email and keep no copy of their address. It comes with a way to never be sent a note again.</p>
          </>}
          {err && <p className="mt-3 text-[14.5px] text-petal">{err}</p>}
          {verified()
            ? <Button className="mt-5 w-full" disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(theirs.trim())} onClick={() => run(async () => {
                const s = verified()!; const r = await api.sendEmail(note.id, notebook.token, { contactToken: s.token, senderName: from.trim(), recipientEmail: theirs.trim(), recipientName: to.trim() || undefined });
                setMsg(r.left > 0 ? `You can email ${r.left} more today.` : 'That’s your last emailed note for today.'); onSent(); setStep('sent'); track('note_share', { via: 'email' });
              })}>{busy ? 'Sending…' : 'Send the note'}</Button>
            : <Button className="mt-5 w-full" disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mine.trim())} onClick={() => run(async () => { await api.sendCode(mine.trim(), deviceId()); setCode(''); setStep('code'); })}>{busy ? 'Sending…' : 'Send me a code'}</Button>}
          <Button kind="quiet" className="mt-2 w-full" onClick={() => setStep('how')}>Back</Button>
        </div>
      )}
      {step === 'code' && (
        <div className="mt-4">
          <p className="text-[16px] text-bone/80">We sent a code to <span className="text-bone">{mine.trim()}</span>.</p>
          <Label className="mt-4">The code</Label>
          <input className={`${field} tabular tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
          {err && <p className="mt-3 text-[14.5px] text-petal">{err}</p>}
          <Button className="mt-5 w-full" disabled={busy || code.length !== 6} onClick={() => run(async () => {
            const r = await api.verify(mine.trim(), code, deviceId(), from.trim()); store.setSender({ email: r.email, token: r.contactToken }); setStep('email');
          })}>{busy ? 'Checking…' : 'Confirm'}</Button>
          <Button kind="quiet" className="mt-2 w-full" onClick={() => run(async () => { await api.sendCode(mine.trim(), deviceId()); setMsg('Sent again.'); })}>Send it again</Button>
          {msg && <p className="text-center text-[14px] text-bone/60">{msg}</p>}
        </div>
      )}
      {step === 'sent' && (
        <div className="mt-4">
          <p className="text-[18px] leading-relaxed text-bone/90">Delivered. {to.trim() || note.dear} gets your note by email, and can write you one back.</p>
          {msg && <p className="mt-2 text-[14.5px] text-bone/60">{msg}</p>}
          <Button className="mt-6 w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </Sheet>
  );
}
