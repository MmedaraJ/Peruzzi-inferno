/** Reads sample notes, to hear Peruzzi and time him. PERUZZI_MODEL=… npm run peruzzi:try -w apps/api */
import { peruzziModel, read } from '../src/stage/peruzzi';
try { (process as any).loadEnvFile('.env'); } catch {}

const NOTES: [string, string][] = [
  ['Tolu', 'saved the last puff-puff for me on purpose'],
  ['my crush', 'laugh at my jokes before I finish them'],
  ['Kemi', 'queued at that ATM with me for two hours'],
  ['my mum', 'call me just to ask if I’ve eaten'],
  ['Tobi', 'left me on read for three days, then liked my story'],
  ['Emeka', 'only call me when your data finishes'],
  ['my guy', 'borrowed my charger in 2023 and never returned it'],
  ['Chidi', 'ate my jollof and blamed the generator'],
  ['my bed', 'hold me better than anyone ever has'],
  ['Ada', 'stayed on the phone with me till NEPA brought light'],
  ['asdfg', 'jjjjj kkk'],
]

(async () => {
  const only = process.argv[2];
  console.log(`model: ${peruzziModel()}`);
  const times: number[] = [];
  for (const [who, what] of NOTES.filter(([a]) => !only || a.includes(only))) {
    const r = await read({ who, what, humour: 'cheeky', artist: 'Peruzzi', song: 'Inferno' });
    if (!r) { console.log(`\nDear ${who}, you ${what}\n  (no reading)`); continue; }
    const v = r.reading; times.push(r.ms);
    console.log(`\nDear ${who}, you ${what}  [${r.ms}ms, ${r.usage.in}+${r.usage.cacheRead}c+${r.usage.cacheWrite}w in, ${r.usage.out} out]\n  ${v.kind.toUpperCase()}${v.thing ? ' · a thing' : ''} · Dear ${v.dear} · ${v.title}\n  ${v.line}  (${v.line.split(/\s+/).length} words)\n  Peruzzi asks: Could this be love?\n  ☐ Yes ☐ No ☐ ${v.escape}`);
  }
  times.sort((a, b) => a - b);
  console.log(`\nmedian ${times[Math.floor(times.length / 2)]}ms, slowest ${times[times.length - 1]}ms`);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
