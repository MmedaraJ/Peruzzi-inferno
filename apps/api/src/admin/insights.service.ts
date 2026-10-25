import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '../common/config.service';
import { aiCost } from '../common/prices';
import { peruzziModel } from '../stage/peruzzi';

/** Totals only: what people did, never what they wrote. */
@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  async report(days: number) {
    const from = await this.cfg.countFrom();
    const since = new Date(Math.max(from?.getTime() ?? 0, days > 0 ? Date.now() - days * 86400_000 : 0));
    const at = { gte: since };
    const people = async (names: string[]) => {
      const r = await this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT device) AS n FROM "Event" WHERE name IN (${Prisma.join(names)}) AND at >= ${since} AND device IS NOT NULL`;
      return Number(r[0]?.n ?? 0);
    };
    const count = (name: string) => this.prisma.event.count({ where: { name, at } });

    const [visitors, opened, wrote, asked, sentPeople, tracklists, notes, kinds, answers, dears, cities, asksByChannel, seen, backs, contacts, marketing, streamClicks, serious, fallbacks, usage, perDay, perHour] = await Promise.all([
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT device) AS n FROM "Event" WHERE at >= ${since} AND device IS NOT NULL`.then((r) => Number(r[0]?.n ?? 0)),
      people(['stage_view']), people(['note_written']), people(['note_asked']),
      people(['note_share', 'note_save', 'ask_link', 'ask_email']), people(['tracklist_made']),
      this.prisma.note.count({ where: { createdAt: at } }),
      this.prisma.note.groupBy({ by: ['kind'], where: { createdAt: at, status: 'asked' }, _count: { _all: true } }),
      this.prisma.note.groupBy({ by: ['answer'], where: { createdAt: at, answer: { not: null } }, _count: { _all: true } }),
      this.prisma.note.groupBy({ by: ['dear'], where: { createdAt: at }, _count: { _all: true }, orderBy: { _count: { dear: 'desc' } }, take: 10 }),
      this.prisma.notebook.groupBy({ by: ['city'], where: { createdAt: at, city: { not: null } }, _count: { _all: true }, orderBy: { _count: { city: 'desc' } }, take: 10 }),
      this.prisma.ask.groupBy({ by: ['channel', 'status'], where: { createdAt: at }, _count: { _all: true } }),
      this.prisma.note.count({ where: { createdAt: at, seenAt: { not: null } } }),
      this.prisma.ask.count({ where: { backAt: at } }),
      this.prisma.contact.count({ where: { createdAt: at } }),
      this.prisma.contact.count({ where: { marketingAt: at, marketing: true } }),
      count('stream_click'),
      this.prisma.note.count({ where: { createdAt: at, status: 'serious' } }),
      this.prisma.note.count({ where: { createdAt: at, fallback: true } }),
      this.prisma.note.groupBy({ by: ['model'], where: { createdAt: at }, _sum: { tokensIn: true, tokensOut: true, cacheRead: true, cacheWrite: true, ms: true }, _count: { _all: true } }),
      this.prisma.$queryRaw<{ day: string; n: bigint }[]>`SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos')::date, 'YYYY-MM-DD') AS day, COUNT(*) AS n FROM "Note" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ h: number; n: bigint }[]>`SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos'))::int AS h, COUNT(*) AS n FROM "Note" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    ]);

    let cost = 0; let tokensIn = 0; let tokensOut = 0; let thinkMs = 0; let withUsage = 0;
    // readings drafted and never used are the AI's work too
    for (const u of await this.prisma.aiUse.groupBy({ by: ['model'], where: { at }, _sum: { tokensIn: true, tokensOut: true, cacheRead: true, cacheWrite: true } })) {
      cost += aiCost(u.model, { in: u._sum.tokensIn, out: u._sum.tokensOut, cacheRead: u._sum.cacheRead, cacheWrite: u._sum.cacheWrite });
    }
    for (const u of usage) {
      const s = u._sum;
      cost += aiCost(u.model, { in: s.tokensIn, out: s.tokensOut, cacheRead: s.cacheRead, cacheWrite: s.cacheWrite });
      tokensIn += (s.tokensIn ?? 0) + (s.cacheRead ?? 0) + (s.cacheWrite ?? 0); tokensOut += s.tokensOut ?? 0; thinkMs += s.ms ?? 0; withUsage += u._count._all;
    }
    const sum = (rows: { _count: { _all: number } }[]) => rows.reduce((a, r) => a + r._count._all, 0);
    const answered = sum(answers);
    const yes = answers.find((r) => r.answer === 'yes')?._count._all ?? 0;
    const hours = Array.from({ length: 24 }, (_, h) => Number(perHour.find((r) => r.h === h)?.n ?? 0));
    return {
      since, counting: from,
      totals: {
        visitors, notes, asked: sum(kinds), tracklists,
        asksEmail: asksByChannel.filter((r) => r.channel === 'email' && r.status === 'sent').reduce((a, r) => a + r._count._all, 0),
        asksLinks: asksByChannel.filter((r) => r.channel === 'link').reduce((a, r) => a + r._count._all, 0),
        seen, answered, yes, yesRate: answered ? Math.round((yes / answered) * 100) : 0, backs, contacts, marketing, streamClicks, serious, fallbacks,
      },
      funnel: [
        { step: 'Opened the stage', people: opened }, { step: 'Wrote a note', people: wrote }, { step: 'Peruzzi read it', people: asked },
        { step: 'Sent, shared or saved it', people: sentPeople }, { step: 'Made a tracklist', people: tracklists },
      ],
      kinds: kinds.map((v) => ({ kind: v.kind, n: v._count._all })).sort((a, b) => b.n - a.n),
      answers: answers.map((v) => ({ answer: v.answer, n: v._count._all })).sort((a, b) => b.n - a.n),
      dears: dears.map((c) => ({ label: c.dear, n: c._count._all })),
      cities: cities.map((c) => ({ label: c.city, n: c._count._all })),
      perDay: perDay.map((r) => ({ day: r.day, n: Number(r.n) })),
      perHour: hours,
      ai: { model: peruzziModel(), cost: Math.round(cost * 100) / 100, perNote: withUsage ? Math.round((cost / withUsage) * 10000) / 10000 : 0, tokensIn, tokensOut, avgThinkSec: withUsage ? Math.round(thinkMs / withUsage / 100) / 10 : 0 },
    };
  }
}
