// How fast each page is usable, loaded cold on a throttled phone (Lighthouse's mobile defaults: a mid-range phone on
// slow 4G, or a faster one on good 4G). Run it against a production build served with the API behind it:
//
//   npm run build -w apps/web && (cd apps/web && npx vite preview --port 4173 &)
//   node apps/web/scripts/speed.mjs http://localhost:4173 slow4g
//
// The way in (the site opens on a note, ready to write) is always measured. To measure a notebook under way, a note's
// page and a note as the person it was sent to opens it, give a notebook on this machine's API and a note on it, and an
// ask: NOTEBOOK=<id>:<token> NOTE=<note id> QUESTION=<note code> ASK=<ask code>.
import { chromium, devices } from './lib/env.mjs';

const [base = 'http://localhost:4173', profile = 'slow4g'] = process.argv.slice(2);
const PROFILES = {
  slow4g: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8, cpu: 4 },
  fast4g: { latency: 60, down: (9 * 1024 * 1024) / 8, up: (3 * 1024 * 1024) / 8, cpu: 2 },
};
const P = PROFILES[profile]; if (!P) throw new Error(`profile: ${Object.keys(PROFILES).join(' or ')}`);
const [notebookId, notebookToken] = (process.env.NOTEBOOK || '').split(':');
/** the note, ready to type into */
const WRITE = `!!document.querySelector('input[aria-label="Who it’s for"]')`;
/** a note's paper, drawn */
const PAPER = `!!document.querySelector('canvas[data-paper][data-drawn]')`;
const PAGES = [
  { name: 'the stage, a first note', path: '/', ready: WRITE },
  ...(notebookId ? [
    { name: 'the stage, notes under way', path: '/', notebook: true, ready: WRITE },
    { name: 'your notes', path: '/notes', notebook: true, ready: `!!document.querySelector('[data-note]')` },
    ...(process.env.NOTE ? [{ name: 'a note on your notes', path: `/notes/${process.env.NOTE}`, notebook: true, ready: PAPER }] : []),
  ] : []),
  ...(process.env.QUESTION ? [{ name: 'a shared note', path: `/question/${process.env.QUESTION}`, ready: PAPER }] : []),
  ...(process.env.ASK ? [{ name: 'a note sent to you', path: `/answer/${process.env.ASK}`, ready: `[...document.querySelectorAll('button')].some((e) => /^(Open it|Write .+ back)$/.test(e.textContent.trim()))` }] : []),
];

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
console.log(`${profile}: ${P.latency} ms round trips, ${(P.down * 8 / 1024 / 1024).toFixed(1)} Mbps, CPU ×${P.cpu}. Usable = ms from tapping the link.\n`);
console.log('page'.padEnd(26), 'usable'.padStart(7), 'KB'.padStart(6), 'JS KB'.padStart(6));
for (const pg of PAGES) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], userAgent: undefined });
  await ctx.addInitScript(([d, id, t]) => { try { if (d) localStorage.setItem('pa.notebook', JSON.stringify({ id, token: t, at: Date.now() })); } catch {} }, [!!pg.notebook, notebookId, notebookToken]);
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: P.latency, downloadThroughput: P.down, uploadThroughput: P.up });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  await p.goto(base + pg.path, { waitUntil: 'commit', timeout: 90000 });
  const ready = await p.waitForFunction(`(${pg.ready}) ? performance.now() : 0`, null, { timeout: 60000, polling: 'raf' }).then((h) => h.jsonValue(), () => null);
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  // what came down by the time it was usable (what's fetched afterwards, ahead of the next screen, isn't counted)
  const kb = await p.evaluate((t) => { const r = performance.getEntriesByType('resource').filter((e) => e.responseEnd <= t); const sum = (f) => Math.round(r.filter(f).reduce((a, e) => a + (e.transferSize || 0), 0) / 1024); return { all: sum(() => true), js: sum((e) => /\.js(\?|$)/.test(e.name)) }; }, ready || 1e9);
  console.log(pg.name.padEnd(26), String(ready ? Math.round(ready) : 'timeout').padStart(7), String(kb.all).padStart(6), String(kb.js).padStart(6));
  await ctx.close();
}
await b.close();
