import { useEffect, useState } from 'react';
import { EnvelopeSimpleIcon, LinkIcon, WhatsappLogoIcon } from '@phosphor-icons/react';
import { ApiError, NoteInfo, api } from '../../lib/api';
import { Button, Label } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { deviceId, store } from '../../lib/store';
import { copy } from '../../lib/share';
import { track } from '../../lib/track';

type Step = 'names' | 'how' | 'email' | 'code' | 'sent';
const field = 'mt-2 min-h-12 w-full border border-bone/20 bg-black/30 px-3.5 text-[17px] text-bone placeholder:text-bone/35 focus:border-bone/60 focus:outline-none';
const mask = (e: string) => { const [u, d] = e.split('@'); return `${u.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(5, u.length - 1)))}@${d}`; };   // as the email shows it

/** Sending a note to the person it's for: a WhatsApp link the writer sends themselves, or an email the site sends for
 *  them once they've confirmed their own address. The link is the key: whoever opens it can tick the answer. */
export function SendSheet({ open, onClose, notebook, note, nameplate, defaultName, onName, onSent, email }: {
  open: boolean; onClose: () => void; notebook: { id: string; token: string }; note: NoteInfo; nameplate: string;
  defaultName: string; onName: (n: string) => void; onSent: () => void; email: boolean;
}) {
  const [step, setStep] = useState<Step>('names');
  const [from, setFrom] = useState(defaultName); const [to, setTo] = useState(note.dear);
  const [link, setLink] = useState<string | null>(null);
  const [mine, setMine] = useState(store.sender()?.email || store.email() || ''); const [code, setCode] = useState(''); const [theirs, setTheirs] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  // fresh each time it opens, and only then: Continue saves the writer's name, which mustn't send the sheet back to the start
  useEffect(() => { if (open) { setStep('names'); setErr(null); setMsg(null); setLink(null); setFrom(defaultName); setTo(note.dear); track('note_send_open'); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  const short = note.dear.length <= 14 ? note.dear : 'them';
  const text = (url: string) => `${to.trim() || note.dear}, ${nameplate} asked you something. It’s from ${from.trim() || 'someone'}, and only you can answer it: ${url}`;
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
          <p className="mt-3 text-[14px] leading-snug text-bone/55">They’ll see your note and {nameplate}’s line, and tick Yes, No or the third box. One tick, and it comes back to you.</p>
          {err && <p className="mt-3 text-[14.5px] text-[#e7a3a3]">{err}</p>}
          <Button className="mt-5 w-full" disabled={busy || from.trim().length < 2} onClick={() => run(async () => {
            const r = await api.sendLink(note.id, notebook.token, from.trim(), to.trim() || undefined); setLink(r.url); onName(from.trim()); store.setName(from.trim()); onSent(); setStep('how');
          })}>{busy ? 'One moment…' : 'Continue'}</Button>
        </div>
      )}
      {step === 'how' && link && (
        <div className="mt-5 flex flex-col gap-2.5">
          <a href={`https://wa.me/?text=${encodeURIComponent(text(link))}`} target="_blank" rel="noreferrer" onClick={() => track('note_share', { via: 'whatsapp' })}
            className="flex min-h-[54px] items-center justify-center gap-2.5 bg-bone text-[17px] font-semibold text-ink"><WhatsappLogoIcon size={22} weight="fill" /> Send on WhatsApp</a>
          <button onClick={() => run(async () => {
            if (navigator.share) { try { await navigator.share({ text: text(link) }); track('note_share', { via: 'link' }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
            if (await copy(text(link))) { setMsg('Copied. Paste it to them anywhere.'); track('note_share', { via: 'copy' }); }
          })} className="flex min-h-[54px] items-center justify-center gap-2.5 border border-bone/30 text-[17px]"><LinkIcon size={20} /> Share the link</button>
          {email && <button onClick={() => setStep('email')} className="flex min-h-[54px] items-center justify-center gap-2.5 border border-bone/30 text-[17px]"><EnvelopeSimpleIcon size={20} /> Have it emailed</button>}
          {msg && <p className="text-center text-[14.5px] text-bone/70">{msg}</p>}
          {err && <p className="text-[14.5px] text-[#e7a3a3]">{err}</p>}
          <p className="mt-1 text-center text-[13.5px] leading-snug text-bone/50">You’ll see here when they open it, and what they tick.</p>
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
            <p className="mt-2 text-[13.5px] leading-snug text-bone/50">We send one email and keep no copy of their address. It comes with a way to never be sent a note again. When they answer, you’ll get an email too.</p>
          </>}
          {err && <p className="mt-3 text-[14.5px] text-[#e7a3a3]">{err}</p>}
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
          {err && <p className="mt-3 text-[14.5px] text-[#e7a3a3]">{err}</p>}
          <Button className="mt-5 w-full" disabled={busy || code.length !== 6} onClick={() => run(async () => {
            const r = await api.verify(mine.trim(), code, deviceId(), from.trim()); store.setSender({ email: r.email, token: r.contactToken }); setStep('email');
          })}>{busy ? 'Checking…' : 'Confirm'}</Button>
          <Button kind="quiet" className="mt-2 w-full" onClick={() => run(async () => { await api.sendCode(mine.trim(), deviceId()); setMsg('Sent again.'); })}>Send it again</Button>
          {msg && <p className="text-center text-[14px] text-bone/60">{msg}</p>}
        </div>
      )}
      {step === 'sent' && (
        <div className="mt-4">
          <p className="text-[18px] leading-relaxed text-bone/90">Delivered. {to.trim() || note.dear} gets your note, and the three boxes to tick.</p>
          {msg && <p className="mt-2 text-[14.5px] text-bone/60">{msg}</p>}
          <Button className="mt-6 w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </Sheet>
  );
}
