import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '../common/config.service';
import { emailReady, MailService } from '../common/mail.service';
import { EventsService } from '../events/events.service';
import { NoteBox, renderEmail } from '../common/emails';
import { code, EMAIL_RE, esc, firstName, keyedHash, keyedHashes, maskEmail, normEmail, noteNo, signingSecrets, startOfDay } from '../common/util';
import { NOTE_COLUMNS, NOTEBOOK_COLUMNS, publicNote, StageService, TooMany } from './stage.service';
import { clean } from './redact';

const sign = (s: string, key = signingSecrets()[0]) => createHmac('sha256', key).update(s).digest('base64url').slice(0, 32);
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** signed under either secret: a link or a token made before HASH_SECRET was set still works */
const signed = (s: string, sig: string) => !!sig && signingSecrets().some((k) => same(sig, sign(s, k)));
const clip = (s: string | undefined | null, n: number) => clean(s || '', n).text.replace(/\[.*?\]/g, '').trim();
/** Nothing claims to have been emailed while no email service is connected. */
const needEmail = () => { if (!emailReady()) throw new BadRequestException({ message: 'Email isn’t switched on yet. Send the link instead.', reason: 'no-email' }); };

/** Everything that leaves the stage by email or link, and comes back: proving an address, sending a note to the person
 *  it's for, that person opening it, the tracklist, and the opt-outs. */
@Injectable()
export class AsksService {
  constructor(private prisma: PrismaService, private cfg: ConfigService, private mail: MailService, private events: EventsService, private stage: StageService) {}

  // ---- contacts -------------------------------------------------------------------------------------------------
  /** An address given for the tracklist or proved with a code, with or without the OK to hear from Peruzzi. Nothing
   *  here undoes an opt-out: an address that unsubscribed stays unsubscribed, and gets no news, box ticked or not. */
  async capture(email: string, marketing: boolean, source: string, device?: string, name?: string) {
    const e = normEmail(email || ''); if (!EMAIL_RE.test(e) || e.length > 120) throw new BadRequestException({ message: 'That email doesn’t look right.', reason: 'email' });
    const nm = clip(firstName(name), 24) || undefined;
    let c = await this.prisma.contact.upsert({
      where: { email: e },
      create: { email: e, marketing, marketingAt: marketing ? new Date() : null, source, device, name: nm },
      update: { ...(nm ? { name: nm } : {}) },
    });
    if (marketing && !c.unsubscribedAt) c = await this.prisma.contact.update({ where: { id: c.id }, data: { marketing: true, marketingAt: new Date() } });
    this.events.add('email_given', device, { source, marketing });
    return c;
  }

  /** Six digits to prove an address before a note is emailed from it. */
  async sendCode(email: string, device?: string) {
    needEmail();
    const e = normEmail(email || ''); if (!EMAIL_RE.test(e) || e.length > 120) throw new BadRequestException({ message: 'That email doesn’t look right.', reason: 'email' });
    const hour = new Date(Date.now() - 60 * 60_000);
    if ((await this.prisma.emailCode.count({ where: { email: e, createdAt: { gte: hour } } })) >= 3) throw new TooMany('We’ve sent a few codes already. Check your inbox and spam, or try again in an hour.', 'codes');
    if (device && (await this.prisma.emailCode.count({ where: { device, createdAt: { gte: hour } } })) >= 6) throw new TooMany('Too many codes from this phone. Try again in an hour.', 'codes');
    const digits = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.emailCode.create({ data: { email: e, codeHash: keyedHash(`${e}:${digits}`), device, expiresAt: new Date(Date.now() + 15 * 60_000) } });
    const t = (await this.cfg.emails()).code;
    const m = renderEmail(t, { vars: { code: digits, site: this.cfg.siteName }, links: {} });
    if (!(await this.mail.send(e, m.subject, m.html, m.text)).ok) throw new BadRequestException({ message: 'We couldn’t send a code just now. Try again in a little while.', reason: 'failed' });
    return { ok: true };
  }
  async verifyCode(email: string, digits: string, device?: string, name?: string) {
    const e = normEmail(email || ''); const d = String(digits || '').replace(/\D/g, '');
    const row = await this.prisma.emailCode.findFirst({ where: { email: e, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!row || row.attempts >= 5) throw new BadRequestException({ message: 'That code has expired. Ask for a new one.', reason: 'expired' });
    if (!keyedHashes(`${e}:${d}`).some((h) => same(row.codeHash, h))) { await this.prisma.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }); throw new BadRequestException({ message: 'That code isn’t right. Check the latest email.', reason: 'wrong' }); }
    await this.prisma.emailCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    const c = await this.capture(e, false, 'ask', device, name);
    await this.prisma.contact.update({ where: { id: c.id }, data: { verifiedAt: new Date() } });
    return { contactToken: this.contactToken(c.id), email: e };
  }
  private contactToken(id: string) { const exp = Date.now() + 30 * 24 * 60 * 60_000; const body = `${id}.${exp}`; return `${body}.${sign(body)}`; }
  private async contactFrom(tok: string) {
    const [id, exp, sig] = String(tok || '').split('.');
    if (!id || !exp || !sig || !signed(`${id}.${exp}`, sig) || Number(exp) < Date.now()) return null;
    const c = await this.prisma.contact.findUnique({ where: { id } });
    return c?.verifiedAt ? c : null;
  }

