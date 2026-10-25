import { useState } from 'react';
import { PlayIcon } from '@phosphor-icons/react';
import { admin } from '../../lib/api';
import { Choice, Field, Num, SaveBar, Section, Text, Toggle, useDraft } from './kit';

/** Everything about the stage: open or paused, its voice, Peruzzi's humour, the limits. */
export function StageSettings({ token, value, status, onSave, onReset }: { token: string; value: any; status: any; onSave: (v: any) => Promise<any>; onReset: () => Promise<any> }) {
  const [d, setD, dirty] = useDraft(value);
  const set = (patch: any) => setD((x: any) => ({ ...x, ...patch }));
  const voice = (patch: any) => setD((x: any) => ({ ...x, voice: { ...x.voice, ...patch } }));
  const [trying, setTrying] = useState<string | null>(null);
  const tryVoice = async (who: 'mc' | 'artist') => {
    setTrying(who); const r = await admin.tryVoice(token, who, 'Tolu, nobody saves the last puff-puff by accident. Could this be love?').catch(() => ({ audio: null, problem: 'Couldn’t reach the server. Try again.' })); setTrying(null);
    if (!r.audio) { alert(r.problem); return; }
    new Audio(URL.createObjectURL(r.audio)).play().catch(() => {});
  };
  return (
    <div>
      <Section title="Open or paused">
        <Toggle on={d.open} onChange={(open) => set({ open })} label={d.open ? 'The stage is open' : 'The stage is paused'} note="Pausing stops new notes at once. Notes already sent can still be opened and answered, and shared links stay up." />
        {!d.open && <div className="mt-3"><Field label="What people see while it's paused"><Text value={d.pausedMessage} onChange={(pausedMessage) => set({ pausedMessage })} /></Field></div>}
      </Section>
      <Section title="Who reads Peruzzi's words" note="The voice reads Peruzzi's line on each note, and the fixed moments (“Make some noise!”, “I knew it.”). It never reads what anyone typed.">
        <Choice value={d.voice.mode} onChange={(mode) => voice({ mode })} options={[
          ['off', 'No voice', 'Words on screen only'],
          ['mc', 'The MC', 'A stock voice reads everything'],
          ['artist_lines', "Peruzzi's recorded lines", 'His recordings for the fixed moments (Admin → Voice), the MC for the rest'],
          ['artist_ai', "Peruzzi's AI voice", 'Only with Peruzzi’s written consent and the label’s approval. Shown with a visible label.'],
        ]} />
        {d.voice.mode === 'artist_ai' && <div className="mt-3 border border-[#d9a35b]/40 bg-[#d9a35b]/[0.06] px-3.5 py-2.5 text-[14px] text-[#ecd2ad]">Before switching this on: Peruzzi’s written consent, a contract covering how it’s used, and the label’s sign-off on his character here. {status.artistVoice ? '' : 'ELEVENLABS_VOICE_ID is not set on the server.'}</div>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="The MC's voice (ElevenLabs voice ID)" hint="Any voice from your ElevenLabs library"><Text value={d.voice.mcVoiceId} onChange={(mcVoiceId) => voice({ mcVoiceId })} /></Field>
          <Field label="Label shown with the AI voice"><Text value={d.voice.aiLabel} onChange={(aiLabel) => voice({ aiLabel })} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => tryVoice('mc')} className="flex min-h-10 items-center gap-2 border border-bone/25 px-3.5 text-[14.5px]"><PlayIcon size={14} /> {trying === 'mc' ? 'Loading…' : 'Hear the MC'}</button>
          <button onClick={() => tryVoice('artist')} className="flex min-h-10 items-center gap-2 border border-bone/25 px-3.5 text-[14.5px]"><PlayIcon size={14} /> {trying === 'artist' ? 'Loading…' : "Hear Peruzzi's AI voice"}</button>
        </div>
      </Section>
      <Section title="Peruzzi">
        <Field label="Name on the stage" hint="On the nameplate, on every note (“Peruzzi asks”) and on the button"><Text value={d.nameplate} onChange={(nameplate) => set({ nameplate })} /></Field>
        <div className="mt-4"><Field group label="Humour" hint="Peruzzi is always on the writer’s side: whatever they noticed is proof of love. This is how much he teases."><Choice value={d.humour} onChange={(humour) => set({ humour })} options={[['sweet', 'Sweet', 'Soft and warm'], ['cheeky', 'Cheeky', 'Teases a little: the usual'], ['spicy', 'Spicy', 'Teases harder, still with love']]} /></Field></div>
      </Section>
      <Section title="Read live">
        <Toggle on={!!d.readLive} onChange={(readLive) => set({ readLive })} label="Tell people Peruzzi could read the best notes out live"
          note="A new note then says “make it a good one”. Turn it on once Peruzzi’s team has agreed: until then it’s a promise the site can’t keep." />
      </Section>
      <Section title="Limits">
        <div className="flex flex-wrap gap-6">
          <Field label="Notes per person per day"><Num value={d.notesPerDay} min={1} max={100} onChange={(notesPerDay) => set({ notesPerDay })} /></Field>
          <Field label="Notes per connection per day" hint="0 is off. Through the site everyone near one Vercel server shares a connection: only for direct callers, in the thousands"><Num value={d.notesPerDayPerConnection} min={0} max={1000000} onChange={(notesPerDayPerConnection) => set({ notesPerDayPerConnection })} /></Field>
          <Field label="AI readings per hour, everyone" hint="Past it, a prepared line stands in"><Num value={d.aiNotesPerHour} min={0} max={100000} onChange={(aiNotesPerHour) => set({ aiNotesPerHour })} /></Field>
          <Field label="AI drafts per hour, everyone" hint="Readings started while people type"><Num value={d.aiDraftsPerHour} min={0} max={100000} onChange={(aiDraftsPerHour) => set({ aiDraftsPerHour })} /></Field>
          <Field label="Emailed notes per person per day" hint="The same person can be emailed once a week"><Num value={d.asksPerDay} min={0} max={20} onChange={(asksPerDay) => set({ asksPerDay })} /></Field>
          <Field label="Forget what people typed after (days)"><Num value={d.retentionDays} min={1} max={365} onChange={(retentionDays) => set({ retentionDays })} /></Field>
        </div>
      </Section>
      <Section title="The song" note="The snippet plays throughout, and drops while the stage makes a sound.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Volume: ${Math.round(d.music.level * 100)}%`} hint="How loud it sounds: 50% is half as loud as full, 25% a quarter"><input type="range" min={0} max={1} step={0.05} value={d.music.level} onChange={(e) => set({ music: { ...d.music, level: Number(e.target.value) } })} className="w-full accent-[#ff6a1f]" /></Field>
          <Field label={`Under the stage's sounds: ${Math.round(d.music.duck * 100)}%`}><input type="range" min={0} max={1} step={0.05} value={d.music.duck} onChange={(e) => set({ music: { ...d.music, duck: Number(e.target.value) } })} className="w-full accent-[#ff6a1f]" /></Field>
        </div>
      </Section>
      <Section title="When a note is serious" note="Shown instead of a note when someone describes real harm">
        <div className="space-y-3">
          <Field label="Heading"><Text value={d.help.title} onChange={(title) => set({ help: { ...d.help, title } })} /></Field>
          <Field label="Message"><Text area rows={4} value={d.help.body} onChange={(body) => set({ help: { ...d.help, body } })} /></Field>
          <Field label="Where to get help" hint="One per line: label | link">
            <Text area rows={3} value={d.help.links.map((l: any) => `${l.label} | ${l.url}`).join('\n')} onChange={(t) => set({ help: { ...d.help, links: t.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter(([a, b]) => a && b).map(([label, url]) => ({ label, url })) } })} />
          </Field>
        </div>
      </Section>
      <SaveBar dirty={dirty} onSave={() => onSave(d)} onReset={onReset} />
    </div>
  );
}

/** The site: the artist, the song and where to stream it, and the footnotes. */
export function SiteSettings({ site, onSave, onReset }: { site: any; onSave: (key: string, v: any) => Promise<any>; onReset: (key: string) => Promise<any> }) {
  const [s, setS, dirty] = useDraft(site);
  const set = (patch: any) => setS((x: any) => ({ ...x, ...patch }));
  return (
    <div>
      <Section title="The song">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Artist"><Text value={s.artist} onChange={(artist) => set({ artist })} /></Field>
          <Field label="Song"><Text value={s.song} onChange={(song) => set({ song })} /></Field>
          <Field label="Streaming link" hint="Every “Listen to …” goes here: the notes, the tracklist, the emails"><Text value={s.smartLink} onChange={(smartLink) => set({ smartLink })} placeholder="https://…" /></Field>
          <Field label="Instagram handle (optional)"><Text value={s.handle} onChange={(handle) => set({ handle })} placeholder="@…" /></Field>
        </div>
      </Section>
      <Section title="Footnotes">
        <Toggle on={s.demoNotice} onChange={(demoNotice) => set({ demoNotice })} label="Show the concept-demo note" note="Keep this on until Peruzzi’s team signs off" />
        {s.demoNotice && <div className="mt-3"><Text value={s.demoText} onChange={(demoText) => set({ demoText })} /></div>}
        <div className="mt-4"><Toggle on={s.credit} onChange={(credit) => set({ credit })} label="Show “Made by Mmedara Josiah” on the shared pages" /></div>
      </Section>
      <SaveBar dirty={dirty} onSave={async () => { await onSave('site', s); }} onReset={async () => { await onReset('site'); }} />
    </div>
  );
}
