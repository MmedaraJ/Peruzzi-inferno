import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Note, Notebook, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '../common/config.service';
import { EventsService } from '../events/events.service';
import { emailReady } from '../common/mail.service';
import { STAGE_DEFAULTS, StageConfig } from '../common/defaults';
import { code, firstName, noteNo, startOfDay, token as newToken } from '../common/util';
import { aiAvailable } from './ai';
import { clean, Cleaned } from './redact';
import { fallbackReading, fallbackVerdict } from './fallback';
import { noteReading, peruzziModel, read, Reading, ReadingResult, seriousReading } from './peruzzi';
import { VoiceService } from './voice.service';

export class TooMany extends HttpException { constructor(message: string, public reason: string) { super({ message, reason }, HttpStatus.TOO_MANY_REQUESTS); } }

/** What the writer says: "Dear <who>, you <what>." */
export interface WriteDto { who: string; what: string; name?: string }
/** Every column but the card images (JPEGs of up to 3 MB): only the endpoints that serve a card read them. */
export const NOTE_COLUMNS = {
  id: true, seq: true, code: true, notebookId: true, n: true, dear: true, thing: true, title: true, statement: true, status: true, kind: true,
  line: true, verdict: true, seenAt: true, fallback: true, flags: true, hidden: true,
  model: true, tokensIn: true, tokensOut: true, cacheRead: true, cacheWrite: true, ms: true, createdAt: true, askedAt: true,
} as const satisfies Prisma.NoteSelect;
export const NOTEBOOK_COLUMNS = { id: true, code: true, token: true, device: true, ip: true, name: true, city: true, backOf: true, tracklistAt: true, createdAt: true } as const satisfies Prisma.NotebookSelect;
type NotebookRow = Omit<Notebook, 'card'>;
type NoteRow = Omit<Note, 'card'>;
/** what an ask says about the note it carries */
const ASKED_NOTE = { select: { dear: true, line: true } } as const;
/** The most notes a tracklist's page lists (its newest); its count says how many it holds in all. */
const TRACKLIST_SHOWN = 30;
/** How long the stage waits for Peruzzi's reading before a prepared one stands in. */
const READING_DEADLINE = 9000;
/** What Peruzzi says, out of character, when a note describes real harm. */
const SERIOUS_LINE = 'Thank you for trusting me with this. What you’ve written matters more than any song, and you deserve real support.';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
type Words = { who: Cleaned; what: Cleaned };
type Draft = { at: number; run: Promise<ReadingResult | null>; used: boolean };
const HOUR = 3600_000;
/** A notebook's drafts start this far apart at most: words that come sooner wait for the gap (only the latest words). */
const DRAFT_GAP = 3000;

/** When the paid calls to the AI of the last hour were made. */
class LastHour {
  private times: number[] = [];
  count(now = Date.now()) { let i = 0; while (i < this.times.length && now - this.times[i] >= HOUR) i++; if (i) this.times.splice(0, i); return this.times.length; }
  /** one more, if the ceiling leaves room for it */
  take(ceiling: number, now = Date.now()) { if (this.count(now) >= ceiling) return false; this.times.push(now); return true; }
}

/** A note as the phone that wrote it sees it: what Peruzzi made of it, and how far it's got (sent, seen, written
 *  back to). */
export function noteView(k: NoteRow & { asks?: { backAt: Date | null }[] }) {
  return {
    id: k.id, code: k.code, noteNo: noteNo(k.seq), n: k.n, dear: k.dear, thing: k.thing, title: k.title, status: k.status,
    kind: k.kind, line: k.line, verdict: k.verdict, seenAt: k.seenAt, sent: (k.asks?.length ?? 0) > 0, wroteBack: !!k.asks?.some((a) => a.backAt), createdAt: k.createdAt,
  };
}
/** A note as anyone with its link sees it: the line as Peruzzi told it, never what was typed. */
export function publicNote(k: NoteRow, writer?: { name: string | null; city: string | null } | null) {
  return {
    code: k.code, noteNo: noteNo(k.seq), dear: k.dear, thing: k.thing, title: k.title, kind: k.kind,
    line: k.line || '', verdict: k.verdict,
    writer: writer?.name ?? null, city: writer?.city ?? null, date: k.askedAt || k.createdAt,
  };
}

