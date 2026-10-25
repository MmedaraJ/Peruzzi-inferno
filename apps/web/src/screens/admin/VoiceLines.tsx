import { useEffect, useState } from 'react';
import { ArrowsClockwiseIcon, PlayIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { GallerySound, admin } from '../../lib/api';
import { Section } from './kit';

/** Peruzzi's own recordings of the fixed lines, for "Peruzzi's recorded lines" (Admin → The stage → Who reads). */
export function VoiceLines({ token, status, mode }: { token: string; status: any; mode: string }) {
  const [rows, setRows] = useState<{ key: string; text: string; recorded: string | null }[]>([]);
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = () => admin.voiceLines(token).then(setRows);
  useEffect(() => { load(); }, []);
  return (
    <div>
      <Section title="Peruzzi's recorded lines" note={`Used when the stage's voice is set to “Peruzzi's recorded lines” (now: ${mode.replace('_', ' ')}). MP3, M4A or WAV, a few seconds each. Lines without a recording are read by the MC.`}>
        {!status.voice && <p className="mb-4 border border-[#d9a35b]/40 px-3.5 py-2.5 text-[14px] text-[#ecd2ad]">ElevenLabs isn’t connected yet, so only these recordings can play. Add ELEVENLABS_API_KEY on the server for the MC and Peruzzi’s AI voice.</p>}
        {err && <p className="mb-3 text-[14.5px] text-[#ff9aae]">{err}</p>}
        <div className="divide-y divide-bone/10 border border-bone/10">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><p className="text-[15.5px]">“{r.text}”</p><p className="text-[13px] text-bone/45">{r.recorded ? `Recorded · ${new Date(r.recorded).toLocaleDateString('en-GB')}` : 'Not recorded'}</p></div>
              {r.recorded && <button aria-label="Play" onClick={async () => { const b = await admin.lineAudio(token, r.key); if (b) new Audio(URL.createObjectURL(b)).play(); }} className="flex h-10 w-10 items-center justify-center border border-bone/20"><PlayIcon size={15} /></button>}
              <label className="flex h-10 cursor-pointer items-center gap-2 border border-bone/25 px-3 text-[14px]"><UploadSimpleIcon size={15} />{busy === r.key ? 'Uploading…' : r.recorded ? 'Replace' : 'Upload'}
                <input type="file" accept="audio/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(r.key); setErr(null); try { await admin.uploadLine(token, r.key, f); await load(); } catch (x: any) { setErr(x.message); } finally { setBusy(null); e.target.value = ''; } }} /></label>
              {r.recorded && <button aria-label="Remove" onClick={async () => { if (confirm('Remove this recording?')) { await admin.removeLine(token, r.key); load(); } }} className="flex h-10 w-10 items-center justify-center border border-bone/15 text-bone/60"><TrashIcon size={15} /></button>}
            </div>
          ))}
        </div>
      </Section>
      <CrowdSounds token={token} canMake={!!status.voice} />
    </div>
  );
}

/** The crowd's reactions. With ElevenLabs connected the server makes each one the first time it's needed; here they
 *  can be heard, made again until they sound right, or replaced with a recording. */
function CrowdSounds({ token, canMake }: { token: string; canMake: boolean }) {
  const [rows, setRows] = useState<GallerySound[]>([]);
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { admin.sounds(token).then(setRows).catch(() => {}); }, [token]);
  const run = async (key: string, f: () => Promise<GallerySound[]>) => { setBusy(key); setErr(null); try { setRows(await f()); } catch (x: any) { setErr(x.message); } finally { setBusy(null); } };
  const play = async (key: string) => { const b = await admin.soundAudio(token, key); if (b) new Audio(URL.createObjectURL(b)).play(); };
  const when = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
  return (
    <Section title="The crowd's sounds" note="How the crowd sounds when it reacts. Phones pick up a new one the next time the stage opens.">
      {!canMake && <p className="mb-4 border border-[#d9a35b]/40 px-3.5 py-2.5 text-[14px] text-[#ecd2ad]">With ELEVENLABS_API_KEY on the server, these are made by themselves. Until then, upload your own, or the crowd only murmurs.</p>}
      {err && <p className="mb-3 text-[14.5px] text-[#ff9aae]">{err}</p>}
      <div className="divide-y divide-bone/10 border border-bone/10">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-[180px] flex-1">
              <p className="text-[15.5px]">{r.label}</p>
              <p className="text-[13px] text-bone/45">{r.source === 'made' ? `Made by ElevenLabs · ${when(r.updatedAt)}` : r.source === 'upload' ? `Uploaded · ${when(r.updatedAt)}` : r.failed ? r.problem || 'ElevenLabs couldn’t make it. Check the key and its credits.' : canMake ? 'Made the first time it’s needed' : 'None yet'}</p>
            </div>
            {r.source && <button aria-label={`Play ${r.label}`} onClick={() => play(r.key)} className="flex h-10 w-10 items-center justify-center border border-bone/20"><PlayIcon size={15} /></button>}
            {canMake && <button onClick={() => run(r.key, () => admin.makeSound(token, r.key))} disabled={!!busy} className="flex h-10 items-center gap-2 border border-bone/25 px-3 text-[14px] disabled:opacity-50"><ArrowsClockwiseIcon size={15} />{busy === r.key ? 'Making…' : r.source ? 'Make again' : 'Make now'}</button>}
            <label className="flex h-10 cursor-pointer items-center gap-2 border border-bone/25 px-3 text-[14px]"><UploadSimpleIcon size={15} />{r.source === 'upload' ? 'Replace' : 'Upload'}
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(r.key, () => admin.uploadSound(token, r.key, f)); e.target.value = ''; }} /></label>
            {r.source && <button aria-label={`Remove ${r.label}`} onClick={() => { if (confirm('Remove this sound?')) run(r.key, () => admin.removeSound(token, r.key)); }} className="flex h-10 w-10 items-center justify-center border border-bone/15 text-bone/60"><TrashIcon size={15} /></button>}
          </div>
        ))}
      </div>
    </Section>
  );
}
