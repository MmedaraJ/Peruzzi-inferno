import { Body, Controller, Get, Header, HttpException, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { StageService } from './stage.service';
import { AsksService } from './asks.service';
import { VoiceService } from './voice.service';
import { SoundService } from './sound.service';
import { noteReading } from './peruzzi';
import { PrismaService } from '../common/prisma.service';
import { ipOf } from '../common/util';

const str = (v: any, n = 2000) => (typeof v === 'string' ? v.slice(0, n) : v == null ? undefined : String(v).slice(0, n));

@Controller('api')
export class StageController {
  constructor(private stage: StageService, private asks: AsksService, private voice: VoiceService, private sounds: SoundService, private prisma: PrismaService) {}

  /** The same for everyone (see /api/site): kept nearby for a few seconds. Opening or pausing the stage still holds at
   *  once where it matters, as handing up a note checks it again. */
  @Get('stage/config') @Header('Cache-Control', 'public, max-age=10, stale-while-revalidate=50') async config() { const [c, sfx] = await Promise.all([this.stage.publicConfig(), this.sounds.available()]); return { ...c, sfx }; }

  @Post('notebooks')
  open(@Body() b: any, @Req() req: Request) { return this.stage.openNotebook(str(b?.device, 64) || '', ipOf(req), str(b?.back, 16)); }

  @Get('notebooks/:id')
  notebook(@Param('id') id: string, @Query('t') t: string) { return this.stage.getNotebook(id, t); }

  @Put('notebooks/:id')
  update(@Param('id') id: string, @Body() b: any) { return this.stage.updateNotebook(id, str(b?.token) || '', { name: str(b?.name, 40), city: str(b?.city, 40), tracklist: !!b?.tracklist }); }

  // "Dear … I think you …. Could this be love?": Peruzzi starts on it once the writer stops typing, then reads it
  @Post('notebooks/:id/draft')
  draft(@Param('id') id: string, @Body() b: any) { return this.stage.draft(id, str(b?.token) || '', { who: str(b?.who, 60) || '', what: str(b?.what, 160) || '' }); }
  @Post('notebooks/:id/ask')
  ask(@Param('id') id: string, @Body() b: any) { return this.stage.ask(id, str(b?.token) || '', { who: str(b?.who, 60) || '', what: str(b?.what, 160) || '', name: str(b?.name, 40) }); }

  @Post('notebooks/:id/email')
  emailTracklist(@Param('id') id: string, @Body() b: any) { return this.asks.emailTracklist(id, str(b?.token) || '', str(b?.email, 160) || '', !!b?.marketing); }

  // sending a note to the person it's for
  @Post('notes/:id/send')
  send(@Param('id') id: string, @Body() b: any) {
    if (b?.channel === 'email') return this.asks.email(id, str(b?.token) || '', { contactToken: str(b?.contactToken, 200) || '', senderName: str(b?.senderName, 40), recipientEmail: str(b?.recipientEmail, 160) || '', recipientName: str(b?.recipientName, 40) });
    return this.asks.link(id, str(b?.token) || '', str(b?.senderName, 40), str(b?.recipientName, 40));
  }
  // the person asked: the note, and their tick
  @Get('asks/:code') forAsk(@Param('code') code: string) { return this.asks.forAsk(code); }
  @Post('asks/:code/answer') answer(@Param('code') code: string, @Body() b: any) { return this.asks.answer(code, str(b?.answer, 12) || '', str(b?.device, 64)); }

  // the public pages behind the shared links
  @Get('n/:code') note(@Param('code') code: string) { return this.stage.publicNote(code); }
  @Get('t/:code') tracklist(@Param('code') code: string) { return this.stage.publicTracklist(code); }

  // the cards as the phones drew them, kept for link previews
  @Put('cards/:kind/:id')
  card(@Param('kind') kind: string, @Param('id') id: string, @Req() req: Request) {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length < 1000 || body.length > 3_000_000 || body[0] !== 0xff || body[1] !== 0xd8) throw new HttpException('jpeg only', 400);
    const k = kind === 'notebook' ? 'notebook' : kind === 'answer' ? 'answer' : 'note';
    return this.stage.saveCard(k, id, String(req.headers['x-token'] || ''), body);
  }
  @Get('cards/:kind/:code.jpg')
  async cardImage(@Param('kind') kind: string, @Param('code') code: string, @Res() res: Response) {
    const img = await this.stage.cardImage(kind === 't' ? 'notebook' : 'note', code);
    if (!img) { res.status(404).end(); return; }
    res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'public, max-age=300'); res.send(img);
  }

  // the voice: the fixed lines, and Peruzzi's line on a note (his own words only, never what was typed)
  @Get('voice/line/:key')
  async line(@Param('key') key: string, @Res() res: Response) { return this.sendAudio(res, await this.voice.fixed(key), 86400); }
  /** a note's reading, for the phone that wrote it (its notebook's token) or the one it was sent to (the ask's code) */
  @Get('voice/note/:id')
  async spoken(@Param('id') id: string, @Query('t') t: string | undefined, @Query('a') a: string | undefined, @Res() res: Response) {
    const k = await this.prisma.note.findUnique({ where: { id }, select: { status: true, dear: true, line: true, fallback: true, notebook: { select: { token: true } }, asks: a ? { where: { code: String(a).slice(0, 16) }, select: { id: true } } : false } });
    const allowed = !!k && k.status === 'asked' && ((!!t && k.notebook.token === t) || (!!a && (k as any).asks?.length > 0));
    if (!allowed) { res.status(404).end(); return; }
    return this.sendAudio(res, await this.voice.say(noteReading(k!)), 3600);
  }
  /** The crowd's voices. Asked for with the version from the config, a sound can be kept for good: a new one comes with
   *  a new version. The first ask for one that isn't made yet makes it, which takes a few seconds. */
  @Get('sfx/:kind')
  async sfx(@Param('kind') kind: string, @Query('v') v: string | undefined, @Res() res: Response) {
    const s = await this.sounds.get(kind);
    if (!s) { res.status(204).end(); return; }
    res.setHeader('Content-Type', s.mime); res.setHeader('Content-Length', String(s.audio.length));
    res.setHeader('Cache-Control', v && v === s.version ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.send(s.audio);
  }
  private sendAudio(res: Response, a: { audio: Buffer; mime: string } | null, maxAge: number) {
    if (!a) { res.status(204).end(); return; }
    res.setHeader('Content-Type', a.mime); res.setHeader('Cache-Control', `private, max-age=${maxAge}`); res.setHeader('Content-Length', String(a.audio.length)); res.send(a.audio);
  }
}

