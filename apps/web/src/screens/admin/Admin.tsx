import { useEffect, useState } from 'react';
import { admin, ApiError, whenSignedOut } from '../../lib/api';
import { Wordmark } from '../../components/ui';
import { Insights } from './Insights';
import { Notes } from './Notes';
import { StageSettings, SiteSettings } from './Settings';
import { Emails } from './Emails';
import { VoiceLines } from './VoiceLines';
import { People } from './People';
import { Costs } from './Costs';

/** where this tab keeps its session token (only the token: the password is never kept) */
const KEY = 'pa.admin.token';
const TABS = [['insights', 'Insights'], ['costs', 'Costs'], ['notes', 'Notes'], ['stage', 'The stage'], ['site', 'Site'], ['emails', 'Emails'], ['voice', 'Voice'], ['people', 'People']] as const;
type Tab = typeof TABS[number][0];

/** The back office for Peruzzi's team: how it's going, what people wrote, and every setting. */
export default function Admin() {
  const [token, setToken] = useState<string | null>(() => { try { return sessionStorage.getItem(KEY); } catch { return null; } });
  const [tab, setTab] = useState<Tab>(() => (TABS.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) as Tab : 'insights'));
  const [cfg, setCfg] = useState<{ values: any; defaults: any; status: any } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { document.title = 'Admin · Peruzzi Asked'; }, []);
  const signOut = () => { try { sessionStorage.removeItem(KEY); } catch {} setToken(null); };
  // any admin call answered 401 (the session ran out, or the password changed): back to the sign-in form
  useEffect(() => { whenSignedOut(signOut); return () => whenSignedOut(null); }, []);
  useEffect(() => { if (token) admin.config(token).then(setCfg).catch((e: ApiError) => { if (e.status !== 401) setErr(e.message); }); }, [token]);
  useEffect(() => { history.replaceState(null, '', `#${tab}`); }, [tab]);
  if (!token) return <Login onIn={(t) => { try { sessionStorage.setItem(KEY, t); } catch {} setToken(t); }} />;
  const save = async (key: string, value: any) => { const r = await admin.save(token, key, value); setCfg((c) => (c ? { ...c, values: { ...c.values, [key]: r.value } } : c)); return r.value; };
  const reset = async (key: string) => { const r = await admin.reset(token, key); setCfg((c) => (c ? { ...c, values: { ...c.values, [key]: r.value } } : c)); return r.value; };
  return (
    <div className="min-h-dvh bg-[#11100e] text-bone">
      <header className="sticky top-0 z-30 border-b border-bone/10 bg-[#11100e]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3">
          <Wordmark size="sm" className="text-bone" /><p className="display text-[15px] text-bone/45">admin</p>
          <div className="flex-1" />
          <a href="/" target="_blank" className="text-[14px] text-bone/60 underline decoration-bone/25 underline-offset-4">Open the site</a>
          <button className="text-[14px] text-bone/60 underline decoration-bone/25 underline-offset-4" onClick={signOut}>Sign out</button>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-0 pt-2">
          {TABS.map(([k, label]) => <button key={k} onClick={() => setTab(k)} className={`shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-[15px] ${tab === k ? 'border-bone text-bone' : 'border-transparent text-bone/55 hover:text-bone/85'}`}>{label}</button>)}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {cfg && <Status s={cfg.status} />}
        {err && <p className="mb-4 border border-stamp/50 px-3 py-2 text-[#f0c4c4]">{err}</p>}
        {!cfg ? <p className="text-bone/60">Loading…</p> : (
          <>
            {tab === 'insights' && <Insights token={token} />}
            {tab === 'costs' && <Costs token={token} value={cfg.values.costs} voice={cfg.values.stage.voice} onSave={(v) => save('costs', v)} />}
            {tab === 'notes' && <Notes token={token} />}
            {tab === 'stage' && <StageSettings token={token} value={cfg.values.stage} status={cfg.status} onSave={(v) => save('stage', v)} onReset={() => reset('stage')} />}
            {tab === 'site' && <SiteSettings site={cfg.values.site} onSave={save} onReset={reset} />}
            {tab === 'emails' && <Emails token={token} value={cfg.values.emails} onSave={(v) => save('emails', v)} onReset={() => reset('emails')} />}
            {tab === 'voice' && <VoiceLines token={token} status={cfg.status} mode={cfg.values.stage.voice.mode} />}
            {tab === 'people' && <People token={token} />}
          </>
        )}
      </main>
    </div>
  );
}

function Login({ onIn }: { onIn: (token: string) => void }) {
  const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); setErr(''); try { onIn((await admin.login(p)).token); } catch (e) { setErr((e as ApiError).status === 401 ? 'That password isn’t right.' : (e as ApiError).message); } finally { setBusy(false); } };
  return (
    <div className="concrete flex min-h-dvh items-center justify-center px-6">
      <form className="w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div className="flex justify-center"><Wordmark size="lg" className="text-bone" /></div>
        <p className="caps mt-1 text-center text-[11px] text-bone/55">Admin</p>
        <input type="password" autoFocus value={p} onChange={(e) => setP(e.target.value)} placeholder="Password" className="mt-8 min-h-12 w-full border border-bone/25 bg-black/30 px-3.5 text-[17px] focus:border-bone/60 focus:outline-none" />
        {err && <p className="mt-2 text-[14.5px] text-[#e7a3a3]">{err}</p>}
        <button disabled={busy || !p} className="mt-4 min-h-12 w-full bg-bone font-semibold text-ink disabled:opacity-40">{busy ? 'Checking…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function Status({ s }: { s: any }) {
  const dot = (ok: boolean) => <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-[#8fbf8f]' : 'bg-[#d9a35b]'}`} />;
  return (
    <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2 border border-bone/10 bg-white/[0.02] px-4 py-3 text-[13.5px] text-bone/70">
      <span className="flex items-center gap-2">{dot(s.ai)} Peruzzi’s lines: {s.ai ? `${s.model} (effort ${s.effort})` : 'no AI key, so prepared lines only'}</span>
      <span className="flex items-center gap-2">{dot(s.voice)} Voice: {s.voice ? 'ElevenLabs connected' : 'not connected (needs ELEVENLABS_API_KEY)'}</span>
      <span className="flex items-center gap-2">{dot(s.email)} Email: {s.email ? `sending as ${s.from}` : s.resendKey ? 'off until MAIL_FROM is an address on a domain verified in Resend (the email options stay hidden)' : 'not connected (emails are logged, not sent)'}</span>
    </div>
  );
}
