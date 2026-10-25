import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '../common/config.service';
import { esc } from '../common/util';

/** What an answer reads as, wherever a note is quoted ("ticked Yes") */
export const answerLabel = (answer: string | null, escape: string | null) => (answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : answer === 'escape' ? `“${(escape || '').replace(/[.]$/, '')}”` : '');

/** The shared links: /q/:code (a note someone posted), /a/:code (a note sent to the person it's for: the key to
 *  answering it) and /t/:code (a tracklist). WhatsApp and the like read the preview from this page; a person is sent
 *  straight on into the site. */
@Controller()
export class PreviewController {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  @Get('q/:code')
  async note(@Param('code') code: string, @Res() res: Response) {
    const k = await this.prisma.note.findUnique({ where: { code: String(code).slice(0, 16) }, select: { id: true, code: true, hidden: true, status: true, dear: true, line: true, peruzzi: true, answer: true, escape: true, notebook: { select: { name: true } } } });
    const ok = k && !k.hidden && k.status === 'asked';
    const title = !ok ? 'Peruzzi Asked' : k!.answer ? `${k!.dear} answered Peruzzi: ${answerLabel(k!.answer, k!.escape)}` : `${k!.notebook.name || 'Someone'} asked Peruzzi to ask ${k!.dear}: could this be love?`;
    const desc = (ok ? `${k!.line} Peruzzi says: ${k!.peruzzi}` : 'Write someone a note. Peruzzi will ask them for you.').slice(0, 190);
    // whether a phone has sent its card yet, asked without reading the image
    const card = ok && (await this.prisma.note.count({ where: { id: k!.id, OR: [{ card: { not: null } }, { answerCard: { not: null } }] } })) > 0;
    const img = card ? `${this.cfg.apiUrl}/api/cards/n/${k!.code}.jpg` : `${this.cfg.webUrl}/media/img/og.jpg`;
    this.send(res, title, desc, img, `${this.cfg.webUrl}/question/${encodeURIComponent(code)}`);
  }

  /** The note sent to the person it's for. Its preview keeps the note folded: the name, who it's from, and the
   *  question. What it says is for them to open. */
  @Get('a/:code')
  async ask(@Param('code') code: string, @Res() res: Response) {
    const a = await this.prisma.ask.findUnique({ where: { code: String(code).slice(0, 16) }, select: { senderName: true, recipientName: true, note: { select: { hidden: true, status: true, dear: true, answer: true, escape: true } } } });
    const ok = a && !a.note.hidden && a.note.status === 'asked';
    const who = ok ? a!.recipientName || a!.note.dear : '';
    const title = !ok ? 'Peruzzi Asked' : a!.note.answer ? `${who} answered Peruzzi: ${answerLabel(a!.note.answer, a!.note.escape)}` : `${who}, Peruzzi asked you something`;
    const desc = ok ? `A note from ${a!.senderName}. Could this be love? Open it and tick your answer.` : 'Write someone a note. Peruzzi will ask them for you.';
    this.send(res, title, desc, `${this.cfg.webUrl}/media/img/og-ask.jpg`, `${this.cfg.webUrl}/answer/${encodeURIComponent(code)}`);
  }

  @Get('t/:code')
  async tracklist(@Param('code') code: string, @Res() res: Response) {
    const d = await this.prisma.notebook.findUnique({ where: { code: String(code).slice(0, 16) }, select: { id: true, code: true, name: true, _count: { select: { notes: { where: { status: 'asked', hidden: false } } } } } });
    const n = d?._count.notes ?? 0; const ok = d && n > 0;
    const title = ok ? `${d!.name ? `${d!.name}’s tracklist` : 'A tracklist'}: ${n} ${n === 1 ? 'note' : 'notes'} Peruzzi asked` : 'Peruzzi Asked';
    const card = ok && (await this.prisma.notebook.count({ where: { id: d!.id, card: { not: null } } })) > 0;
    const img = card ? `${this.cfg.apiUrl}/api/cards/t/${d!.code}.jpg` : `${this.cfg.webUrl}/media/img/og.jpg`;
    this.send(res, title, 'Every note Peruzzi asked for them. Who’s on your mind?', img, `${this.cfg.webUrl}/tracks/${encodeURIComponent(code)}`);
  }

  private send(res: Response, title: string, desc: string, img: string, target: string) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(target)}"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}"></head><body style="background:#141210"><a href="${esc(target)}" style="color:#efe8dc">Open Peruzzi Asked</a><script>location.replace(${JSON.stringify(target)})</script></body></html>`);
  }
}