/** Proving an address with a code, before a note is emailed from it. (Addresses are only taken this way and for the
 *  tracklist: there's no open route that writes one, or the OK to hear from Peruzzi, on its own.) */
@Controller('api/contacts')
export class ContactsController {
  constructor(private asks: AsksService) {}
  @Post('code') code(@Body() b: any) { return this.asks.sendCode(str(b?.email, 160) || '', str(b?.device, 64)); }
  @Post('verify') verify(@Body() b: any) { return this.asks.verifyCode(str(b?.email, 160) || '', str(b?.code, 12) || '', str(b?.device, 64), str(b?.name, 40)); }
}

/** The opt-out links in every email: a page with one button (so a mail scanner opening the link changes nothing), and
 *  the one-click POST that mail apps send for the unsubscribe button. */
@Controller('api/u')
export class OptOutController {
  constructor(private asks: AsksService) {}
  @Get(':kind/:id/:sig')
  page(@Param('kind') kind: string, @Param('id') id: string, @Param('sig') sig: string, @Req() req: Request, @Res() res: Response) {
    if (!this.asks.checkOptOut(kind, id, sig)) { res.status(404).send('Not found'); return; }
    res.type('html').send(this.asks.optOutPage(kind, false, req.originalUrl));
  }
  @Post(':kind/:id/:sig')
  async done(@Param('kind') kind: string, @Param('id') id: string, @Param('sig') sig: string, @Res() res: Response) {
    if (!this.asks.checkOptOut(kind, id, sig)) { res.status(404).send('Not found'); return; }
    await this.asks.optOut(kind as 'block' | 'contact', id);
    res.type('html').send(this.asks.optOutPage(kind, true, ''));
  }
}

