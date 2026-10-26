import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminGuard, adminSession, lockedOut, passwordIs, tooManyTries, wrongPassword } from '../common/admin.guard';
import { PrismaService } from '../common/prisma.service';
import { CONFIG_KEYS, ConfigKey, ConfigService, DEFAULTS } from '../common/config.service';
import { MailService, senderReady } from '../common/mail.service';
import { EmailKind, renderEmail } from '../common/emails';
import { noteNo } from '../common/util';
import { FIXED_LINES, VoiceService } from '../stage/voice.service';
import { GALLERY_SOUNDS, SoundService } from '../stage/sound.service';
import { NOTE_COLUMNS } from '../stage/stage.service';
import { InsightsService } from './insights.service';
import { CostsService } from './costs.service';
import { aiAvailable } from '../stage/ai';
import { peruzziModel } from '../stage/peruzzi';

const AUDIO = /^audio\/(mpeg|mp3|mp4|aac|x-m4a|m4a|wav|x-wav|webm|ogg)$/;

/** Signing in to the admin: the password, once, for a session token good for 12 hours, which the page keeps and sends
 *  as x-admin-token instead. Wrong passwords are slowed down and, past a few, refused for a while (see AdminGuard). */
@Controller('api/admin')
export class AdminLoginController {
  @Post('login') @HttpCode(200)
  async login(@Body() b: any, @Req() req: Request) {
    if (lockedOut(req)) throw tooManyTries();
    if (passwordIs(typeof b?.password === 'string' ? b.password : '')) return adminSession();
    await wrongPassword(req);
    throw new UnauthorizedException({ message: 'That password isn’t right.', reason: 'password' });
  }
}

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private prisma: PrismaService, private cfg: ConfigService, private mail: MailService, private voice: VoiceService, private sounds: SoundService, private insights: InsightsService, private costs: CostsService) {}

  @Get('check') check() { return { ok: true }; }

  /** Every setting, the defaults beside them, and what is connected. */
  @Get('config')
  async config() {
    return {
      values: await this.cfg.all(), defaults: DEFAULTS,
      status: {
        ai: aiAvailable(), model: peruzziModel(), effort: 'low',
        voice: this.voice.ready, artistVoice: !!process.env.ELEVENLABS_VOICE_ID, email: !!process.env.RESEND_API_KEY && senderReady(), resendKey: !!process.env.RESEND_API_KEY, from: process.env.MAIL_FROM || '',
        webUrl: this.cfg.webUrl, apiUrl: this.cfg.apiUrl, addresses: !!process.env.WEB_URL && !!process.env.API_URL,
      },
    };
  }
  @Put('config/:key')
  async save(@Param('key') key: string, @Body() b: any) {
    if (!CONFIG_KEYS.includes(key as ConfigKey)) throw new NotFoundException();
    const value = b?.value;
    if (value == null || typeof value !== 'object') throw new BadRequestException('value');
    if (key === 'stage') {
      const n = (x: any, lo: number, hi: number, d: number) => (Number.isFinite(+x) ? Math.min(hi, Math.max(lo, Math.round(+x))) : d);
      value.notesPerDay = n(value.notesPerDay, 1, 100, 10); value.asksPerDay = n(value.asksPerDay, 0, 20, 3);
      // a limit that isn't a number would hold nothing back
      value.notesPerDayPerConnection = n(value.notesPerDayPerConnection, 0, 1_000_000, 0);
      value.aiNotesPerHour = n(value.aiNotesPerHour, 0, 100_000, 600); value.aiDraftsPerHour = n(value.aiDraftsPerHour, 0, 100_000, 1200);
      if (!['sweet', 'cheeky', 'spicy'].includes(value.humour)) value.humour = 'cheeky';
      value.readLive = !!value.readLive;
      if (value.music) { const share = (x: any, d: number) => (Number.isFinite(+x) && x !== null && x !== '' ? Math.min(1, Math.max(0, +x)) : d); value.music.level = share(value.music.level, 0.25); value.music.duck = Math.min(value.music.level, share(value.music.duck, 0.1)); }
    }
    if (key === 'costs') {
      const num = (x: any, hi = 1e7) => (Number.isFinite(+x) ? Math.min(hi, Math.max(0, +x)) : 0);
      const date = (x: any) => (typeof x === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(x) ? x : '');
      const str = (x: any, n: number) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
      const id = (x: any) => (typeof x === 'string' && /^[\w-]{1,40}$/.test(x) ? x : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
      value.rate = num(value.rate, 100_000);
      value.voice = { credits: Math.round(num(value.voice?.credits, 1e9)), overPer1k: num(value.voice?.overPer1k, 100) };
      value.items = (Array.isArray(value.items) ? value.items : []).slice(0, 50).map((it: any) => ({
        id: id(it?.id), name: str(it?.name, 80) || 'A bill', amount: num(it?.amount), every: ['month', 'year', 'once'].includes(it?.every) ? it.every : 'month',
        from: date(it?.from), until: date(it?.until) || undefined, note: str(it?.note, 200) || undefined,
      }));
      value.payments = (Array.isArray(value.payments) ? value.payments : []).slice(0, 500).map((p: any) => ({
        id: id(p?.id), at: date(p?.at) || new Date().toISOString().slice(0, 10), amount: num(p?.amount), currency: p?.currency === 'NGN' ? 'NGN' : 'USD',
        rate: p?.currency === 'NGN' ? num(p?.rate, 100_000) || undefined : undefined, by: str(p?.by, 80), note: str(p?.note, 200) || undefined,
      })).filter((p: any) => p.amount > 0);
      const pr = value.projection || {};
      value.projection = {
        aiPerNote: num(pr.aiPerNote, 10), charsNote: Math.round(num(pr.charsNote, 20_000)), hostingPer10k: num(pr.hostingPer10k, 10_000),
        voicePlans: (Array.isArray(pr.voicePlans) ? pr.voicePlans : []).slice(0, 8).map((v: any) => ({ name: str(v?.name, 40) || 'A plan', fee: num(v?.fee), credits: Math.round(num(v?.credits, 1e10)), overPer1k: num(v?.overPer1k, 100) })),
      };
    }
    await this.cfg.set(key as ConfigKey, value);
    return { ok: true, value: (await this.cfg.all())[key] };
  }
  @Post('config/:key/reset')
  async reset(@Param('key') key: string) {
    if (!CONFIG_KEYS.includes(key as ConfigKey)) throw new NotFoundException();
    await this.prisma.config.deleteMany({ where: { key } }); this.cfg.invalidate();
    return { ok: true, value: (await this.cfg.all())[key] };
  }
  /** Insights and the public counts start from now (testing before launch is left out; nothing is deleted). */
  @Post('count-from')
  async countFrom(@Body() b: any) { const site = await this.cfg.site(); await this.cfg.set('site', { ...site, countFrom: b?.clear ? null : new Date().toISOString() }); return { ok: true }; }

  @Get('insights') report(@Query('days') days?: string) { return this.insights.report(Number(days) || 0); }
  /** What the site has cost, month by month, what's been paid towards it, and what it takes to keep it running. */
  @Get('costs') costReport() { return this.costs.report(); }

  // ---- notes ----
  @Get('notes')
  async notes(@Query('filter') filter?: string, @Query('before') before?: string, @Query('q') q?: string) {
    const where: any = {};
    if (filter === 'serious') where.status = 'serious';
    else if (filter === 'flagged') where.flags = { hasSome: ['injection', 'refusal', 'error', 'danger-words'] };
    else if (filter === 'fallback') where.fallback = true;
    else if (filter === 'hidden') where.hidden = true;
    else if (filter === 'seen') where.seenAt = { not: null };
    else if (filter && ['love', 'not_love', 'nonsense'].includes(filter)) where.kind = filter;
    if (before) where.seq = { lt: Number(before) };
    if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { dear: { contains: q, mode: 'insensitive' } }, { statement: { contains: q, mode: 'insensitive' } }];
    const rows = await this.prisma.note.findMany({ where, orderBy: { seq: 'desc' }, take: 40, select: { ...NOTE_COLUMNS, notebook: { select: { name: true, city: true, backOf: true } }, _count: { select: { asks: true } } } });
    return rows.map((k) => ({ id: k.id, seq: k.seq, noteNo: noteNo(k.seq), code: k.code, n: k.n, dear: k.dear, title: k.title, status: k.status, kind: k.kind, seen: !!k.seenAt, flags: k.flags, fallback: k.fallback, hidden: k.hidden, createdAt: k.createdAt, writer: k.notebook.name, city: k.notebook.city, back: !!k.notebook.backOf, asks: k._count.asks, ms: k.ms }));
  }
  @Get('notes/:id')
  async one(@Param('id') id: string) {
    const k = await this.prisma.note.findUnique({ where: { id }, select: { ...NOTE_COLUMNS, notebook: { select: { code: true, name: true, city: true, createdAt: true } }, asks: true } });
    if (!k) throw new NotFoundException();
    return {
      ...k, noteNo: noteNo(k.seq),
      notebook: { code: k.notebook.code, name: k.notebook.name, city: k.notebook.city, createdAt: k.notebook.createdAt },
      asks: k.asks.map((a) => ({ channel: a.channel, status: a.status, senderName: a.senderName, recipientName: a.recipientName, recipientMask: a.recipientMask, openedAt: a.openedAt, backAt: a.backAt, createdAt: a.createdAt })),
    };
  }
  @Post('notes/:id/hide')
  async hide(@Param('id') id: string, @Body() b: any) { await this.prisma.note.update({ where: { id }, data: { hidden: !!b?.hidden }, select: { id: true } }); return { ok: true }; }

  // ---- people ----
  @Get('asks')
  async asks() {
    const rows = await this.prisma.ask.findMany({ orderBy: { createdAt: 'desc' }, take: 60, include: { note: { select: { seq: true, title: true, dear: true } } } });
    return rows.map((a) => ({ code: a.code, channel: a.channel, status: a.status, senderName: a.senderName, recipientName: a.recipientName, recipientMask: a.recipientMask, noteNo: noteNo(a.note.seq), title: a.note.title, dear: a.note.dear, openedAt: a.openedAt, backAt: a.backAt, createdAt: a.createdAt }));
  }
  @Get('contacts')
  async contacts(@Query('format') format?: string, @Res({ passthrough: true }) res?: Response) {
    const rows = await this.prisma.contact.findMany({ orderBy: { createdAt: 'desc' }, take: format === 'csv' ? 100_000 : 200 });
    if (format === 'csv' && res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="peruzzi-asks-contacts.csv"');
      const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      return ['email,name,agreed_to_news,agreed_at,verified,unsubscribed,source,created_at', ...rows.map((c) => [c.email, c.name, c.marketing && !c.unsubscribedAt ? 'yes' : 'no', c.marketingAt?.toISOString(), c.verifiedAt ? 'yes' : 'no', c.unsubscribedAt ? 'yes' : 'no', c.source, c.createdAt.toISOString()].map(q).join(','))].join('\n');
    }
    return { total: await this.prisma.contact.count(), news: await this.prisma.contact.count({ where: { marketing: true, unsubscribedAt: null } }), rows: rows.map((c) => ({ email: c.email, name: c.name, marketing: c.marketing && !c.unsubscribedAt, verified: !!c.verifiedAt, unsubscribed: !!c.unsubscribedAt, source: c.source, createdAt: c.createdAt })) };
  }

  // ---- emails ----
  @Post('emails/test')
  async testEmail(@Body() b: any) {
    const kind = String(b?.kind) as EmailKind; const to = String(b?.to || '').trim();
    const t = (await this.cfg.emails())[kind]; if (!t || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) throw new BadRequestException('kind or address');
    const site = await this.cfg.site();
    const m = renderEmail(t, {
      vars: { code: '402719', sender: 'Tọ́kẹ́', senderMask: 't***@gmail.com', recipient: 'Dayo', name: 'Tọ́kẹ́', site: this.cfg.siteName, artist: site.artist, song: site.song },
      boxes: kind === 'code' ? [] : [{ noteNo: '0042', title: 'Last Puff-Puff', dear: 'Dayo', line: 'You smuggled the last puff-puff past six hungry cousins, just for me.', verdict: 'Preferential Treatment' }],
      links: { cta: `${this.cfg.webUrl}/`, cta2: `${this.cfg.webUrl}/`, cta3: site.smartLink },
      unsubscribe: kind === 'code' ? undefined : { url: `${this.cfg.webUrl}`, label: kind === 'ask' ? 'Never send me notes again' : 'Stop these emails' },
    });
    const r = await this.mail.send(to, `[Test] ${m.subject}`, m.html, m.text);
    return { ok: r.ok, dryRun: !!(r as any).dryRun, html: m.html };
  }
  /** The emails a local run would have sent (only when no email service is connected). */
  @Get('outbox') outbox() { return process.env.RESEND_API_KEY ? [] : this.mail.outbox; }

  // ---- voice ----
  @Get('voice-lines')
  async voiceLines() {
    const rows = await this.prisma.voiceLine.findMany({ select: { key: true, updatedAt: true, mime: true } });
    return Object.entries(FIXED_LINES).map(([key, text]) => ({ key, text, recorded: rows.find((r) => r.key === key)?.updatedAt ?? null }));
  }
  @Put('voice-lines/:key')
  async upload(@Param('key') key: string, @Req() req: Request) {
    if (!(key in FIXED_LINES)) throw new NotFoundException();
    const body = req.body as Buffer; const mime = String(req.headers['content-type'] || '').split(';')[0];
    if (!Buffer.isBuffer(body) || body.length < 500 || !AUDIO.test(mime)) throw new BadRequestException('Send an audio file (mp3, m4a, wav).');
    await this.prisma.voiceLine.upsert({ where: { key }, create: { key, audio: body, mime }, update: { audio: body, mime } });
    return { ok: true };
  }
  @Delete('voice-lines/:key')
  async removeLine(@Param('key') key: string) { await this.prisma.voiceLine.deleteMany({ where: { key } }); return { ok: true }; }
  @Get('voice-lines/:key/audio')
  async lineAudio(@Param('key') key: string, @Res() res: Response) {
    const rec = await this.prisma.voiceLine.findUnique({ where: { key } }); if (!rec) { res.status(404).end(); return; }
    res.setHeader('Content-Type', rec.mime); res.send(Buffer.from(rec.audio));
  }
  // ---- the crowd's voices ----
  @Get('sounds') soundList() { return this.sounds.list(); }
  @Get('sounds/:kind/audio')
  async soundAudio(@Param('kind') kind: string, @Res() res: Response) {
    const rec = await this.sounds.audio(kind); if (!rec) { res.status(404).end(); return; }
    res.setHeader('Content-Type', rec.mime); res.send(Buffer.from(rec.audio));
  }
  @Post('sounds/:kind/make')
  async makeSound(@Param('kind') kind: string) {
    if (!(kind in GALLERY_SOUNDS)) throw new NotFoundException();
    if (!this.sounds.canMake) throw new BadRequestException('Add ELEVENLABS_API_KEY on the server first.');
    if (!(await this.sounds.make(kind))) throw new BadRequestException(this.sounds.problems.get(kind) || 'ElevenLabs couldn’t make it. Check the key and its credits, then try again.');
    return this.sounds.list();
  }
  @Put('sounds/:kind')
  async uploadSound(@Param('kind') kind: string, @Req() req: Request) {
    if (!(kind in GALLERY_SOUNDS)) throw new NotFoundException();
    const body = req.body as Buffer; const mime = String(req.headers['content-type'] || '').split(';')[0];
    if (!Buffer.isBuffer(body) || body.length < 500 || !AUDIO.test(mime)) throw new BadRequestException('Send an audio file (mp3, m4a, wav).');
    await this.sounds.save(kind, body, mime, 'upload');
    return this.sounds.list();
  }
  @Delete('sounds/:kind')
  async removeSound(@Param('kind') kind: string) { await this.sounds.remove(kind); return this.sounds.list(); }

  /** Hear the chosen voice read a line before switching it on. */
  @Post('voice/try')
  async tryVoice(@Body() b: any, @Res() res: Response) {
    const text = String(b?.text || FIXED_LINES.open).slice(0, 300);
    const voice = b?.voice === 'artist' ? process.env.ELEVENLABS_VOICE_ID || '' : process.env.ELEVENLABS_MC_VOICE_ID || (await this.cfg.stage()).voice.mcVoiceId;
    // say exactly what's wrong: the key not live yet, no voice ID, or what ElevenLabs said
    if (!this.voice.ready) throw new BadRequestException('The running server doesn’t have ELEVENLABS_API_KEY yet. If you’ve just added it on Railway, deploy the change: Railway only applies new variables when the service redeploys.');
    if (!voice) throw new BadRequestException(b?.voice === 'artist' ? 'ELEVENLABS_VOICE_ID isn’t set on the server.' : 'Set the MC’s voice ID first.');
    const a = await this.voice.speak(voice, text);
    if (!a) throw new BadRequestException(this.voice.problem || 'ElevenLabs didn’t send any audio back. Try again in a moment.');
    // a POST answers 201 unless told otherwise, and this one is a plain reading, not something created
    res.status(200).setHeader('Content-Type', a.mime); res.send(a.audio);
  }
}
