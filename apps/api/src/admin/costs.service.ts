import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '../common/config.service';
import { CostItem, CostsConfig, Payment } from '../common/defaults';
import { aiCost } from '../common/prices';

type Tokens = { k: string; model: string | null; i: bigint | null; o: bigint | null; r: bigint | null; w: bigint | null; n: bigint };
type Chars = { k: string; c: bigint | null; n: bigint };
const cents = (x: number) => Math.round(x * 100) / 100;
/** The site keeps Lagos time: a month or a day as it is there. */
const lagos = (d: Date) => new Date(d.getTime() + 3600_000).toISOString();
function monthsFrom(a: string, b: string) {
  const out: string[] = []; let [y, m] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number);
  while (y < y2 || (y === y2 && m <= m2)) { out.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } }
  return out;
}
/** ElevenLabs' credits for a character: half a credit on its quick models, one on the rest. */
const creditsPerChar = () => (/flash|turbo/i.test(process.env.ELEVENLABS_MODEL_ID || '') ? 0.5 : 1);

/** What a bill comes to in a month: a monthly one every month it runs, a yearly one in the month it renews, a one-off
 *  in its month. `first` stands in for a bill that started with the site. */
export function billFor(it: CostItem, month: string, first: string) {
  const start = /^\d{4}-\d{2}/.test(it.from || '') ? it.from.slice(0, 7) : first;
  const end = /^\d{4}-\d{2}/.test(it.until || '') ? it.until!.slice(0, 7) : null;
  if (month < start || (end && month > end) || !(it.amount > 0)) return 0;
  if (it.every === 'year') return month.slice(5) === start.slice(5) ? it.amount : 0;
  if (it.every === 'once') return month === start ? it.amount : 0;
  return it.amount;
}
/** A payment in dollars: naira at the rate it was paid at (or today's, if it wasn't given). */
export const paidUsd = (p: Payment, rate: number) => (p.currency === 'NGN' ? ((p.rate || rate) > 0 ? p.amount / (p.rate || rate) : 0) : p.amount);

/** What the site costs to run, in dollars: what the AI and the voice have used (from what the site keeps of each:
 *  every note's tokens, every reading drafted and not used, every voice reading's characters), the bills set in the admin (hosting, plans),
 *  what has been paid towards it all, and what's left to pay. Usage is priced at list prices, so it's an estimate:
 *  the providers' own bills are the record. */