  // ---- sending a note -------------------------------------------------------------------------------------------
  private async noteFor(noteId: string, token: string) {
    const k = await this.prisma.note.findUnique({ where: { id: noteId }, select: { ...NOTE_COLUMNS, notebook: { select: NOTEBOOK_COLUMNS } } });
    if (!k || k.notebook.token !== token) throw new NotFoundException('note');
    if (k.status !== 'asked') throw new BadRequestException({ message: 'Peruzzi hasn’t read this note yet.', reason: 'unread' });
    return k;
  }
  private askUrl(code: string) { return `${this.cfg.webUrl}/a/${code}`; }

  /** A link the writer shares themselves (WhatsApp). The site sends nothing; the link is the key to opening the note,
   *  and a note written back can be traced to it. */
  async link(noteId: string, token: string, senderName?: string, recipientName?: string) {
    const k = await this.noteFor(noteId, token);
    const sender = clip(firstName(senderName || k.notebook.name), 24) || 'Someone';
    const a = await this.prisma.ask.create({ data: { code: code(8), noteId: k.id, channel: 'link', senderName: sender, senderDevice: k.notebook.device, recipientName: clip(firstName(recipientName), 24) || null, status: 'link' } });
    if (!k.notebook.name && senderName) await this.prisma.notebook.update({ where: { id: k.notebookId }, data: { name: sender }, select: { id: true } });
    this.events.add('ask_link', k.notebook.device, { kind: k.kind });
    return { code: a.code, url: this.askUrl(a.code) };
  }