@Injectable()
export class StageService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('stage');
  private sweeper: NodeJS.Timeout | null = null;
  /** one reading at a time per notebook: a second tap while Peruzzi reads is turned away */
  private busy = new Set<string>();
  /** readings started while the writer was still typing, by notebook and words; and when each notebook last had one */
  private drafts = new Map<string, Draft>();
  private drafted = new Map<string, number[]>();
  /** each notebook's last draft (its words), and words that came too soon after it, waiting for the gap */
  private lastWords = new Map<string, string>();
  private waiting = new Map<string, NodeJS.Timeout>();
  /** Peruzzi's last few answers, which go with the next notes so each gets its own */
  private lately: string[] = [];
  /** the paid calls to the AI in the last hour, readings and drafts, each held to its own hourly ceiling */
  private calls = { note: new LastHour(), draft: new LastHour() };
  private ceilingSaid = { note: 0, draft: 0 }; private connWarned = 0;
  constructor(private prisma: PrismaService, private cfg: ConfigService, private events: EventsService, private voice: VoiceService) {}

  onModuleInit() { this.sweeper = setInterval(() => this.forget().catch((e) => this.log.warn(`forget: ${e}`)), 6 * 3600_000); setTimeout(() => this.forget().catch(() => {}), 30_000).unref(); }
  onModuleDestroy() { if (this.sweeper) clearInterval(this.sweeper); for (const t of this.waiting.values()) clearTimeout(t); this.waiting.clear(); }
  /** What people typed is wiped once it is older than the retention setting. Peruzzi's words and the tidied line stay. */
  async forget() {
    const days = (await this.cfg.stage()).retentionDays; if (!days || days < 1) return;
    const before = new Date(Date.now() - days * 86400_000);
    const r = await this.prisma.note.updateMany({ where: { createdAt: { lt: before }, NOT: { statement: '[removed]' } }, data: { statement: '[removed]' } });
    if (r.count) this.log.log(`forgot ${r.count} notes as typed, older than ${days} days`);
  }

  // ---- the settings the phone needs ----------------------------------------------------------------------------
  async publicConfig() {
    const c = await this.cfg.stage(); const site = await this.cfg.site();
    return {
      open: c.open, pausedMessage: c.pausedMessage, nameplate: c.nameplate, notesPerDay: c.notesPerDay, asksPerDay: c.asksPerDay,
      email: emailReady(), voice: { mode: this.voiceReady() ? c.voice.mode : 'off', aiLabel: c.voice.aiLabel, v: await this.voice.version() },
      music: c.music, help: c.help, smartLink: site.smartLink, artist: site.artist, song: site.song, handle: site.handle, readLive: !!c.readLive,
    };
  }
  voiceReady() { return !!process.env.ELEVENLABS_API_KEY; }

  // ---- limits ---------------------------------------------------------------------------------------------------
  private notesToday(where: Prisma.NotebookWhereInput) {
    return this.prisma.note.count({ where: { createdAt: { gte: startOfDay() }, notebook: where } });
  }
  private async checkDaily(c: StageConfig, device: string, ip: string | null) {
    if ((await this.notesToday({ device })) >= c.notesPerDay) throw new TooMany(`That’s ${c.notesPerDay} ${c.notesPerDay === 1 ? 'note' : 'notes'} today. Peruzzi will ask again tomorrow.`, 'daily');
    // through the site the connection is Vercel's, shared by everyone near it: off unless set (see StageConfig)
    if (ip && c.notesPerDayPerConnection > 0 && (await this.notesToday({ ip })) >= c.notesPerDayPerConnection) {
      if (Date.now() - this.connWarned > 10 * 60_000) { this.connWarned = Date.now(); this.log.warn(`a connection has reached today's limit of ${c.notesPerDayPerConnection} notes (Admin → The stage → Limits)`); }
      throw new TooMany('Peruzzi has read a lot of notes from your network today. He’ll ask again tomorrow.', 'network');
    }
  }
  /** Whether the daily limits would let this notebook write a note now: a draft of one they couldn't hand up is money wasted. */
  private canWrite(c: StageConfig, d: { device: string; ip: string | null }) { return this.checkDaily(c, d.device, d.ip).then(() => true, () => false); }
  /** A paid call to the AI, if the hour's ceiling for its kind leaves room: counted as it's made, whether or not it
   *  comes back, so the ceilings hold the bill whatever the AI does and whoever asks. Without a key there's no call. */
  private spend(kind: 'note' | 'draft', c: StageConfig) {
    if (!aiAvailable()) return true;
    const set = Number(kind === 'note' ? c.aiNotesPerHour : c.aiDraftsPerHour);
    const ceiling = Number.isFinite(set) ? set : kind === 'note' ? STAGE_DEFAULTS.aiNotesPerHour : STAGE_DEFAULTS.aiDraftsPerHour;
    if (this.calls[kind].take(ceiling)) return true;
    if (Date.now() - this.ceilingSaid[kind] > 10 * 60_000) {
      this.ceilingSaid[kind] = Date.now();
      this.log.warn(`the hour's ${ceiling} AI ${kind === 'note' ? 'readings are used up: prepared lines stand in' : 'drafts are used up: readings start when notes are handed up'} (Admin → The stage → Limits)`);
    }
    return false;
  }
  private checkOpen(c: StageConfig) { if (!c.open) throw new ForbiddenException({ message: c.pausedMessage, reason: 'paused' }); }

  // ---- notebooks ------------------------------------------------------------------------------------------------
  /** What a notebook that writes back knows of the note it answers: who sent it, to whom, and what it said. */
  private async backInfo(askId: string | null) {
    if (!askId) return null;
    const a = await this.prisma.ask.findUnique({ where: { id: askId }, include: { note: ASKED_NOTE } });
    return a ? { sender: a.senderName, dear: a.note.dear, line: a.note.line || '' } : null;
  }

  async openNotebook(device: string, ip: string | null, back?: string) {
    if (!device || device.length > 64) throw new BadRequestException('device');
    const c = await this.cfg.stage(); this.checkOpen(c); await this.checkDaily(c, device, ip);
    const a = back ? await this.prisma.ask.findUnique({ where: { code: back }, select: { id: true } }) : null;
    const d = await this.prisma.notebook.create({ data: { code: code(8), token: newToken(), device, ip, backOf: a?.id ?? null } });
    if (a) await this.prisma.ask.update({ where: { id: a.id }, data: { backAt: new Date(), backNotebookId: d.id } });
    this.events.add(a ? 'back_opened' : 'notebook_opened', device, {});
    return { id: d.id, token: d.token, code: d.code, back: await this.backInfo(a?.id ?? null), left: await this.leftToday(c, device) };
  }
  private async leftToday(c: StageConfig, device: string) { return Math.max(0, c.notesPerDay - (await this.notesToday({ device }))); }

  async notebookFor(id: string, token: string) {
    const d = await this.prisma.notebook.findUnique({ where: { id }, select: NOTEBOOK_COLUMNS });
    if (!d || d.token !== token) throw new NotFoundException('notebook');
    return d;
  }

  /** The notebook as the phone shows it: every note so far, each with where it's got to. */
  async getNotebook(id: string, token: string) {
    const d = await this.notebookFor(id, token); const c = await this.cfg.stage();
    const notes = await this.prisma.note.findMany({ where: { notebookId: d.id }, orderBy: { n: 'asc' }, select: { ...NOTE_COLUMNS, asks: { select: { backAt: true } } } });
    return { id: d.id, code: d.code, name: d.name, city: d.city, left: await this.leftToday(c, d.device), back: await this.backInfo(d.backOf), notes: notes.map(noteView) };
  }

  /** The tracklist's name and city. `tracklist` says the writer has opened their tracklist: the first time, it counts
   *  as made. The notebook carries on either way. */
  async updateNotebook(id: string, token: string, dto: { name?: string; city?: string; tracklist?: boolean }) {
    const d = await this.notebookFor(id, token);
    const data: Prisma.NotebookUpdateInput = {};
    if (dto.name !== undefined) data.name = clean(firstName(dto.name), 24).text.replace(/\[.*?\]/g, '').trim() || null;
    if (dto.city !== undefined) data.city = clean(dto.city, 32).text.replace(/\[.*?\]/g, '').trim() || null;
    if (dto.tracklist && !d.tracklistAt) { data.tracklistAt = new Date(); this.events.add('tracklist_made', d.device, {}); }
    await this.prisma.notebook.update({ where: { id: d.id }, data, select: { id: true } });
    return this.getNotebook(id, token);
  }

  // ---- the reading ----------------------------------------------------------------------------------------------
  /** The note as Peruzzi takes it: who (a name or a role), and what they did, cleaned the way every note is. Words
   *  typed around the note's own ("Dear", "you", "Could this be love?") are taken off. Null: there isn't one. */
  private words(dto: { who: string; what: string }): Words | null {
    const who = clean(String(dto.who ?? '').replace(/^\s*dear\s+/i, '').replace(/[,\s]+$/, ''), 28);
    const what = clean(String(dto.what ?? '').replace(/^\s*(i\s+think\s+)?you\s+/i, '').replace(/[\s,.!?]*(could\s+this\s+be\s+love)?[\s.!?]*$/i, ''), 80);
    const bare = (t: string) => t.replace(/\[.*?\]/g, '').trim();
    return bare(who.text).length >= 2 && bare(what.text).length >= 3 ? { who, what } : null;
  }
  /** The words a reading is for, as the stage tells them apart: case, spacing and punctuation don't make new words, so
   *  they neither start a new draft nor keep a note from using the one under way. */
  private draftKey(notebookId: string, w: Words) {
    const norm = (t: string) => t.toLowerCase().replace(/[\p{P}\s]+/gu, ' ').trim();
    return `${notebookId}\n${norm(w.who.text)}\n${norm(w.what.text)}`;
  }
  /** Peruzzi's reading of a note, with what the stage knows: the writer's name, and the note it writes back to (on a
   *  back notebook's first note). */
  private async readFor(c: StageConfig, d: NotebookRow, w: Words) {
    const first = !(await this.prisma.note.count({ where: { notebookId: d.id } }));
    const site = await this.cfg.site();
    return read({ who: w.who.text, what: w.what.text, humour: c.humour, artist: site.artist, song: site.song, writer: d.name, back: first ? await this.backInfo(d.backOf) : null, lately: [...this.lately] });
  }
  /** A reading the stage paid for and didn't use, for the Costs page. */
  private unused(r: ReadingResult | null) {
    if (r) this.prisma.aiUse.create({ data: { kind: 'draft', model: r.model, tokensIn: r.usage.in, tokensOut: r.usage.out, cacheRead: r.usage.cacheRead, cacheWrite: r.usage.cacheWrite } }).catch(() => {});
  }

  /** While the writer is still typing: once they stop, Peruzzi starts on his reading, so it's ready, or nearly, by the
   *  time they hand the note up. Kept a few minutes for that notebook and those words; one the writer changes and never
   *  hands up is counted on the Costs page. Only new words get one (see draftKey), a notebook's start DRAFT_GAP apart
   *  at most (words that come sooner wait for the gap, and only the latest wait), twenty an hour, and none past the
   *  hour's drafts. Turning one down needs no answer: the note is read when it's handed up. */
  async draft(notebookId: string, token: string, dto: { who: string; what: string }) {
    const d = await this.notebookFor(notebookId, token); const c = await this.cfg.stage();
    const w = this.words(dto);
    if (!w || !c.open || w.what.injection) return { ok: true };
    const key = this.draftKey(d.id, w);
    this.unwait(d.id);   // these are the latest words: whatever was waiting is out of date
    if (this.drafts.has(key) || this.lastWords.get(d.id) === key) return { ok: true };
    const wait = ((this.drafted.get(d.id) || []).at(-1) ?? 0) + DRAFT_GAP - Date.now();
    const start = () => this.startDraft(c, d, w, key).catch((e) => this.log.warn(`draft: ${e}`));
    if (wait > 0) {
      const timer = setTimeout(() => { if (this.waiting.get(d.id) === timer) { this.waiting.delete(d.id); start(); } }, wait);
      timer.unref(); this.waiting.set(d.id, timer);
    } else await start();
    return { ok: true };
  }
  private unwait(notebookId: string) { const t = this.waiting.get(notebookId); if (t) { clearTimeout(t); this.waiting.delete(notebookId); } }
  private async startDraft(c: StageConfig, d: NotebookRow, w: Words, key: string) {
    if (!(await this.canWrite(c, d))) return;
    // looked at again after the wait, all at once: another draft for this notebook may have started meanwhile
    const now = Date.now(); const recent = (this.drafted.get(d.id) || []).filter((t) => now - t < HOUR);
    if (this.drafts.has(key) || this.lastWords.get(d.id) === key || now - (recent.at(-1) ?? 0) < DRAFT_GAP - 100) return;
    if (recent.length >= 20 || this.drafts.size >= 200 || !this.spend('draft', c)) return;
    if (this.drafted.size > 5000) { this.drafted.clear(); this.lastWords.clear(); }
    this.drafted.set(d.id, [...recent, now]); this.lastWords.set(d.id, key);
    const draft: Draft = { at: now, run: this.readFor(c, d, w).catch(() => null), used: false };
    this.drafts.set(key, draft);
    draft.run.then((r) => setTimeout(() => { if (this.drafts.get(key) === draft) this.drafts.delete(key); if (!draft.used) this.unused(r); }, 4 * 60_000).unref());
  }

  /** "Dear <who>, you <what>.": Peruzzi reads it on the spot. The reading started while they
   *  typed is used if it was for these words; if the AI is down or too slow, a prepared one stands in. A note that
   *  describes real harm gets where to find help instead. */
  async ask(notebookId: string, token: string, dto: WriteDto) {
    const d = await this.notebookFor(notebookId, token);
    this.unwait(d.id);   // the note is being handed up: words still waiting for their draft won't need one
    const c = await this.cfg.stage();
    this.checkOpen(c);
    await this.checkDaily(c, d.device, d.ip);
    const w = this.words(dto);
    if (!w) throw new BadRequestException({ message: 'Say who it’s for, and what they do.', reason: 'missing' });
    if (this.busy.has(d.id)) throw new BadRequestException({ message: 'Peruzzi is already reading your note.', reason: 'busy' });
    this.busy.add(d.id);
    try {
      if (dto.name !== undefined && !d.name) await this.prisma.notebook.update({ where: { id: d.id }, data: { name: firstName(clean(dto.name, 24).text.replace(/\[.*?\]/g, '')) || null }, select: { id: true } });
      const key = this.draftKey(d.id, w); const draft = this.drafts.get(key);
      const drafted = !!draft && Date.now() - draft.at < 4 * 60_000;
      if (draft) { draft.used = drafted; this.drafts.delete(key); }
      // a fresh reading is a paid call: past the hour's ceiling there's none, and a prepared one stands in, as when the
      // AI is too slow
      const run = drafted ? draft!.run : this.spend('note', c) ? this.readFor(c, d, w).catch(() => null) : null;
      const r = run ? await Promise.race([run, sleep(READING_DEADLINE).then(() => undefined)]) : undefined;
      // too slow: a prepared reading now, and the AI's, whenever it comes, on the Costs page
      if (run && r === undefined) run.then((late) => this.unused(late));
      const ai = r || null;
      const flags = new Set<string>([w.who.redacted || w.what.redacted ? 'redacted' : '', w.what.injection || w.who.injection ? 'injection' : '', w.what.danger || w.who.danger ? 'danger-words' : ''].filter(Boolean));
      const seed = Math.floor(Math.random() * 1000);
      let v: Reading;
      if (ai) v = { ...ai.reading, verdict: ai.reading.verdict || (ai.reading.kind === 'serious' ? '' : fallbackVerdict(ai.reading.thing, seed)) };
      else { flags.add(!run ? 'ceiling' : r === undefined ? 'slow' : 'error'); v = flags.has('danger-words') ? seriousReading() : fallbackReading(w.who.text, w.what.text, seed); }
      const serious = v.kind === 'serious';
      if (serious) flags.add('serious');
      const statement = `Dear ${w.who.text}, you ${w.what.text}.`;
      const n = (await this.prisma.note.count({ where: { notebookId: d.id } })) + 1;
      const k = await this.prisma.note.create({
        select: NOTE_COLUMNS,
        data: {
          code: code(8), notebookId: d.id, n, statement, flags: [...flags],
          dear: (!serious && v.dear) || w.who.text, thing: !serious && v.thing, title: serious ? 'Referred for help' : v.title,
          status: serious ? 'serious' : 'asked', fallback: !ai, model: ai?.model || peruzziModel(),
          tokensIn: ai?.usage.in || 0, tokensOut: ai?.usage.out || 0, cacheRead: ai?.usage.cacheRead || 0, cacheWrite: ai?.usage.cacheWrite || 0, ms: ai?.ms || 0,
          ...(serious ? {} : { kind: v.kind, line: v.line, verdict: v.verdict || null, askedAt: new Date() }),
        },
      });
      if (!serious && v.verdict) this.lately = [...this.lately.filter((t) => t !== v.verdict), v.verdict].slice(-6);
      this.events.add('note_written', d.device, { back: !!d.backOf, drafted });
      if (serious) this.events.add('serious', d.device, {});
      else this.events.add('note_asked', d.device, { kind: v.kind, thing: v.thing, fallback: !ai, drafted, ms: ai?.ms || 0 });
      // the reading starts now, so it's ready by the time the note lands and the phone asks for it
      const voiced = !serious && this.voiceReady() && c.voice.mode !== 'off';
      if (voiced) this.voice.say(noteReading({ dear: v.dear, line: v.line, fallback: !ai, verdict: v.verdict })).catch(() => {});
      return { note: noteView(k), serious, line: serious ? SERIOUS_LINE : null, voice: voiced, left: await this.leftToday(c, d.device) };
    } finally { this.busy.delete(d.id); }
  }

  // ---- public pages ---------------------------------------------------------------------------------------------
  /** A note as its public link shows it (someone posted it): what they did, as Peruzzi told it. */
  async publicNote(code: string) {
    const k = await this.prisma.note.findUnique({ where: { code }, select: { ...NOTE_COLUMNS, notebook: { select: { name: true, city: true } } } });
    if (!k || k.hidden || k.status !== 'asked') throw new NotFoundException();
    return publicNote(k, k.notebook);
  }
  /** A tracklist as its link shows it: every note so far (the latest TRACKLIST_SHOWN), newest first. */
  async publicTracklist(code: string) {
    const d = await this.prisma.notebook.findUnique({ where: { code }, select: { code: true, name: true, city: true, notes: { where: { status: 'asked', hidden: false }, orderBy: { n: 'desc' }, select: NOTE_COLUMNS } } });
    if (!d || !d.notes.length) throw new NotFoundException();
    return {
      code: d.code, name: d.name, city: d.city, date: d.notes[0].askedAt || d.notes[0].createdAt, count: d.notes.length,
      notes: d.notes.slice(0, TRACKLIST_SHOWN).map((k) => publicNote(k)),
    };
  }

  // ---- the cards, kept for link previews --------------------------------------------------------------------------
  /** The note's card, or the tracklist's, from the phone that wrote it (its notebook's token is the key). */
  async saveCard(kind: 'note' | 'notebook', id: string, token: string, image: Buffer) {
    if (kind === 'notebook') { const d = await this.notebookFor(id, token); await this.prisma.notebook.update({ where: { id: d.id }, data: { card: image }, select: { id: true } }); return { ok: true }; }
    const k = await this.prisma.note.findUnique({ where: { id }, select: { id: true, notebook: { select: { token: true } } } });
    if (!k || k.notebook.token !== token) throw new NotFoundException();
    await this.prisma.note.update({ where: { id: k.id }, data: { card: image }, select: { id: true } }); return { ok: true };
  }
  /** The picture for a note's link, or a tracklist's. */
  async cardImage(kind: 'note' | 'notebook', code: string): Promise<Buffer | null> {
    if (kind === 'notebook') { const d = await this.prisma.notebook.findUnique({ where: { code }, select: { card: true } }); return d?.card ? Buffer.from(d.card) : null; }
    const k = await this.prisma.note.findUnique({ where: { code }, select: { card: true, hidden: true } });
    if (!k || k.hidden) return null;
    return k.card ? Buffer.from(k.card) : null;
  }
}