@Injectable()
export class CostsService {
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  async report() {
    const c: CostsConfig = await this.cfg.costs();
    const now = new Date(); const thisMonth = lagos(now).slice(0, 7); const since = new Date(now.getTime() - 30 * 86400_000);
    const [notesM, draftsM, voiceM, notesD, draftsD, voice30, notes30, firstNotebook] = await Promise.all([
      this.prisma.$queryRaw<Tokens[]>`SELECT to_char("createdAt" + interval '1 hour', 'YYYY-MM') AS k, model, SUM("tokensIn")::bigint AS i, SUM("tokensOut")::bigint AS o, SUM("cacheRead")::bigint AS r, SUM("cacheWrite")::bigint AS w, COUNT(*)::bigint AS n FROM "Note" GROUP BY 1, 2`,
      this.prisma.$queryRaw<Tokens[]>`SELECT to_char(at + interval '1 hour', 'YYYY-MM') AS k, model, SUM("tokensIn")::bigint AS i, SUM("tokensOut")::bigint AS o, SUM("cacheRead")::bigint AS r, SUM("cacheWrite")::bigint AS w, COUNT(*)::bigint AS n FROM "AiUse" GROUP BY 1, 2`,
      this.prisma.$queryRaw<Chars[]>`SELECT to_char("createdAt" + interval '1 hour', 'YYYY-MM') AS k, SUM(length(text))::bigint AS c, COUNT(*)::bigint AS n FROM "VoiceClip" GROUP BY 1`,
      this.prisma.$queryRaw<Tokens[]>`SELECT to_char("createdAt" + interval '1 hour', 'YYYY-MM-DD') AS k, model, SUM("tokensIn")::bigint AS i, SUM("tokensOut")::bigint AS o, SUM("cacheRead")::bigint AS r, SUM("cacheWrite")::bigint AS w, COUNT(*)::bigint AS n FROM "Note" WHERE "createdAt" >= ${since} GROUP BY 1, 2`,
      this.prisma.$queryRaw<Tokens[]>`SELECT to_char(at + interval '1 hour', 'YYYY-MM-DD') AS k, model, SUM("tokensIn")::bigint AS i, SUM("tokensOut")::bigint AS o, SUM("cacheRead")::bigint AS r, SUM("cacheWrite")::bigint AS w, COUNT(*)::bigint AS n FROM "AiUse" WHERE at >= ${since} GROUP BY 1, 2`,
      this.prisma.$queryRaw<Chars[]>`SELECT 'all' AS k, SUM(length(text))::bigint AS c, COUNT(*)::bigint AS n FROM "VoiceClip" WHERE "createdAt" >= ${since}`,
      this.prisma.note.count({ where: { createdAt: { gte: since } } }),
      this.prisma.notebook.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);
    const cost = (rows: Tokens[], k: string) => rows.filter((r) => r.k === k).reduce((s, r) => s + aiCost(r.model, { in: r.i, out: r.o, cacheRead: r.r, cacheWrite: r.w }), 0);
    const count = (rows: { k: string; n: bigint }[], k: string) => rows.filter((r) => r.k === k).reduce((s, r) => s + Number(r.n), 0);
    const perChar = creditsPerChar();
    const over = (chars: number) => (Math.max(0, chars * perChar - Math.max(0, c.voice.credits)) / 1000) * Math.max(0, c.voice.overPer1k);

    // the months the site has run: from its first note (or the first bill set to start earlier) to now
    const first = [firstNotebook ? lagos(firstNotebook.createdAt).slice(0, 7) : thisMonth, ...notesM.map((r) => r.k), ...voiceM.map((r) => r.k),
      ...c.items.map((it) => (/^\d{4}-\d{2}/.test(it.from || '') && it.amount > 0 ? it.from.slice(0, 7) : thisMonth))].sort()[0];
    const months = monthsFrom(first < thisMonth ? first : thisMonth, thisMonth).map((month) => {
      const peruzzi = cost(notesM, month); const drafts = cost(draftsM, month);
      const chars = voiceM.filter((r) => r.k === month).reduce((s, r) => s + Number(r.c ?? 0), 0);
      const bills = c.items.map((it) => ({ id: it.id, name: it.name, amount: billFor(it, month, first) })).filter((b) => b.amount > 0);
      const plans = bills.reduce((s, b) => s + b.amount, 0); const voice = over(chars);
      return { month, ai: cents(peruzzi + drafts), peruzzi: cents(peruzzi), drafts: cents(drafts), notes: count(notesM, month), draftCount: count(draftsM, month),
        voice: cents(voice), chars, plans: cents(plans), bills, total: cents(peruzzi + drafts + voice + plans) };
    });

    const days = Array.from({ length: 30 }, (_, i) => lagos(new Date(now.getTime() - (29 - i) * 86400_000)).slice(0, 10))
      .map((day) => ({ day, ai: cents(cost(notesD, day) + cost(draftsD, day)), notes: count(notesD, day) }));
    const payments = [...c.payments].sort((a, b) => (a.at < b.at ? 1 : -1)).map((p) => ({ ...p, usd: cents(paidUsd(p, c.rate)) }));
    const incurred = months.reduce((s, m) => s + m.total, 0); const paid = payments.reduce((s, p) => s + p.usd, 0);
    // to keep it running: the bills as they stand, and the AI and the voice at the last 30 days' pace
    const ai30 = days.reduce((s, d) => s + d.ai, 0); const chars30 = Number(voice30[0]?.c ?? 0);
    const bills = c.items.filter((it) => !it.until || it.until.slice(0, 7) >= thisMonth).reduce((s, it) => s + (it.every === 'month' ? it.amount : it.every === 'year' ? it.amount / 12 : 0), 0);
    const current = months[months.length - 1];
    return {
      rate: c.rate, firstDay: firstNotebook?.createdAt ?? null,
      totals: { incurred: cents(incurred), paid: cents(paid), owed: cents(incurred - paid), thisMonth: current.total },
      monthly: { total: cents(bills + ai30 + over(chars30)), bills: cents(bills), ai: cents(ai30), voice: cents(over(chars30)), notes: notes30,
        perNote: notes30 ? Math.round((ai30 / notes30) * 10000) / 10000 : 0, charsPerNote: notes30 ? Math.round(chars30 / notes30) : 0 },
      voice: { chars: current.chars, credits: Math.round(current.chars * perChar), plan: c.voice.credits, perChar },
      months, days, payments, unit: await this.unit(now, c, perChar),
    };
  }

  /** What a note costs now, for projections: measured over the last 30 days, or since the start, once there are
   *  enough notes to go by; the assumptions in the settings until then. */
  private async unit(now: Date, c: CostsConfig, perChar: number) {
    const ENOUGH = 20;
    const measured = async (from: Date) => {
      const [read, drafts, voice] = await Promise.all([
        this.prisma.$queryRaw<Tokens[]>`SELECT 'all' AS k, model, SUM("tokensIn")::bigint AS i, SUM("tokensOut")::bigint AS o, SUM("cacheRead")::bigint AS r, SUM("cacheWrite")::bigint AS w, COUNT(*)::bigint AS n FROM "Note" WHERE "tokensIn" > 0 AND "createdAt" >= ${from} GROUP BY 2`,
        this.prisma.$queryRaw<Tokens[]>`SELECT 'all' AS k, model, SUM("tokensIn")::bigint AS i, SUM("tokensOut")::bigint AS o, SUM("cacheRead")::bigint AS r, SUM("cacheWrite")::bigint AS w, COUNT(*)::bigint AS n FROM "AiUse" WHERE kind = 'draft' AND at >= ${from} GROUP BY 2`,
        // what the voice reads for a note: their name, what they did, "Could this be love?" and the answer (see noteReading)
        this.prisma.$queryRaw<{ n: bigint; chars: number | null }[]>`SELECT COUNT(*)::bigint AS n,
          AVG(length(dear) + length(COALESCE(line, '')) + length(COALESCE(verdict, '')) + 24)::float AS chars
          FROM "Note" WHERE status = 'asked' AND "createdAt" >= ${from}`,
      ]);
      const notes = read.reduce((s, r) => s + Number(r.n), 0);
      const spent = [...read, ...drafts].reduce((s, r) => s + aiCost(r.model, { in: r.i, out: r.o, cacheRead: r.r, cacheWrite: r.w }), 0);
      const v = voice[0];
      return { notes, ai: notes ? spent / notes : 0, asked: Number(v?.n ?? 0), chars: v?.chars ?? 0 };
    };
    const recent = await measured(new Date(now.getTime() - 30 * 86400_000));
    const all = recent.notes >= ENOUGH && recent.asked >= ENOUGH ? recent : await measured(new Date(0));
    const ai = recent.notes >= ENOUGH ? recent : all.notes >= ENOUGH ? all : null;
    const voice = recent.asked >= ENOUGH ? recent : all.asked >= ENOUGH ? all : null;
    const p = c.projection;
    return {
      aiPerNote: ai ? Math.round(ai.ai * 10000) / 10000 : p.aiPerNote, aiNotes: ai?.notes ?? 0,
      charsNote: voice ? Math.round(voice.chars) : p.charsNote, voiceNotes: voice?.asked ?? 0,
      creditsPerChar: perChar,
    };
  }
}
