import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '../common/config.service';
import { esc } from '../common/util';

/** The shared links: /q/:code (a note someone posted), /a/:code (a note sent to the person it's for: the key to
 *  opening it) and /t/:code (a tracklist). WhatsApp and the like read the preview from this page; a person is sent
 *  straight on into the site, on the same address they came in on, so a server that wasn't told the site's address
 *  can't send anyone to the wrong place. */
@Controller()
export class PreviewController {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  @Get('q/:code')
  async note(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const k = await this.prisma.note.findUnique({ where: { code: String(code).slice(0, 16) }, select: { id: true, code: true, hidden: true, status: true, dear: true, line: true, notebook: { select: { name: true } } } });
    const ok = k && !k.hidden && k.status === 'asked';
    const title = ok ? `${k!.notebook.name || 'Someone'} asked Peruzzi to ask ${k!.dear}: could this be love?` : 'Peruzzi Asks';
    const desc = (ok ? `${k!.line} Peruzzi asks: could this be love?` : 'Write someone a note. Peruzzi will ask them for you.').slice(0, 190);
    // whether a phone has sent its card yet, asked without reading the image
    const card = ok && (await this.prisma.note.count({ where: { id: k!.id, card: { not: null } } })) > 0;
    const img = card ? `${this.cfg.apiFor(req)}/api/cards/n/${k!.code}.jpg` : `${this.cfg.siteFor(req)}/media/img/og.jpg`;
    this.send(req, res, title, desc, img, `/question/${encodeURIComponent(code)}`);
  }

  /** The note sent to the person it's for. Its preview keeps the note folded: the name, who it's from, and the
   *  question. What it says is for them to open. */
  @Get('a/:code')
  async ask(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const a = await this.prisma.ask.findUnique({ where: { code: String(code).slice(0, 16) }, select: { senderName: true, recipientName: true, note: { select: { hidden: true, status: true, dear: true } } } });
    const ok = a && !a.note.hidden && a.note.status === 'asked';
    const who = ok ? a!.recipientName || a!.note.dear : '';
    const title = ok ? `${who}, Peruzzi asked you something` : 'Peruzzi Asks';
    const desc = ok ? `A note from ${a!.senderName}. Could this be love? Open it to see.` : 'Write someone a note. Peruzzi will ask them for you.';
    this.send(req, res, title, desc, `${this.cfg.siteFor(req)}/media/img/og-ask.jpg`, `/answer/${encodeURIComponent(code)}`);
  }

  @Get('t/:code')
  async tracklist(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const d = await this.prisma.notebook.findUnique({ where: { code: String(code).slice(0, 16) }, select: { id: true, code: true, name: true, _count: { select: { notes: { where: { status: 'asked', hidden: false } } } } } });
    const n = d?._count.notes ?? 0; const ok = d && n > 0;
    const title = ok ? `${d!.name ? `${d!.name}’s tracklist` : 'A tracklist'}: ${n} ${n === 1 ? 'note' : 'notes'} Peruzzi asked` : 'Peruzzi Asks';
    const card = ok && (await this.prisma.notebook.count({ where: { id: d!.id, card: { not: null } } })) > 0;
    const img = card ? `${this.cfg.apiFor(req)}/api/cards/t/${d!.code}.jpg` : `${this.cfg.siteFor(req)}/media/img/og.jpg`;
    this.send(req, res, title, 'Every note Peruzzi asked for them. Who’s on your mind?', img, `/tracks/${encodeURIComponent(code)}`);
  }

  /** The preview, then on into the site: `path` is the page there, opened on the address the link was opened on. */
  private send(req: Request, res: Response, title: string, desc: string, img: string, path: string) {
    const url = `${this.cfg.siteFor(req)}${path}`;
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(path)}"></head><body style="background:#1d1418"><a href="${esc(path)}" style="color:#f7ecee">Open Peruzzi Asks</a><script>location.replace(${JSON.stringify(path)})</script></body></html>`);
  }
}
