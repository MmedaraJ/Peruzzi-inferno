// The admin: signing in, what's connected (and whether the server knows the site's address), the insights, the costs
// (a payment off what's owed, and a month at 10,000 notes), pausing the stage (which reaches the site, while notes
// already sent can still be opened), the emails, and the notes, with hiding one from its public link. Nothing anywhere
// about answers or boxes to tick: there are none.
import { A, H, PW, SHOTS, W, check, done, launch } from './lib/env.mjs';

const b = await launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const before = (await (await fetch(`${A}/api/admin/config`, { headers: H })).json()).values;
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
try {
  await p.goto(`${W}/admin`, { waitUntil: 'networkidle' });
  await p.fill('input[type=password]', 'wrong'); await p.getByRole('button', { name: 'Sign in' }).click();
  check('a wrong password is refused', await p.getByText('That password isn’t right.').waitFor({ timeout: 3000 }).then(() => true, () => false));
  await p.fill('input[type=password]', PW); await p.getByRole('button', { name: 'Sign in' }).click();
  await p.getByText('From the stage to sharing').waitFor();
  check('the status says whether the server knows the site’s address', await p.getByText(/Addresses: /).isVisible());
  check('the insights load: the way from the stage to sharing, what the notes were about, opened and written back', await p.getByRole('heading', { name: 'What the notes were about' }).isVisible()
    && await p.getByText('Peruzzi read it').isVisible() && await p.getByText('Opened by the one asked').isVisible() && await p.getByText('Written back', { exact: true }).isVisible());
  check('…and the kinds of love Peruzzi named', await p.getByRole('heading', { name: 'The kinds of love' }).isVisible());
  check('…and no answers from the people asked: there are none to count', await p.getByRole('heading', { name: 'The answers' }).count() === 0 && await p.getByText(/ticked yes|Answered/).count() === 0);
  const ins = await (await fetch(`${A}/api/admin/insights`, { headers: H })).json();
  check('…counted from the notes themselves', ins.totals.asked <= ins.totals.notes && ins.totals.seen <= ins.totals.asked && !('answered' in ins.totals) && !('answers' in ins), JSON.stringify({ notes: ins.totals.notes, asked: ins.totals.asked, seen: ins.totals.seen }));
  await p.screenshot({ path: `${SHOTS}/admin-insights.png`, fullPage: true });

  // the costs: what it has cost, month by month, what keeps it running, and what's still to pay, less what's been paid
  await p.getByRole('button', { name: 'Costs', exact: true }).click();
  await p.locator('[data-owed]').waitFor({ timeout: 10000 });
  const c0 = await (await fetch(`${A}/api/admin/costs`, { headers: H })).json();
  check('the costs show what’s still to pay, month by month, and what keeps it running', await p.getByRole('heading', { name: 'Month by month' }).isVisible() && await p.getByRole('heading', { name: 'To keep it running' }).isVisible() && c0.months.length >= 1 && c0.totals.incurred >= c0.totals.thisMonth);
  await p.getByRole('button', { name: 'Add a payment' }).click();
  await p.locator('[data-payment]').first().getByLabel('Amount').fill('7.5');
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.getByText('Saved. The totals are up to date.').waitFor({ timeout: 5000 });
  const c1 = await (await fetch(`${A}/api/admin/costs`, { headers: H })).json();
  check('a payment comes off what’s still to pay', Math.abs(c1.totals.paid - c0.totals.paid - 7.5) < 0.01 && Math.abs(c0.totals.owed - c1.totals.owed - 7.5) < 0.05, `${c0.totals.owed} → ${c1.totals.owed}`);
  // a month at 10,000 notes without the voice: the AI at what a note costs, the steady bills, and hosting
  await p.locator('[data-milestone="10000"]').click();
  await p.getByRole('button', { name: 'Nothing: no voice' }).click(); await p.getByRole('button', { name: '1 month', exact: true }).click();
  const shown = Number((await p.locator('[data-projected]').innerText()).replace(/[^0-9.]/g, ''));
  const cc = (await (await fetch(`${A}/api/admin/config`, { headers: H })).json()).values.costs;
  const month = new Date(Date.now() + 3600_000).toISOString().slice(0, 7);
  const bills = cc.items.filter((it) => it.id !== 'elevenlabs' && !/elevenlabs/i.test(it.name || '') && it.amount > 0 && it.every !== 'once' && (!it.until || it.until.slice(0, 7) >= month))
    .reduce((s, it) => s + (it.every === 'year' ? it.amount / 12 : it.amount), 0);
  const want = 10_000 * (c1.unit.aiNotes >= 20 ? c1.unit.aiPerNote : cc.projection.aiPerNote) + cc.projection.hostingPer10k + bills;
  check('a month at 10,000 notes, without the voice: the AI at what a note costs, the bills and hosting', Math.abs(shown - want) < 1, `${shown} vs ${want.toFixed(2)}`);
  await p.getByRole('button', { name: 'Every note' }).click();
  const voiced = Number((await p.locator('[data-projected]').innerText()).replace(/[^0-9.]/g, ''));
  check('with every note read aloud, the same month costs more, on an ElevenLabs plan', voiced > shown && await p.getByRole('cell', { name: /Creator|Pro|Scale|Business/ }).first().isVisible(), `${shown} → ${voiced}`);
  await p.screenshot({ path: `${SHOTS}/admin-costs.png`, fullPage: true });

  // pausing the stage
  await p.getByRole('button', { name: 'The stage', exact: true }).click();
  check('the stage’s settings: Peruzzi’s humour, the read-live promise, the limits', await p.getByRole('heading', { name: 'Peruzzi', exact: true }).isVisible() && await p.getByRole('group', { name: 'Humour' }).getByRole('button', { name: /^Cheeky/ }).isVisible()
    && await p.getByRole('heading', { name: 'Read live' }).isVisible() && await p.getByText('Notes per person per day', { exact: true }).isVisible());
  check('…with nothing left from the court', !(await p.getByText(/court|verdict|judge|bench|summon/i).count()));
  await p.getByRole('button', { name: 'The stage is open' }).click();
  check('pausing asks what people should see meanwhile', await p.getByText('What people see while it\'s paused').isVisible());
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.getByText('Saved.').waitFor({ timeout: 5000 });
  const cfg = await (await fetch(`${A}/api/stage/config`)).json();
  check('pausing the stage reaches the site', cfg.open === false);
  const q = await b.newPage(); await q.goto(`${W}/`, { waitUntil: 'networkidle' });
  check('the way in says so too, with the song still there to play', await q.getByRole('heading', { name: 'between sets' }).waitFor({ timeout: 8000 }).then(() => true, () => false) && await q.getByText(cfg.pausedMessage).isVisible()
    && await q.getByRole('link', { name: /Listen to Inferno/ }).isVisible() && await q.getByRole('button', { name: /who’s on your mind/i }).count() === 0);
  await q.goto(`${W}/stage`, { waitUntil: 'networkidle' });
  check('a paused stage says Peruzzi is between sets, with the message', await q.getByRole('heading', { name: 'between sets' }).waitFor({ timeout: 8000 }).then(() => true, () => false) && await q.getByText(cfg.pausedMessage).isVisible());
  const asks = await (await fetch(`${A}/api/admin/asks`, { headers: H })).json();
  if (asks.length) {
    await q.goto(`${W}/answer/${asks[0].code}`, { waitUntil: 'networkidle' });
    check('…while a note already sent can still be opened', await q.getByRole('button', { name: 'Open it' }).or(q.locator('canvas[data-paper]')).first().waitFor({ timeout: 8000 }).then(() => true, () => false)
      && !(await q.getByRole('heading', { name: 'between sets' }).count()));
  }
  await q.close();

  // the emails: the note, the tracklist and the code; nothing to tell a writer about an answer
  await p.getByRole('button', { name: 'Emails', exact: true }).click();
  check('the emails: the note, the tracklist, the code, and no “they answered”', await p.getByText('Confirmation code').first().waitFor({ timeout: 8000 }).then(() => true, () => false) && await p.getByText('They answered').count() === 0);

  // the notes: each one as written, what Peruzzi said, where it went; hiding one takes it off its public link
  await p.getByRole('button', { name: 'Notes', exact: true }).click();
  check('the notes can be filtered by whether they were opened, not answered', await p.getByRole('button', { name: 'Opened', exact: true }).isVisible() && await p.getByRole('button', { name: 'Answered', exact: true }).count() === 0);
  const row = p.locator('main button').filter({ hasText: 'Dear ' }).first();
  // waits for the list itself: the first open of a page can take a moment while the dev server builds it
  check('the notes load', await row.waitFor({ timeout: 10000 }).then(() => true, () => false));
  const list = await (await fetch(`${A}/api/admin/notes?filter=seen`, { headers: H })).json();
  const k = list.find((x) => x.status === 'asked' && !x.hidden) || (await (await fetch(`${A}/api/admin/notes`, { headers: H })).json()).find((x) => x.status === 'asked' && !x.hidden);
  if (k) {
    await p.getByPlaceholder('Search titles, who it’s to and what was written').fill(k.dear); await p.getByRole('button', { name: 'Search' }).click();
    await p.locator('main button').filter({ hasText: `Dear ${k.dear} · ${k.title}` }).first().click();
    const sheet = p.getByRole('dialog', { name: 'Note' }); await sheet.waitFor();
    check('a note opens with what was written and what Peruzzi said, with no boxes', await sheet.getByText('As written').isVisible() && await sheet.getByText('Peruzzi asks: Could this be love?').isVisible() && !(await sheet.innerText()).includes('☐'));
    await p.screenshot({ path: `${SHOTS}/admin-note.png` });
    const code = (await (await fetch(`${A}/api/admin/notes/${k.id}`, { headers: H })).json()).code;
    await sheet.getByRole('button', { name: 'Hide from public links' }).click(); await sheet.getByRole('button', { name: 'Show it again' }).waitFor();
    const hidden = await fetch(`${A}/api/n/${code}`);
    await sheet.getByRole('button', { name: 'Show it again' }).click(); await sheet.getByRole('button', { name: 'Hide from public links' }).waitFor();
    const shownAgain = await fetch(`${A}/api/n/${code}`);
    check('hiding a note takes it off its public link, and showing it puts it back', hidden.status === 404 && shownAgain.status === 200, `${hidden.status} → ${shownAgain.status}`);
  }
  check('no errors on the page', errors.length === 0, errors.join(' | ').slice(0, 300));
} finally {
  await fetch(`${A}/api/admin/config/stage`, { method: 'PUT', headers: H, body: JSON.stringify({ value: before.stage }) });
  await fetch(`${A}/api/admin/config/costs`, { method: 'PUT', headers: H, body: JSON.stringify({ value: before.costs }) });
  await b.close();
}
done();
