// Sending a note to the person it's for, and what they get: the link, made on the address the site is on (never one
// the server was told, like localhost), shared with the note's card or in a WhatsApp message (its preview keeps the
// note folded: who it's for, who it's from, and the question), the note opened on their phone with the song playing
// (nothing to tick: it's theirs to read, post and write back to), the writer seeing it opened, and written back to,
// without lifting a finger. Then by email: the writer proves their address with a code, the note goes out on its paper
// in flat colour, the once-a-week limit, and the "never send me notes again" link.
import { A, H, SHOTS, W, check, devices, done, launch, notebookOf, outbox, read, withStage, write } from './lib/env.mjs';

const restore = await withStage({});
const b = await launch();
const writer = await b.newContext({ ...devices['Pixel 7'] }); const p = await writer.newPage();
await writer.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(W).origin });
const them = await b.newContext({ ...devices['Pixel 7'] }); const q = await them.newPage();
const errors = []; for (const page of [p, q]) page.on('pageerror', (e) => errors.push(e.message));
const rec = `bayo.${Date.now()}@example.com`;
const from = `ade.${Date.now()}@example.com`;   // a new writer each run: the real limit is 3 emailed notes a day
const origin = new URL(W).origin;
const steps = (page) => page.getByRole('region', { name: 'Next steps' });
const sheetOf = (page) => page.getByRole('dialog', { name: 'Send the note' });
/** A note, read and landed. */
async function note(page, who, what) {
  await write(page, who, what);
  const r = await read(page);
  await page.getByRole('button', { name: 'Write another note' }).waitFor({ timeout: 30000 }); await page.waitForTimeout(1200);
  return r;
}
try {
  // ---- the link ----
  await p.goto(`${W}/stage`, { waitUntil: 'networkidle' });
  check('a note to Kemi', (await note(p, 'Kemi', 'said you were outside when you hadn’t even left the house')) === 'note');
  const k = (await notebookOf(p)).notes[0];
  await steps(p).getByRole('button', { name: /Send it to Kemi/ }).click();
  const sheet = sheetOf(p); await sheet.waitFor();
  check('sending starts with the two names, theirs from the note', await sheet.getByRole('heading', { name: 'send it to Kemi' }).isVisible() && (await sheet.getByPlaceholder('Their first name').inputValue()) === 'Kemi');
  check('…and says what they’ll get: the note to open, and a way to write back (nothing to tick)', await sheet.getByText(/open your note on the stage, with Peruzzi’s question on it, and can write you one back/).isVisible() && !(await sheet.innerText()).includes('tick'));
  await sheet.getByPlaceholder('Your first name').fill('Adé');
  await sheet.getByRole('button', { name: 'Continue' }).click();
  const wa = sheet.getByRole('link', { name: 'Send on WhatsApp' }); await wa.waitFor();
  const href = decodeURIComponent((await wa.getAttribute('href')) || '');
  const link = /(http\S+\/a\/(\w+))/.exec(href);
  check('WhatsApp opens with a message that names them both and carries the link', href.includes('Kemi, Adé wrote you a note, and Peruzzi is asking it for them. Open it:') && !!link, href.slice(0, 140));
  check('…a link on the address the site is on, not one the server was told', !!link && link[1].startsWith(`${origin}/a/`) && !href.includes('localhost'), link?.[1]);
  const ask = link[2];
  // the phone's share sheet gets the note's card with the message (this browser has none, so it's stood in for)
  await p.evaluate(() => {
    window.__shared = null;
    Object.defineProperty(navigator, 'canShare', { value: (d) => !!d?.files?.length, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = { files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })), text: d.text }; }, configurable: true });
  });
  await sheet.getByRole('button', { name: 'Send it with the card' }).click();
  const shared = await p.waitForFunction(() => window.__shared, null, { timeout: 5000 }).then((h) => h.jsonValue(), () => null);
  check('“Send it with the card” shares the note’s card, with the message and the link', !!shared && shared.files.length === 1 && shared.files[0].type === 'image/jpeg' && shared.files[0].size > 20_000
    && shared.text.includes('Kemi, Adé wrote you a note') && shared.text.includes(`${origin}/a/${ask}`), JSON.stringify(shared)?.slice(0, 200));
  await p.evaluate(() => { delete navigator.share; delete navigator.canShare; });
  await sheet.getByRole('button', { name: 'Copy the link' }).click();
  check('…or the message and the link copied, to paste anywhere', (await p.evaluate(() => navigator.clipboard.readText())).endsWith(`Open it: ${origin}/a/${ask}`) && await sheet.getByText('Copied. Paste it to them anywhere.').isVisible());
  const prev = await (await fetch(`${A}/a/${ask}`)).text();
  check('the link previews folded: who it’s for, who it’s from, and the question', prev.includes('og:title" content="Kemi, Peruzzi asked you something"') && prev.includes('A note from Adé. Could this be love?') && prev.includes('/media/img/og-ask.jpg'));
  check('…what the note says stays out of the preview: it’s for them to open', !prev.includes(k.line));
  check('…and a tap on it goes on to the note, on the address it was opened on', prev.includes(`content="0;url=/answer/${ask}"`) && prev.includes(`location.replace("/answer/${ask}")`));
  const viaSite = await (await fetch(`${W}/a/${ask}`)).text();
  check('…the same through the site’s own address', viaSite.includes(`url=/answer/${ask}`));
  await p.screenshot({ path: `${SHOTS}/send-how.png` });
  await p.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  check('sent, the note says so, and its step sends it again', await steps(p).getByText('Sent. Kemi hasn’t opened it yet.').isVisible() && await steps(p).getByRole('button', { name: /Send it to Kemi again/ }).isVisible());

  // ---- Kemi's phone: a notebook of her own already on it ----
  await q.goto(`${W}/stage`, { waitUntil: 'networkidle' }); await q.getByLabel('Who it’s for').waitFor({ timeout: 60000 });
  const hers = await q.evaluate(() => JSON.parse(localStorage.getItem('pa.notebook')).id);
  await q.goto(`${W}/answer/${ask}`, { waitUntil: 'networkidle' });
  await q.getByRole('button', { name: 'Open it' }).waitFor({ timeout: 15000 });
  check('she arrives on the stage with who it’s from', await q.getByText('A note from Adé').isVisible() && await q.getByRole('heading', { name: 'Kemi, peruzzi asked you something' }).isVisible());
  check('…the song playing as it opens', await q.waitForFunction(() => window.__sound?.musicPlaying, null, { timeout: 8000 }).then(() => true, () => false));
  check('…and the note still folded', !(await q.locator('body').innerText()).includes(k.line));
  await q.screenshot({ path: `${SHOTS}/send-arrive.png` });
  await p.getByRole('button', { name: /Your notes/ }).click(); await p.waitForURL('**/notes');
  check('the writer sees it’s been opened', await p.getByText(/^Seen \d{1,2}:\d{2}[ap]m\.$/).first().waitFor({ timeout: 8000 }).then(() => true, () => false));
  await q.getByRole('button', { name: 'Open it' }).click();
  await q.locator('canvas[data-paper][data-drawn]').waitFor({ timeout: 12000 });
  check('opened: the note comes down, with Peruzzi’s question on it, and his answer', await q.getByText(k.line).count() === 1 && await q.getByText('Peruzzi asks: Could this be love?').count() === 1 && await q.getByText(`Peruzzi answers: ${k.verdict}.`).count() === 1);
  check('…and nothing to tick', await q.getByRole('checkbox').count() === 0 && await q.getByText(/tick/i).count() === 0 && await q.getByText(/^(Yes|No)$/).count() === 0);
  const next = q.getByRole('region', { name: 'Next steps' }); await next.waitFor({ timeout: 8000 });
  check('then her next steps: write Adé back, post it, the song', await next.getByText('Your turn: tell Adé what they did.').isVisible() && await next.getByRole('button', { name: /Write Adé back/ }).isVisible()
    && await next.getByText('Put it on your story').isVisible() && await next.getByRole('link', { name: /Listen to Inferno by Peruzzi/ }).isVisible());
  await q.waitForTimeout(600); await q.screenshot({ path: `${SHOTS}/send-open.png` });
  check('the old way to answer is gone', (await fetch(`${A}/api/asks/${ask}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'yes' }) })).status === 404);
  await q.reload({ waitUntil: 'networkidle' });
  check('back on the note, it’s open at once', await q.locator('canvas[data-paper][data-drawn]').waitFor({ timeout: 8000 }).then(() => true, () => false) && await q.getByRole('button', { name: 'Open it' }).count() === 0);

  // her own notebook is still hers; writing Adé back starts one that answers his note
  await q.getByRole('button', { name: 'Write your own note' }).last().click();
  await q.getByLabel('Who it’s for').waitFor({ timeout: 30000 });
  check('“Write your own note” goes on in the notebook already on her phone', await q.evaluate(() => JSON.parse(localStorage.getItem('pa.notebook')).id) === hers && (await q.getByLabel('Who it’s for').inputValue()) === '');
  await q.goto(`${W}/answer/${ask}`, { waitUntil: 'networkidle' });
  await q.getByRole('button', { name: /Write Adé back/ }).click();
  await q.getByLabel('Who it’s for').waitFor({ timeout: 30000 });
  check('writing back: a note to Adé, his name filled in', await q.getByRole('heading', { name: 'write Adé back' }).isVisible() && await q.getByText('Adé sent you a note').isVisible() && (await q.getByLabel('Who it’s for').inputValue()) === 'Adé');
  check('…read like any other', (await note(q, null, 'asked a music star to ask me instead of just asking me')) === 'note' && await q.getByRole('region', { name: 'Your note' }).getByRole('heading', { name: 'Dear Adé,' }).count() === 1);
  const backBook = await notebookOf(q);
  check('…in a notebook of its own that knows what it answers', backBook.id !== hers && backBook.back?.sender === 'Adé');
  check('the writer’s notes catch up by themselves: Kemi is writing back', await p.getByText('Kemi is writing you back.').first().waitFor({ timeout: 25000 }).then(() => true, () => false));

  // ---- by email: the writer proves their address first ----
  await p.goto(`${W}/stage`, { waitUntil: 'networkidle' });
  check('a note to Bayo', (await note(p, 'Bayo', 'texted good morning at 4pm and called it consistency')) === 'note');
  const k2 = (await notebookOf(p)).notes.find((x) => x.dear === 'Bayo');
  await steps(p).getByRole('button', { name: /Send it to Bayo/ }).click();
  const s2 = sheetOf(p); await s2.waitFor();
  check('the writer’s name is remembered', (await s2.getByPlaceholder('Your first name').inputValue()) === 'Adé');
  await s2.getByRole('button', { name: 'Continue' }).click();
  await s2.getByRole('button', { name: 'Have it emailed' }).click();
  await s2.getByPlaceholder('you@example.com').fill(from);
  await s2.getByRole('button', { name: 'Send me a code' }).click(); await s2.getByText('We sent a code to').waitFor();
  const code = /\b(\d{6})\b/.exec((await outbox()).find((m) => m.to === from).text)[1];
  await s2.getByPlaceholder('000000').fill(code === '000000' ? '111111' : '000000'); await s2.getByRole('button', { name: 'Confirm' }).click();
  check('a wrong code is refused', await s2.getByText('That code isn’t right').waitFor({ timeout: 4000 }).then(() => true, () => false));
  await s2.getByPlaceholder('000000').fill(code); await s2.getByRole('button', { name: 'Confirm' }).click();
  check('confirmed, it says who the email will be from', await s2.getByText(/Confirmed\. It will say it’s from Adé \(a\*+@example\.com\)\./).waitFor({ timeout: 4000 }).then(() => true, () => false));
  await s2.getByPlaceholder('them@example.com').fill(rec); await s2.getByRole('button', { name: 'Send the note' }).click();
  await s2.getByText(/^Delivered\./).waitFor({ timeout: 8000 });
  const mail = (await outbox()).find((m) => m.to === rec);
  check('the note goes out from the named writer', !!mail && mail.subject === 'Adé asked Peruzzi to ask you something' && /Adé \(a\*+@example\.com\) asked us to deliver this note/.test(mail.text), mail?.subject);
  check('…with the note on it: what they did, Peruzzi’s question and his answer, the song, and nothing to tick', !!mail && mail.text.includes('Dear Bayo,') && mail.text.includes(k2.line) && mail.text.includes('Peruzzi asks: Could this be love?')
    && mail.text.includes(`Peruzzi answers: ${k2.verdict}.`) && mail.text.includes('Inferno by Peruzzi') && !mail.text.includes('[ ]') && !/tick/i.test(mail.text) && mail.text.includes('write Adé one back if you like'));
  check('…the way to open it, to write back, the song, and the opt-out', !!mail && /Open the note: \S+\/a\/\w+/.test(mail.text) && /Write Adé a note back: \S+\/stage\?back=\w+/.test(mail.text)
    && /Listen to Inferno by Peruzzi: https?:\/\//.test(mail.text) && /Never send me notes again: \S+\/api\/u\/block\//.test(mail.text));
  check('…in flat colour: the rose, on light paper, no gradients', !!mail && mail.html.includes('#c86272') && mail.html.includes('#f5e6e9') && !mail.html.includes('gradient'));
  check('…and nothing of their address in it', !!mail && !mail.text.includes(rec) && !mail.html.includes(rec));
  await s2.getByRole('button', { name: 'Done' }).click(); await s2.waitFor({ state: 'hidden' });

  // the same person again this week: refused
  await steps(p).getByRole('button', { name: /Send it to Bayo again/ }).click(); await s2.waitFor();
  await s2.getByRole('button', { name: 'Continue' }).click(); await s2.getByRole('button', { name: 'Have it emailed' }).click();
  await s2.getByPlaceholder('them@example.com').fill(rec); await s2.getByRole('button', { name: 'Send the note' }).click();
  check('the same person can be emailed once a week', await s2.getByText('You’ve already emailed this person a note this week.', { exact: false }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await p.keyboard.press('Escape');

  // Bayo opens it from the email: the writer sees it seen
  const emailed = /Open the note: \S+\/a\/(\w+)/.exec(mail.text)[1];
  const opened = await (await fetch(`${A}/api/asks/${emailed}`)).json();
  check('the emailed link opens the note', opened.sender === 'Adé' && opened.note?.line === k2.line);
  check('…and its writer hears nothing by email: no answer to send', !(await outbox()).some((m) => m.to === from && /answered/i.test(m.subject)));

  // never send me notes again
  const unsub = /Never send me notes again: (\S+)/.exec(mail.text)[1];
  const page = await (await fetch(unsub)).text();
  const confirmed = await (await fetch(unsub, { method: 'POST' })).text();
  check('“never send me notes again” asks first, then confirms, in flat colour', page.includes('Never be sent a note again?') && confirmed.includes('Done.') && !page.includes('gradient'));
  const forged = await fetch(unsub.replace(/\/[^/]+$/, '/not-the-signature'), { method: 'POST' });
  check('an opt-out link only works with its signature', forged.status === 404);
  await steps(p).getByRole('button', { name: /Send it to Bayo again/ }).click(); await s2.waitFor();
  await s2.getByRole('button', { name: 'Continue' }).click(); await s2.getByRole('button', { name: 'Have it emailed' }).click();
  await s2.getByPlaceholder('them@example.com').fill(rec); await s2.getByRole('button', { name: 'Send the note' }).click();
  check('…after which nobody can email them a note', await s2.getByText('This person has asked not to be sent notes by email.', { exact: false }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await p.keyboard.press('Escape');

  const asks = await (await fetch(`${A}/api/admin/asks`, { headers: H })).json();
  check('the admin sees the emailed note with the address masked', asks.some((a) => a.channel === 'email' && a.recipientMask?.includes('*') && !a.recipientMask.includes(rec.split('@')[0])));
  const kemi = asks.find((a) => a.code === ask);
  check('…and the link’s story: opened, written back', !!kemi?.openedAt && !!kemi?.backAt && !('answer' in kemi));
  check('no errors on either phone', errors.length === 0, errors.join(' | ').slice(0, 300));
} finally { await restore(); await b.close(); }
done();