  /** The site emails the note, from a writer who proved their address, to the person it's for. */
  async email(noteId: string, token: string, dto: { contactToken: string; senderName?: string; recipientEmail: string; recipientName?: string }) {
    needEmail();
    const k = await this.noteFor(noteId, token);
    const sender = await this.contactFrom(dto.contactToken);
    if (!sender) throw new BadRequestException({ message: 'Confirm your email first.', reason: 'verify' });
    const to = normEmail(dto.recipientEmail || '');
    if (!EMAIL_RE.test(to) || to.length > 120) throw new BadRequestException({ message: 'That email doesn’t look right.', reason: 'email' });
    const c = await this.cfg.stage();
    const day = startOfDay(); const week = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const sent = await this.prisma.ask.count({ where: { channel: 'email', status: 'sent', createdAt: { gte: day }, OR: [{ senderDevice: k.notebook.device }, { senderEmail: sender.email }] } });
    if (sent >= c.asksPerDay) throw new TooMany(`We deliver ${c.asksPerDay} notes a day by email per person. Send the link instead, or come back tomorrow.`, 'asks');
    // kept under the secret in use; looked up under every one, so an opt-out made under an earlier one still holds
    const hash = keyedHash(to); const hashes = keyedHashes(to);
    if (await this.blocked(to)) throw new BadRequestException({ message: 'This person has asked not to be sent notes by email. Send them the link yourself instead.', reason: 'blocked' });
    const again = await this.prisma.ask.count({ where: { channel: 'email', status: 'sent', recipientHash: { in: hashes }, createdAt: { gte: week }, OR: [{ senderDevice: k.notebook.device }, { senderEmail: sender.email }] } });
    if (again) throw new TooMany('You’ve already emailed this person a note this week. Send the link instead.', 'weekly');
    const senderName = clip(firstName(dto.senderName || k.notebook.name || sender.name), 24) || 'Someone';
    const recipientName = clip(firstName(dto.recipientName), 24) || null;
    const a = await this.prisma.ask.create({ data: { code: code(8), noteId: k.id, channel: 'email', senderEmail: sender.email, senderName, senderDevice: k.notebook.device, recipientName, recipientHash: hash, recipientMask: maskEmail(to), status: 'sent' } });
    const site = await this.cfg.site();
    const unsub = this.optOutUrl('block', hash);
    const m = renderEmail((await this.cfg.emails()).ask, {
      vars: { sender: senderName, senderMask: maskEmail(sender.email), recipient: recipientName || k.dear, site: this.cfg.siteName, artist: site.artist, song: site.song },
      boxes: [this.box(k)],
      links: { cta: this.askUrl(a.code), cta2: `${this.cfg.webUrl}/?back=${a.code}`, cta3: site.smartLink },
      unsubscribe: { url: unsub, label: 'Never send me notes again' },
    });
    const r = await this.mail.send(to, m.subject, m.html, m.text, { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
    if (!r.ok) { await this.prisma.ask.update({ where: { id: a.id }, data: { status: 'failed' } }); throw new BadRequestException({ message: 'We couldn’t deliver that one. Try the link instead.', reason: 'failed' }); }
    if (!k.notebook.name) await this.prisma.notebook.update({ where: { id: k.notebookId }, data: { name: senderName }, select: { id: true } });
    this.events.add('ask_email', k.notebook.device, { kind: k.kind });
    return { ok: true, code: a.code, left: Math.max(0, c.asksPerDay - sent - 1) };
  }

  private box(k: { seq: number; title: string; dear: string; line: string | null }): NoteBox {
    return { noteNo: noteNo(k.seq), title: k.title, dear: k.dear, line: k.line || '' };
  }

  // ---- the person asked -----------------------------------------------------------------------------------------
  private async askFor(code: string) {
    const a = await this.prisma.ask.findUnique({ where: { code: String(code || '').slice(0, 16) }, include: { note: { select: { ...NOTE_COLUMNS, notebook: { select: { name: true, city: true } } } } } });
    if (!a || a.note.hidden || a.note.status !== 'asked') throw new NotFoundException();
    return a;
  }
  /** The note, for the person it was sent to: who it's from, and what it says. The first time it's opened, the
   *  writer's phone shows it as seen. */
  async forAsk(code: string) {
    const a = await this.askFor(code);
    const now = new Date();
    if (!a.openedAt) await this.prisma.ask.update({ where: { id: a.id }, data: { openedAt: now } });
    if (!a.note.seenAt) { await this.prisma.note.update({ where: { id: a.noteId }, data: { seenAt: now }, select: { id: true } }); this.events.add('note_seen', null, { channel: a.channel }); }
    return { code: a.code, sender: a.senderName, recipient: a.recipientName, note: publicNote({ ...a.note, seenAt: a.note.seenAt || now }, a.note.notebook) };
  }
  /** "Email me my tracklist". */
  async emailTracklist(notebookId: string, token: string, email: string, marketing: boolean) {
    needEmail();
    const d = await this.stage.notebookFor(notebookId, token);
    const e = normEmail(email || '');
    if ((await this.prisma.event.count({ where: { name: 'tracklist_email', device: d.device, at: { gte: startOfDay() } } })) >= 3) throw new TooMany('We’ve sent your tracklist a few times today already.', 'tracklist');
    if (!EMAIL_RE.test(e) || e.length > 120) throw new BadRequestException({ message: 'That email doesn’t look right.', reason: 'email' });
    // anyone can type any address here: one that unsubscribed, or asked never to be sent notes, isn't emailed, and
    // ticking the news box doesn't change that
    const optedOut = () => new BadRequestException({ message: 'This address asked us not to email it.', reason: 'unsubscribed' });
    if ((await this.prisma.contact.findUnique({ where: { email: e }, select: { unsubscribedAt: true } }))?.unsubscribedAt || (await this.blocked(e))) throw optedOut();
    const contact = await this.capture(e, !!marketing, 'tracklist', d.device, d.name || undefined);
    if (contact.unsubscribedAt) throw optedOut();
    // the tracklist so far, the latest of it if it has grown long
    const notes = (await this.prisma.note.findMany({ where: { notebookId: d.id, status: 'asked', hidden: false }, orderBy: { n: 'asc' }, select: NOTE_COLUMNS })).slice(-10);
    if (!notes.length) throw new BadRequestException({ message: 'Write a note first.', reason: 'empty' });
    const site = await this.cfg.site();
    const unsub = this.optOutUrl('contact', contact.id);
    const m = renderEmail((await this.cfg.emails()).tracklist, {
      vars: { name: d.name || 'Lover', site: this.cfg.siteName, artist: site.artist, song: site.song },
      boxes: notes.map((k) => this.box(k)),
      links: { cta: `${this.cfg.webUrl}/t/${d.code}`, cta2: `${this.cfg.webUrl}/`, cta3: site.smartLink },
      unsubscribe: { url: unsub, label: 'Stop these emails' },
    });
    const r = await this.mail.send(e, m.subject, m.html, m.text, { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
    if (!r.ok) throw new BadRequestException({ message: 'We couldn’t send it just now. Try again in a little while.', reason: 'failed' });
    this.events.add('tracklist_email', d.device, { marketing: !!marketing });
    return { ok: true };
  }

  // ---- opting out -----------------------------------------------------------------------------------------------
  optOutUrl(kind: 'block' | 'contact', id: string) { return `${this.cfg.apiUrl}/api/u/${kind}/${id}/${sign(`${kind}:${id}`)}`; }
  checkOptOut(kind: string, id: string, sig: string) { return (kind === 'block' || kind === 'contact') && signed(`${kind}:${id}`, sig); }
  /** "Never send me notes again", whichever secret the address was hashed under: never fails open. */
  async blocked(email: string) { return !!(await this.prisma.block.findFirst({ where: { hash: { in: keyedHashes(normEmail(email)) } }, select: { hash: true } })); }
  async optOut(kind: 'block' | 'contact', id: string) {
    if (kind === 'block') await this.prisma.block.upsert({ where: { hash: id }, create: { hash: id }, update: {} });
    else await this.prisma.contact.updateMany({ where: { id }, data: { unsubscribedAt: new Date(), marketing: false } });
    this.events.add(kind === 'block' ? 'ask_block' : 'unsubscribe', null, {});
  }
  optOutPage(kind: string, done: boolean, action: string) {
    const what = kind === 'block' ? 'Nobody will be able to send you a note by email from here again.' : 'We won’t email you again.';
    const body = done ? `<h1>Done.</h1><p>${what}</p>` : `<h1>${kind === 'block' ? 'Never be sent a note again?' : 'Stop our emails?'}</h1><p>${kind === 'block' ? 'Nobody will be able to send you a note by email from Peruzzi Asks.' : 'You’ll stop getting tracklists and news.'}</p><form method="post" action="${esc(action)}"><button>Yes, stop them</button></form>`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Peruzzi Asks</title><style>body{margin:0;background:#1d1418;color:#f7ecee;font:18px/1.55 Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}main{max-width:420px}h1{font-weight:400;font-size:30px;margin:0 0 12px}button{margin-top:16px;font:600 17px Georgia,serif;background:#c86272;color:#fff;border:0;border-radius:6px;padding:14px 22px;cursor:pointer}button:hover{background:#b45464}</style></head><body><main><p style="letter-spacing:.3em;font-size:12px;text-transform:uppercase;color:#ffccd6">Peruzzi Asks</p>${body}</main></body></html>`;
  }
}
