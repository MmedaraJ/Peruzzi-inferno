import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DownloadSimpleIcon, LinkIcon, ShareNetworkIcon } from '@phosphor-icons/react';
import { Notebook, StageConfig, api } from '../../lib/api';
import { toBlob, tracklistCard } from '../../lib/cards';
import { copy, saveFile, shareFile } from '../../lib/share';
import { sound } from '../../lib/sound';
import { store } from '../../lib/store';
import { track } from '../../lib/track';
import { Button, Label } from '../../components/ui';
import { TopBar } from '../../components/TopBar';
import { ListenButton } from '../../components/Listen';

const field = 'min-h-12 w-full rounded-lg border border-bone/20 bg-black/30 px-3.5 text-[17px] text-bone placeholder:text-bone/35 focus:border-bone/60 focus:outline-none';
export const tracklistTitle = (name: string | null | undefined) => (name?.trim() ? `${name.trim()}’s tracklist` : 'Your tracklist');

/** The tracklist: every note so far as a track on an album's back cover, with a name and a city, and a card to post.
 *  It's there from the first note and grows with each one after: getting it doesn't close anything. */
export function Tracklist({ cfg, notebook, token, onUpdate, onWrite, onBack }: {
  cfg: StageConfig; notebook: Notebook; token: string; onUpdate: (d: Notebook) => void; onWrite: (() => void) | null; onBack: () => void;
}) {
  const asked = useMemo(() => notebook.notes.filter((k) => k.status !== 'serious' && k.kind), [notebook.notes]);
  const [name, setName] = useState(notebook.name || store.name() || '');
  const [city, setCity] = useState(notebook.city || '');
  const [card, setCard] = useState<{ url: string; file: File } | null>(null);
  const [email, setEmail] = useState(store.email() || ''); const [news, setNews] = useState(store.newsOk());
  const [mail, setMail] = useState<'idle' | 'sending' | 'sent' | string>('idle'); const [msg, setMsg] = useState<string | null>(null);
  const url = `${location.origin}/t/${notebook.code}`;
  const uploaded = useRef('');

  // the first time it's opened, the tracklist counts as made, and this phone keeps a link to it
  useEffect(() => {
    track('tracklist_view');
    api.updateNotebook(notebook.id, token, { tracklist: true }).then((d) => { onUpdate(d); store.addTracklist({ code: d.code, title: tracklistTitle(d.name) }); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw the card whenever what's on it changes (after a short pause while typing)
  useEffect(() => {
    let gone = false;
    const t = window.setTimeout(async () => {
      const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      const meta = [`${asked.length} ${asked.length === 1 ? 'note' : 'notes'}`, city.trim(), date].filter(Boolean).join(' · ');
      const data = { name: name.trim() ? `${name.trim()}’s tracklist` : 'My tracklist', meta, notes: [...asked].reverse().map((k) => ({ noteNo: k.noteNo, title: k.title, dear: k.dear })), site: location.host, song: cfg.song, artist: cfg.artist, nameplate: cfg.nameplate };
      const story = await tracklistCard(data, 'story'); if (gone) return;
      const blob = await toBlob(story, 0.9); const file = new File([blob], `peruzzi-asks-tracklist-${notebook.code}.jpg`, { type: 'image/jpeg' });
      setCard((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), file }; });
      // the square goes up for the link preview, and the tracklist keeps the name and city
      const key = JSON.stringify([name, city, asked.length]);
      if (uploaded.current !== key) {
        uploaded.current = key;
        api.updateNotebook(notebook.id, token, { name: name.trim(), city: city.trim() }).then(onUpdate).catch(() => {});
        tracklistCard(data, 'square').then((sq) => toBlob(sq, 0.86)).then((b) => api.saveCard('notebook', notebook.id, token, b)).catch(() => {});
      }
    }, card ? 450 : 0);
    return () => { gone = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, city, asked.length]);

  const sendMail = async () => {
    const e = email.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { setMail('That email doesn’t look right.'); return; }
    setMail('sending');
    try { await api.emailTracklist(notebook.id, token, e, news); store.setEmail(e); store.setNewsOk(news); setMail('sent'); }
    catch (err: any) { setMail(err.message || 'We couldn’t send it. Try again.'); }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <TopBar onBack={onBack} backLabel="Back to your notes" left={<span className="caps text-[11px] text-bone/70">Your tracklist</span>} />
      <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <h1 className="display mt-3 text-[34px] leading-tight">{tracklistTitle(name)}</h1>
        <p className="mt-1.5 text-[15.5px] text-bone/60">Every note you write is a track: {asked.length} so far, each titled by {cfg.nameplate}.</p>

        <div className="mt-6 flex justify-center">
          <motion.div className="relative w-[64%] max-w-[270px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)]" style={{ aspectRatio: '9 / 16' }} initial={{ opacity: 0, y: 16, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.6 }}>
            {card ? <img src={card.url} alt="Your tracklist card" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-stone" />}
          </motion.div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button disabled={!card} onClick={async () => { if (!card) return; sound.keepThrough(); const r = await saveFile(card.file); track('tracklist_save', { how: r }); }} className="flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl border border-bone/25 text-[12.5px] disabled:opacity-40"><DownloadSimpleIcon size={19} />Save</button>
          <button disabled={!card} onClick={async () => { sound.keepThrough(); const r = await shareFile(card?.file || null, `My tracklist from ${cfg.nameplate} Asks. Who’s on your mind?`, url); track('tracklist_share', { how: r }); if (r === 'copied') setMsg('Link copied.'); }} className="flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl bg-rose text-[12.5px] font-semibold text-white transition-colors hover:bg-rose-deep disabled:opacity-40"><ShareNetworkIcon size={19} />Share</button>
          <button onClick={async () => { if (await copy(url)) setMsg('Link copied.'); }} className="flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl border border-bone/25 text-[12.5px]"><LinkIcon size={19} />Copy link</button>
        </div>
        {msg && <p className="mt-2 text-center text-[14px] text-bone/65">{msg}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div><Label>Your first name</Label><input className={`${field} mt-2`} value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="Your name" /></div>
          <div><Label>City (optional)</Label><input className={`${field} mt-2`} value={city} onChange={(e) => setCity(e.target.value.slice(0, 24))} placeholder="Lagos" /></div>
        </div>

        {cfg.email && (
        <div className="mt-8 border-t border-bone/10 pt-6">
          <Label>Email me my tracklist</Label>
          {mail === 'sent' ? <p className="mt-2 text-[16px] text-bone/80">Sent to {email.trim()}. Check your inbox.</p> : (
            <>
              <div className="mt-2 flex gap-2">
                <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setMail('idle'); }} placeholder="you@example.com" className={`${field} flex-1`} />
                <Button kind="ghost" className="!min-h-12 !px-4" disabled={mail === 'sending'} onClick={sendMail}>{mail === 'sending' ? '…' : 'Send'}</Button>
              </div>
              <label className="mt-3 flex items-start gap-3 text-[14.5px] leading-snug text-bone/70">
                <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c86272]" />
                Also send me news from {cfg.artist}. Unsubscribe any time.
              </label>
              {mail !== 'idle' && mail !== 'sending' && <p className="mt-2 text-[14px] text-petal">{mail}</p>}
            </>
          )}
        </div>
        )}
        <div className="mt-8 flex flex-col gap-2.5">
          <ListenButton href={cfg.smartLink} from="tracklist" kicker={`The song · ${cfg.artist}`} label={`Listen to ${cfg.song}`} />
          {onWrite ? <Button kind="ghost" onClick={onWrite}>Write another note</Button> : <p className="text-center text-[14.5px] text-bone/55">That’s your notes for today. Peruzzi will ask again tomorrow.</p>}
        </div>
      </div>
    </div>
  );
}
