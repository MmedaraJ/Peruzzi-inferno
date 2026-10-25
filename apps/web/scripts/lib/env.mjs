// Shared by the end-to-end scripts. Run them from the repo root with the API (:4000) and the web app (:5173) running:
//   node apps/web/scripts/stage.e2e.mjs
// With ANTHROPIC_API_KEY on the API they use Peruzzi's real lines (a few cents a run); without it, the prepared ones.
// Screenshots go to $SHOTS (default /tmp/peruzzi-shots).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
export const { chromium, devices } = pw;
export const PW = fs.readFileSync('apps/api/.env', 'utf8').match(/ADMIN_PASSWORD=("?)([^"\n]+)\1/)[2];
export const H = { 'x-admin-password': PW, 'Content-Type': 'application/json' };
export const A = process.env.API || 'http://127.0.0.1:4000';
export const W = process.env.WEB || 'http://127.0.0.1:5173';
export const SHOTS = process.env.SHOTS || '/tmp/peruzzi-shots'; fs.mkdirSync(SHOTS, { recursive: true });
/** A browser that lets the page play sound by itself, or, with `{ autoplay: false }`, one that wants a tap first, as
 *  phones do. */
export const launch = ({ autoplay = true } = {}) => chromium.launch({ executablePath: process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: [`--autoplay-policy=${autoplay ? 'no-user-gesture-required' : 'user-gesture-required'}`] });
let fails = 0;
export const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`); if (!ok) fails++; };
export const done = () => { console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0); };
export const getJson = async (path, opts = {}) => { const r = await fetch(`${A}${path}`, { headers: H, ...opts }); return r.json(); };
/** Changes the stage's settings for a test and hands back a function that puts them back. Every test writes its notes
 *  from this one machine, so the limit on notes a day through one connection is lifted while they run (0 turns it off). */
export async function withStage(patch) {
  const before = (await getJson('/api/admin/config')).values.stage;
  await fetch(`${A}/api/admin/config/stage`, { method: 'PUT', headers: H, body: JSON.stringify({ value: { ...before, notesPerDayPerConnection: 0, ...patch } }) });
  await new Promise((r) => setTimeout(r, 16_000));   // the settings cache is 15 s
  return async () => { await fetch(`${A}/api/admin/config/stage`, { method: 'PUT', headers: H, body: JSON.stringify({ value: before }) }); };
}
export const outbox = () => getJson('/api/admin/outbox');
export const jpegSize = (buf) => { for (let i = 2; i < buf.length;) { if (buf[i] !== 0xff) return null; const m = buf[i + 1], len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc2) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; i += 2 + len; } return null; };
/** "Dear <who>, you <what>.": fills the blanks (a note written back has the first filled
 *  already) and hands it up. */
export async function write(p, who, what) {
  const box = p.getByLabel('Who it’s for'); await box.waitFor({ timeout: 60000 });
  if (who != null) await box.fill(who);
  await p.getByLabel('What they did').fill(what);
  await p.getByRole('button', { name: /help me ask/ }).click();
}
/** Waits for Peruzzi's reading: the note, or Peruzzi putting the mic down. */
export async function read(p, timeout = 60_000) {
  return Promise.race([
    p.getByRole('region', { name: 'Your note' }).waitFor({ timeout }).then(() => 'note'),
    p.getByText('Peruzzi puts the mic down').waitFor({ timeout }).then(() => 'serious'),
  ]);
}
/** The notebook this phone keeps. */
export const notebookOf = async (p) => { const d = await p.evaluate(() => JSON.parse(localStorage.getItem('pa.notebook'))); return (await fetch(`${A}/api/notebooks/${d.id}?t=${encodeURIComponent(d.token)}`)).json(); };
