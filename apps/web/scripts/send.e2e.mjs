// Sending a note to the person it's for, and what they get: the WhatsApp link (its preview keeps the note folded: who
// it's for, who it's from, and the question), the note opened on their phone, the one tick that counts, the writer
// seeing it opened and then answered without lifting a finger, and writing back. Then by email: the writer proves
// their address with a code, the note goes out with its three boxes, the once-a-week limit, the answer emailed back to
// the writer, and the "never send me notes again" link.
import { A, H, SHOTS, W, check, devices, done, launch, notebookOf, outbox, read, withStage, write } from './lib/env.mjs';

const restore = await withStage({});
const b = await launch();
const writer = await b.newContext({ ...devices['Pixel 7'] }); const p = await writer.newPage();
const them = await b.newContext({ ...devices['Pixel 7'] }); const q = await them.newPage();
const errors = []; for (const page of [p, q]) page.on('pageerror', (e) => errors.push(e.message));
const rec = `bayo.${Date.now()}@example.com`;
const from = `ade.${Date.now()}@example.com`;   // a new writer each run: the real limit is 3 emailed notes a day
const steps = (page) => page.getByRole('region', { name: 'Next steps' });
const sheetOf = (page) => page.getByRole('dialog', { name: 'Send the note' });
const card = async (code) => Buffer.from(await (await fetch(`${A}/api/cards/n/${code}.jpg`)).arrayBuffer());
/** A note, read and landed. */
async function note(page, who, what) {
  await write(page, who, what);
  const r = await read(page);
  await page.getByRole('button', { name: 'Write another note' }).waitFor({ timeout: 30000 }); await page.waitForTimeout(1200);
  return r;
}
try {
  // ---- the link ----
  await p.goto(`${W}/`, { waitUntil: 'networkidle' });
  check('a note to Kemi', (await note(p, 'Kemi', 'always save me the window seat and pretend it was luck')) === 'note');
  const k = (await notebookOf(p)).notes[0];
  await steps(p).getByRole('button', { name: /Send it to Kemi/ }).click();
  const sheet = sheetOf(p); await sheet.waitFor();
  check('sending starts with the two names, theirs from the note', await sheet.getByRole('heading', { name: 'send it to Kemi' }).isVisible() && (await sheet.getByPlaceholder('Their first name').inputValue()) === 'Kemi');
  await sheet.getByPlaceholder('Your first name').fill('Adé');
  await sheet.getByRole('button', { name: 'Continue' }).click();
  const wa = sheet.getByRole('link', { name: 'Send on WhatsApp' }); await wa.waitFor();
  const href = decodeURIComponent((await wa.getAttribute('href')) || '');
  const link = /(http\S+\/a\/(\w+))/.exec(href);
  check('WhatsApp opens with a message that names them both and carries the link', href.includes('Kemi, Peruzzi asked you something. It’s from Adé, and only you can answer it:') && !!link, href.slice(0, 140));
  const ask = link[2];
  const prev = await (await fetch(`${A}/a/${ask}`)).text();
  check('the link previews folded: who it’s for, who it’s from, and the question', prev.includes('og:title" content="Kemi, Peruzzi asked you something"') && prev.includes('A note from Adé') && prev.includes('/media/img/og-ask.jpg'));
  check('…what the note says stays out of the preview: it’s for them to open', !prev.includes(k.line) && !prev.includes(k.peruzzi));
  check('…and a tap on it goes on to the note', prev.includes(`/answer/${ask}`));
  await p.screenshot({ path: `${SHOTS}/send-how.png` });
  await p.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
  check('sent, the note says so, and its step sends it again', await steps(p).getByText('Sent. Kemi hasn’t opened it yet.').isVisible() && await steps(p).getByRole('button', { name: /Send it to Kemi again/ }).isVisible());
  const before = await card(k.code);

  // ---- Kemi's phone: a notebook of her own already on it ----
  await q.goto(`${W}/`, { waitUntil: 'networkidle' }); await q.getByLabel('Who it’s for').waitFor({ timeout: 60000 });
  const hers = await q.evaluate(() => JSON.parse(localStorage.getItem('pa.notebook')).id);
  await q.goto(`${W}/answer/${ask}`, { waitUntil: 'networkidle' });
  await q.getByRole('button', { name: 'Open it' }).waitFor({ timeout: 15000 });
  check('she arrives on the stage with who it’s from', await q.getByText('A note from Adé').isVisible() && await q.getByRole('heading', { name: 'Kemi, peruzzi asked you something' }).isVisible());
  check('…and the note is still folded', !(await q.locator('body').innerText()).includes(k.line) && await q.locator('[data-choice]').count() === 0);
  await q.screenshot({ path: `${SHOTS}/send-arrive.png` });
  await p.getByRole('button', { name: /Your notes/ }).click(); await p.waitForURL('**/notes');
  check('the writer sees it’s been opened', await p.getByText(/^Seen \d{1,2}:\d{2}[ap]m\. No tick yet\.$/).first().waitFor({ timeout: 8000 }).then(() => true, () => false));
  await q.getByRole('button', { name: 'Open it' }).click();
  const boxes = q.locator('[data-choice]'); await boxes.first().waitFor({ timeout: 12000 });
  check('opened: the note comes down with three boxes to tick', await boxes.count() === 3 && await q.getByText('Tick one box on the note').isVisible() && await q.getByText(k.peruzzi).count() === 1);
  check('…the third box is Peruzzi’s way out', (await boxes.nth(2).getAttribute('aria-label')) === `Tick: ${k.escape}`);
  await q.screenshot({ path: `${SHOTS}/send-open.png` });
  await q.locator('[data-choice="yes"]').click();
  check('her tick goes in its box', await q.locator('[data-tick="yes"]').waitFor({ timeout: 4000 }).then(() => true, () => false));
  check('…and Peruzzi says his piece', await q.getByText('Peruzzi: “I knew it.”').waitFor({ timeout: 6000 }).then(() => true, () => false));
  await q.getByRole('heading', { name: 'you ticked yes' }).waitFor({ timeout: 8000 });
  const answered = q.getByRole('region', { name: 'Next steps' });
  check('then her next steps: tell Adé, post it, the song', await answered.getByText('Adé can see your answer now.').isVisible() && await answered.getByText('Send your answer back').isVisible()
    && await answered.getByText('Put it on your story').isVisible() && await answered.getByRole('link', { name: /Listen to Inferno by Peruzzi/ }).isVisible());
  const backHref = decodeURIComponent((await answered.getByRole('link', { name: /Send your answer back/ }).getAttribute('href')) || '');
  check('…telling Adé is a WhatsApp message with the note’s link', backHref.includes(`Adé, I answered your note. ${new URL(W).origin}/q/${k.code}`), backHref.slice(0, 120));
  await q.waitForTimeout(600); await q.screenshot({ path: `${SHOTS}/send-answered.png` });
  check('the writer’s notes catch up by themselves: Kemi ticked Yes', await p.getByText('Kemi ticked Yes.').first().waitFor({ timeout: 20000 }).then(() => true, () => false));
  const again = await (await fetch(`${A}/api/asks/${ask}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'no' }) })).json();
  check('only the first tick counts', again.already === true && again.note.answer === 'yes');
  await new Promise((r) => setTimeout(r, 1500));
  check('the link preview’s card is the ticked one now', !before.equals(await card(k.code)));
  const pq = await (await fetch(`${A}/q/${k.code}`)).text(); const pa = await (await fetch(`${A}/a/${ask}`)).text();
  check('…and the previews say how she answered', pq.includes('og:title" content="Kemi answered Peruzzi: Yes"') && pa.includes('og:title" content="Kemi answered Peruzzi: Yes"'));
  await q.reload({ waitUntil: 'networkidle' });
  check('back on the note, her answer is there at once, with nothing left to tick', await q.getByRole('heading', { name: 'you ticked yes' }).waitFor({ timeout: 8000 }).then(() => true, () => false)
    && await q.locator('[data-tick="yes"]').count() === 1 && await q.locator('[data-choice]').count() === 0);
  await p.locator('[data-note]').first().click(); await p.waitForURL('**/notes/**');
  check('the writer’s note has her tick on it', await p.locator('[data-tick="yes"]').waitFor({ timeout: 8000 }).then(() => true, () => false));

  // her own notebook is still hers; writing Adé back starts one that answers his note
  await q.getByRole('button', { name: 'Write your own note' }).last().click();
  await q.getByLabel('Who it’s for').waitFor({ timeout: 30000 });
  check('“Write your own note” goes on in the notebook already on her phone', await q.evaluate(() => JSON.parse(localStorage.getItem('pa.notebook')).id) === hers && (await q.getByLabel('Who it’s for').inputValue()) === '');
  await q.goto(`${W}/answer/${ask}`, { waitUntil: 'networkidle' });
  await q.getByRole('button', { name: 'Write Adé back' }).click();
  await q.getByLabel('Who it’s for').waitFor({ timeout: 30000 });
  check('writing back: a note to Adé, his name filled in', await q.getByRole('heading', { name: 'write Adé back' }).isVisible() && await q.getByText('Adé sent you a note').isVisible() && (await q.getByLabel('Who it’s for').inputValue()) === 'Adé');
  check('…read like any other', (await note(q, null, 'ask a music star to ask me instead of just asking me')) === 'note' && await q.getByRole('region', { name: 'Your note' }).getByRole('heading', { name: 'Dear Adé,' }).count() === 1);
  const backBook = await notebookOf(q);
  check('…in a notebook of its own that knows what it answers', backBook.id !== hers && backBook.back?.sender === 'Adé');

  // ---- by email: the writer proves their address first ----
  await p.goto(`${W}/`, { waitUntil: 'networkidle' });
  check('a note to Bayo', (await note(p, 'Bayo', 'text me good morning before you even check the weather')) === 'note');
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
  check('…with the note on it, Peruzzi’s line and three empty boxes', !!mail && mail.text.includes('Dear Bayo,') && mail.text.includes(`Peruzzi says: ${k2.peruzzi}`) && mail.text.includes('[ ] Yes') && mail.text.includes('[ ] No') && mail.text.includes(`[ ] ${k2.escape}`));
  check('…the way to answer, to write back, the song, and the opt-out', !!mail && /Open the note and answer: \S+\/a\/\w+/.test(mail.text) && /Write Adé a note back: \S+\/\?back=\w+/.test(mail.text)
    && /Listen to Inferno by Peruzzi: https?:\/\//.test(mail.text) && /Never send me notes again: \S+\/api\/u\/block\//.test(mail.text));
  check('…and nothing of their address in it', !!mail && !mail.text.includes(rec) && !mail.html.includes(rec));
  await s2.getByRole('button', { name: 'Done' }).click(); await s2.waitFor({ state: 'hidden' });

  // the same person again this week: refused
  await steps(p).getByRole('button', { name: /Send it to Bayo again/ }).click(); await s2.waitFor();
  await s2.getByRole('button', { name: 'Continue' }).click(); await s2.getByRole('button', { name: 'Have it emailed' }).click();
  await s2.getByPlaceholder('them@example.com').fill(rec); await s2.getByRole('button', { name: 'Send the note' }).click();
  check('the same person can be emailed once a week', await s2.getByText('You’ve already emailed this person a note this week.', { exact: false }).waitFor({ timeout: 5000 }).then(() => true, () => false));
  await p.keyboard.press('Escape');

  // Bayo answers from the email: the writer hears about it
  const emailed = /Open the note and answer: \S+\/a\/(\w+)/.exec(mail.text)[1];
  const r = await (await fetch(`${A}/api/asks/${emailed}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'escape' }) })).json();
  check('his answer counts', r.already === false && r.note.answer === 'escape');
  await new Promise((res) => setTimeout(res, 1500));
  const told = (await outbox()).find((m) => m.to === from && m.subject === 'Bayo answered your note');
  check('an emailed note that’s answered tells its writer, with the box he ticked', !!told && told.text.includes(`[x] ${k2.escape}`) && told.text.includes('[ ] Yes') && new RegExp(`See the note: \\S+/q/${k2.code}`).test(told.text), told?.subject);

  // never send me notes again
  const unsub = /Never send me notes again: (\S+)/.exec(mail.text)[1];
  const page = await (await fetch(unsub)).text();
  const confirmed = await (await fetch(unsub, { method: 'POST' })).text();
  check('“never send me notes again” asks first, then confirms', page.includes('Never be sent a note again?') && confirmed.includes('Done.'));
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
  check('…and the link’s story: opened, answered, written back', !!kemi?.openedAt && !!kemi?.answeredAt && !!kemi?.backAt && kemi.answer === 'yes');
  check('no errors on either phone', errors.length === 0, errors.join(' | ').slice(0, 300));
} finally { await restore(); await b.close(); }
done();
