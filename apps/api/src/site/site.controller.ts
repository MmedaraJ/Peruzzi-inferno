import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '../common/config.service';
import { PrismaService } from '../common/prisma.service';

/** What every page may want: the artist and the song, the footnotes, and how many notes Peruzzi has asked. */
@Controller('api')
export class SiteController {
  constructor(private cfg: ConfigService, private prisma: PrismaService) {}
  /** Up, with the database answering within a few seconds (Railway's health check): 200 { ok: true }, or 503. */
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    let timer: NodeJS.Timeout | undefined;
    const ok = await Promise.race([
      this.prisma.$queryRaw`SELECT 1`.then(() => true, () => false),
      new Promise<boolean>((r) => { timer = setTimeout(() => r(false), 3000); }),
    ]).finally(() => clearTimeout(timer));
    res.status(ok ? 200 : 503);
    return { ok };
  }
  /** The same for everyone, and asked for by every page as it opens: Vercel's CDN may keep it for a few seconds (an
   *  admin change shows within a minute), so most visitors get it from nearby instead of from the server. */
  @Get('site')
  @Header('Cache-Control', 'public, max-age=10, stale-while-revalidate=50')
  async site() {
    const [site, from] = await Promise.all([this.cfg.site(), this.cfg.countFrom()]);
    const since = from ? { gte: from } : undefined;
    const [asked, answered] = await Promise.all([
      this.prisma.note.count({ where: { status: 'asked', ...(since ? { createdAt: since } : {}) } }),
      this.prisma.note.count({ where: { answer: { not: null }, ...(since ? { createdAt: since } : {}) } }),
    ]);
    const { countFrom: _c, ...pub } = site;
    return { ...pub, stats: { asked, answered } };
  }
}
