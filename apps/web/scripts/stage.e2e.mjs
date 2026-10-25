// The stage on a phone, the writer's side: no front page (the site opens on a note), the note in one sentence
// ("Dear ___, I think you ___. Could this be love?", what they do kept short by its count), Peruzzi reading it while
// the band and the crowd give their word, the note with his stamp and his line, and its card; your notes (the note on
// them at once, opening its page), the back buttons and the phone's own back, the tracklist and its email, the public
// page behind the shared link, a note to something that can't answer, and a note that describes real harm. What was
// typed never shows on a public page as typed.
import fs from 'node:fs';
import { A, SHOTS, W, check, devices, done, jpegSize, launch, notebookOf, outbox, read, withStage, write } from './lib/env.mjs';

const restore = await withStage({ readLive: true });   // the read-live line on
const b = await launch();
const ctx = await b.newContext({ ...devices['Pixel 7'], acceptDownloads: true }); const p = await ctx.newPage();
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(W).origin });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
try {
  await p.goto(`${W}/`, { waitUntil: 'networkidle' });
  const who = p.getByLabel('Who it’s for'); const what = p.getByLabel('What they do'); await who.waitFor({ timeout: 60000 });
  check('the site opens straight on a note: no front page, no lobby, no walkthrough', new URL(p.url()).pathname === '/' && await p.getByRole('heading', { name: 'who’s on your mind?' }).isVisible() && (await p.getByRole('dialog').count()) === 0);
  check('the stage: Peruzzi under the light, with his nameplate', await p.locator('img[src*="stage-"]').count() === 1 && await p.getByText(/^Peruzzi · live$/i).first().isVisible());
  check('one sentence, two blanks: “Dear ___, I think you ___. Could this be love?”', await p.getByText('Dear', { exact: true }).isVisible() && await p.getByText('I think you', { exact: true }).isVisible()
    && await p.getByText('Could this be love?', { exact: true }).isVisible() && await what.isVisible());
  check('what they do is kept short by its count', await p.getByText('0/80', { exact: true }).isVisible());
  check('the three boxes they’ll answer in show, faint, under it', await p.getByText('They tick one').isVisible());
  check('sound is the stage’s mute button, at the top, and it’s on', await p.getByRole('button', { name: 'Turn sound off' }).isVisible());
  check('with read-live on, the note says to make it a good one', await p.getByText(/could read the best notes out live/).isVisible());
  const button = p.getByRole('button', { name: /help me ask/ });
  check('the button is Peruzzi’s: “Peruzzi, help me ask”', (await button.innerText()).trim() === 'Peruzzi, help me ask');
  await button.click();
  check('handing up an empty note asks who it’s for', await p.getByRole('alert').filter({ hasText: 'Who’s it for?' }).isVisible());
  // a phone starts sound only from a tap: the first one on the page starts the song
  check('the first tap starts the song', await p.waitForFunction(() => window.__sound?.musicPlaying, null, { timeout: 8000 }).then(() => true, () => false));
  await what.fill('x'.repeat(120));
  check('the count stops it at 80', (await what.inputValue()).length === 80 && await p.getByText('80/80', { exact: true }).isVisible());
  await who.fill('Tolu');
  const words = 'saved the last puff-puff for me on purpose. Call me on 08031234567';
  await what.fill(words);
  check('the count follows what’s typed', await p.getByText(`${words.length}/80`, { exact: true }).isVisible());
  // the button is the foot of the screen whatever the blank above it does: two lines, then back to one
  const foot = () => p.evaluate(() => { const d = document.querySelector('button[type=submit]').parentElement.getBoundingClientRect(); return { gap: Math.round(window.innerHeight - d.bottom), blank: Math.round(document.querySelector('textarea[aria-label="What they do"]').getBoundingClientRect().height) }; });
  const long = await foot(); await what.fill('smile'); await p.waitForTimeout(300); const short = await foot(); await what.fill(words); await p.waitForTimeout(300);
  check('the button stays at the foot of the screen as the blank goes from two lines to one', long.blank > short.blank && long.gap === 0 && short.gap === 0, JSON.stringify({ long, short }));
  await p.screenshot({ path: `${SHOTS}/stage-write.png` });

  // the song: cut on leaving, carried on when back, and left alone after a trip to stream it
  const music = () => p.evaluate(() => ({ playing: window.__sound.musicPlaying, held: window.__sound.held }));
  await what.blur(); await p.waitForTimeout(900);
  await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForTimeout(200);
  check('leaving the page stops the song at once', !(await music()).playing);
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(900);
  check('coming back carries the song on', (await music()).playing);
  await p.evaluate(() => { window.__sound.leaveForStream(); window.dispatchEvent(new Event('blur')); }); await p.waitForTimeout(200);
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(700);
  const m = await music(); const pill = p.getByRole('button', { name: 'Bring the music back' });
  check('back from streaming the song, it waits to be asked', !m.playing && m.held && await pill.isVisible());
  await pill.click(); const gone = await pill.waitFor({ state: 'hidden', timeout: 4000 }).then(() => true, () => false);
  check('the pill brings the song back', (await music()).playing && gone);

  // handed up: Peruzzi reads it, the band and the crowd give their word, his last, the crash, the stamp, the note
  await button.click();
  const ticking = await p.waitForFunction(() => {
    const t = document.querySelector('[data-ticker]'); const names = [...document.querySelectorAll('p.caps')].map((e) => e.textContent);
    return t && t.textContent.trim().length > 3 && names.includes('The band') && names.includes('The crowd') ? t.textContent.trim() : false;
  }, null, { timeout: 8000 }).then((h) => h.jsonValue(), () => '');
  check('handing it up, Peruzzi reads it, with the band and the crowd on stage', !!ticking && await p.getByText('peruzzi is reading it').count() > 0, String(ticking));
  check('…the room agrees', await p.waitForFunction(() => document.querySelector('[data-ticker]')?.textContent.includes('The room agrees.'), null, { polling: 'raf', timeout: 40000 }).then(() => true, () => false));
  await p.screenshot({ path: `${SHOTS}/stage-reading.png` });
  check('then the note', (await read(p)) === 'note');
  await p.getByRole('button', { name: 'Write another note' }).waitFor({ timeout: 30000 });
  await p.waitForTimeout(1600); await p.screenshot({ path: `${SHOTS}/stage-note.png` });
  const noteBox = p.getByRole('region', { name: 'Your note' });
  check('the note is addressed to them, as its headline', await noteBox.getByRole('heading', { name: 'Dear Tolu,' }).count() === 1);
  check('…Peruzzi’s line is on it, and his stamp has come down', await noteBox.getByText(/^Peruzzi says: .{8,}/).count() === 1 && await noteBox.locator('[data-stamp]').evaluate((e) => getComputedStyle(e).visibility !== 'hidden'));
  check('…the question and its three boxes are on it, nothing ticked', await noteBox.getByText('Could this be love?', { exact: true }).count() === 1 && await noteBox.locator('[data-tick]').count() === 0);
  const top = await noteBox.evaluate((el) => el.scrollTop); const stampAt = await noteBox.locator('[data-stamp]').boundingBox().catch(() => null);
  check('the note lands at the top, with the stamp in view', top === 0 && !!stampAt && stampAt.y >= 0 && stampAt.y + stampAt.height <= p.viewportSize().height, JSON.stringify({ top, stamp: stampAt && Math.round(stampAt.y) }));
  const drawn = await noteBox.evaluate((el) => ({ paper: el.querySelectorAll('canvas[data-paper][data-drawn]').length, wide: el.scrollWidth - el.clientWidth }));
  check('the paper on screen is the card’s own, drawn to the phone’s width', drawn.paper === 1 && drawn.wide <= 0, JSON.stringify(drawn));
  check('your notes, under it, count it', await p.getByText('1 note', { exact: true }).isVisible());

  const nextSteps = p.getByRole('region', { name: 'Next steps' });
  const steps = await nextSteps.innerText();
  const order = ['Let Peruzzi ask', 'Send it to Tolu', 'Post it', 'Put it on your story', 'The song'].map((t) => steps.indexOf(t));
  check('next steps, in order: let Peruzzi ask them, post it, the song', order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])), JSON.stringify(order));
  check('…the song is a step of its own, to the streaming link', (await nextSteps.getByRole('link', { name: /Listen to Inferno by Peruzzi/ }).getAttribute('href')) === (await (await fetch(`${A}/api/site`)).json()).smartLink);
  check('…and the line over them says what to do now', await nextSteps.getByText('Now let Peruzzi ask Tolu.').isVisible());
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.getByRole('button', { name: 'Save image', exact: true }).click()]);
  const img = fs.readFileSync(await dl.path()); const dim = jpegSize(img);
  check('Save gives the story card, 1080×1920', dim?.w === 1080 && dim?.h === 1920, JSON.stringify(dim));
  fs.writeFileSync(`${SHOTS}/stage-card.jpg`, img);

  const nb = await notebookOf(p); const k = nb.notes[0];
  // with no share sheet (as in this browser), posting copies the note's link with its line
  await nextSteps.getByRole('button', { name: /Put it on your story/ }).click();
  check('posting without a share sheet copies the note’s link', (await p.evaluate(() => navigator.clipboard.readText())).endsWith(` ${new URL(W).origin}/q/${k.code}`) && await p.getByText('Link copied.').isVisible());
  await new Promise((res) => setTimeout(res, 1500));
  const og = await fetch(`${A}/api/cards/n/${k.code}.jpg`);
  check('the square card is up for link previews', og.status === 200 && og.headers.get('content-type') === 'image/jpeg');
  const html = await (await fetch(`${A}/q/${k.code}`)).text();
  check('the shared link previews with the note and its card', /og:title" content="Someone asked Peruzzi to ask Tolu: could this be love\?/.test(html) && html.includes(`/api/cards/n/${k.code}.jpg`));
  const pub = await ctx.newPage(); await pub.goto(`${W}/question/${k.code}`, { waitUntil: 'networkidle' }); await pub.locator('canvas[data-paper][data-drawn]').waitFor({ timeout: 10000 });
  const pubText = await pub.locator('body').innerText();
  check('the public note shows Peruzzi’s words and the tidied line, never the number typed', !pubText.includes('0803') && !pubText.includes('Call me on'));
  check('…and the way to write your own, and the song', await pub.getByRole('link', { name: /Write a note/ }).isVisible() && await pub.getByRole('link', { name: /Listen to Inferno/ }).isVisible());
  check('…with nothing to tick: only the person it was sent to can answer it', await pub.locator('[data-choice]').count() === 0);
  await pub.screenshot({ path: `${SHOTS}/stage-public-note.png` }); await pub.close();

  // your notes have it already, and it opens its page again
  await p.getByRole('button', { name: /Your notes/ }).click(); await p.waitForURL('**/notes');
  const row = p.locator('[data-note]').first();
  check('the note is on your notes, with Peruzzi’s stamp', await row.isVisible() && await p.getByRole('heading', { name: '1 note' }).isVisible() && await row.getByText('Dear Tolu,').isVisible());
  check('your notes have room for more, and the tracklist is there from the first note', await p.getByRole('button', { name: 'Write another note' }).isVisible() && await p.getByRole('button', { name: 'Get my tracklist' }).isVisible());
  await row.click(); await p.waitForURL('**/notes/**');
  check('a note on your notes opens its page', await p.getByRole('button', { name: /Put it on your story/ }).isVisible() && await p.getByText('Peruzzi says', { exact: false }).count() > 0);
  await p.reload({ waitUntil: 'networkidle' });
  check('the note’s page survives a reload', await p.getByRole('button', { name: /Put it on your story/ }).waitFor({ timeout: 8000 }).then(() => true, () => false));
  await p.getByRole('button', { name: 'Back to your notes' }).click(); await p.waitForURL('**/notes');
  await p.getByRole('button', { name: 'Back to the stage' }).click(); await p.waitForURL((u) => new URL(u).pathname === '/');
  check('back from your notes is a new note', await p.getByLabel('Who it’s for').waitFor({ timeout: 30000 }).then(() => true, () => false) && (await p.getByLabel('Who it’s for').inputValue()) === '');
  await p.screenshot({ path: `${SHOTS}/stage-again.png` });

  // the tracklist: every note a track, a card to post, and the email
  await p.goto(`${W}/tracklist`, { waitUntil: 'networkidle' });
  await p.locator('img[alt="Your tracklist card"]').waitFor({ timeout: 15000 });
  check('the tracklist has its card, and says how many notes are on it', await p.getByText(/Every note you write is a track: 1 so far/).isVisible());
  await p.getByPlaceholder('Your name').fill('Tọ́kẹ́'); await p.getByPlaceholder('Lagos').fill('Lagos'); await p.waitForTimeout(1500);
  check('a name makes it theirs', await p.getByRole('heading', { name: 'Tọ́kẹ́’s tracklist' }).isVisible());
  const em = `tracklist.${Date.now()}@example.com`;
  if (await p.getByText('Email me my tracklist').count()) {
    await p.locator('input[type=email]').fill(em); await p.getByRole('button', { name: 'Send', exact: true }).click();
    await p.getByText(`Sent to ${em}`).waitFor({ timeout: 8000 });
    const mail = (await outbox()).find((x) => x.to === em);
    check('the tracklist arrives by email, with the note on it', !!mail && mail.subject === 'Your tracklist from Peruzzi Asked' && mail.text.includes('Dear Tolu,'));
  }
  const pubT = await (await fetch(`${A}/t/${nb.code}`)).text();
  check('the tracklist’s link previews with its name', pubT.includes('Tọ́kẹ́’s tracklist: 1 note Peruzzi asked'));
  await p.screenshot({ path: `${SHOTS}/stage-tracklist.png` });

  // a note to something that can't read it: nobody to send it to, so posting comes first
  await p.goto(`${W}/`, { waitUntil: 'networkidle' });
  await write(p, 'my bed', 'hold me better than anyone ever has');
  check('a note to a thing is read like any other', (await read(p)) === 'note');
  await p.getByRole('button', { name: 'Write another note' }).waitFor({ timeout: 30000 }); await p.waitForTimeout(1200);
  const thingSteps = await p.getByRole('region', { name: 'Next steps' }).innerText();
  check('…with nobody to send it to: posting comes first', !thingSteps.includes('Send it to') && thingSteps.indexOf('Post it') >= 0 && /can’t read it, but everyone else can/.test(thingSteps), thingSteps.replace(/\s+/g, ' ').slice(0, 120));

  // a note describing real harm gets help, not a stamp
  await p.getByRole('button', { name: 'Write another note' }).click();
  await write(p, 'my uncle', 'hits me when he is angry and I am scared to go home');
  check('a note that describes real harm: Peruzzi puts the mic down and shows where to find help', (await read(p)) === 'serious' && await p.getByRole('link', { name: /helpline/ }).isVisible());
  await p.screenshot({ path: `${SHOTS}/stage-serious.png` });
  const after = await notebookOf(p);
  check('…and it isn’t kept among your notes', after.notes.filter((n) => n.kind).length === 2);
  check('no errors on the page', errors.length === 0, errors.join(' | ').slice(0, 300));
} finally {
  await restore(); await b.close();
}
done();
