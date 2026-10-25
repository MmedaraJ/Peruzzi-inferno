import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/** Where ElevenLabs is. ELEVENLABS_API_URL points it elsewhere for a local test. */
export const elevenlabs = () => (process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io').replace(/\/+$/, '');

/** What a refusal from ElevenLabs means, in words the admin can act on. */
export function elevenlabsProblem(status: number, body: string) {
  let code = ''; let message = '';
  try { const d = JSON.parse(body)?.detail; code = String(d?.status || d?.code || ''); message = String(d?.message || (typeof d === 'string' ? d : '')); } catch { message = body.slice(0, 200); }
  if (code === 'invalid_api_key' || status === 401 && !code) return 'ElevenLabs doesn’t recognise the key. Copy it again from ElevenLabs (Developers → API keys) into ELEVENLABS_API_KEY on Railway.';
  if (code === 'missing_permissions') return `The ElevenLabs key is missing a permission (${message || 'see ElevenLabs'}). Edit the key in ElevenLabs and allow Text to Speech and Sound Effects.`;
  if (code === 'detected_unusual_activity') return 'ElevenLabs has blocked its free plan for this server (“unusual activity”). A paid ElevenLabs plan lifts it.';
  if (code === 'quota_exceeded' || code === 'insufficient_credits') return 'The ElevenLabs account is out of credits.';
  if (code === 'voice_not_found' || status === 404) return 'ElevenLabs can’t find that voice. Check the voice ID in ElevenLabs → Voices (a voice from the library must be added to My Voices first).';
  if (code === 'payment_required' || status === 402) return `ElevenLabs wants a paid plan for this${message ? `: ${message}` : '.'}`;
  return `ElevenLabs refused (${status}${code ? `, ${code}` : ''})${message ? `: ${message}` : '.'}`;
}

/** What each of the crowd's voices should sound like, for ElevenLabs' sound effects. */
export const GALLERY_SOUNDS: Record<string, { label: string; text: string; seconds: number }> = {
  ooh: { label: '“Ooooh”', text: 'A concert crowd of a few hundred people going "ooooh" together, teasing, intrigued by a juicy love note read from the stage, indoor venue, natural reverb, no music', seconds: 2 },
  gasp: { label: 'A gasp', text: 'A concert crowd gasping together in surprise, one sharp collective gasp, indoor venue, no music', seconds: 1.5 },
  laugh: { label: 'A laugh', text: 'A concert crowd bursting into short warm laughter together, indoor venue, no music', seconds: 2.5 },
  murmur: { label: 'A murmur', text: 'A concert crowd murmuring between songs, indistinct chatter and whistles, indoor venue, no music', seconds: 3 },
  aww: { label: '“Awww”', text: 'A concert crowd going "awww" together, touched by something sweet, indoor venue, no music', seconds: 2 },
  cheer: { label: 'A cheer', text: 'A concert crowd screaming and cheering with whistles and applause, delighted, indoor venue, no music', seconds: 2.5 },
};

/** The crowd's voices. Each is made once with ElevenLabs the first time a phone asks for it (or uploaded in
 *  the admin), kept in the database, and served from there. Without ELEVENLABS_API_KEY and without an upload, the
 *  phones make do with the murmur they synthesise themselves. */
@Injectable()
export class SoundService {
  private log = new Logger('sounds');
  private making = new Map<string, Promise<boolean>>();
  private failedAt = new Map<string, number>();
  /** why the last attempt at each sound failed, for the admin */
  problems = new Map<string, string>();
  private versions: Record<string, string> | null = null;
  constructor(private prisma: PrismaService) {}

  get canMake() { return !!process.env.ELEVENLABS_API_KEY; }

  /** For the phones: each sound that's ready, by its version (so a new one replaces the old in their cache), and
   *  "new" for each one that will be made the first time it's asked for. */
  async available(): Promise<Record<string, string>> {
    if (!this.versions) {
      const rows = await this.prisma.sound.findMany({ select: { key: true, updatedAt: true } });
      this.versions = Object.fromEntries(rows.map((r) => [r.key, String(r.updatedAt.getTime())]));
    }
    const out: Record<string, string> = {};
    for (const k of Object.keys(GALLERY_SOUNDS)) {
      if (this.versions[k]) out[k] = this.versions[k];
      else if (this.canMake && !this.failedLately(k)) out[k] = 'new';
    }
    return out;
  }

  /** One sound, made now if it can be and isn't yet. */
  async get(kind: string) {
    if (!(kind in GALLERY_SOUNDS)) return null;
    let row = await this.prisma.sound.findUnique({ where: { key: kind } });
    if (!row && this.canMake && !this.failedLately(kind) && (await this.make(kind))) row = await this.prisma.sound.findUnique({ where: { key: kind } });
    return row ? { audio: Buffer.from(row.audio), mime: row.mime, version: String(row.updatedAt.getTime()) } : null;
  }

  /** Makes a sound with ElevenLabs, or makes it again. One at a time for each sound. */
  make(kind: string): Promise<boolean> {
    const going = this.making.get(kind); if (going) return going;
    const p = this.generate(kind).then(async (audio) => {
      if (!audio) { this.failedAt.set(kind, Date.now()); return false; }
      this.failedAt.delete(kind); await this.save(kind, audio, 'audio/mpeg', 'made'); return true;
    }).finally(() => this.making.delete(kind));
    this.making.set(kind, p);
    return p;
  }

  async save(kind: string, audio: Buffer, mime: string, source: 'made' | 'upload') {
    await this.prisma.sound.upsert({ where: { key: kind }, create: { key: kind, audio, mime, source }, update: { audio, mime, source } });
    this.versions = null;
  }
  async remove(kind: string) { await this.prisma.sound.deleteMany({ where: { key: kind } }); this.failedAt.delete(kind); this.versions = null; }
  async audio(kind: string) { return this.prisma.sound.findUnique({ where: { key: kind } }); }

  /** For the admin: every sound, and where it came from. */
  async list() {
    const rows = await this.prisma.sound.findMany({ select: { key: true, source: true, updatedAt: true } });
    return Object.entries(GALLERY_SOUNDS).map(([key, s]) => {
      const r = rows.find((x) => x.key === key);
      return { key, label: s.label, text: s.text, source: r?.source ?? null, updatedAt: r?.updatedAt ?? null, failed: this.failedLately(key), problem: this.failedLately(key) ? this.problems.get(key) ?? null : null };
    });
  }

  /** A failed attempt (no credits, a bad key) isn't retried for ten minutes, so phones don't keep asking. */
  private failedLately(kind: string) { const t = this.failedAt.get(kind); return !!t && Date.now() - t < 10 * 60_000; }

  private async generate(kind: string): Promise<Buffer | null> {
    const s = GALLERY_SOUNDS[kind]; if (!s || !this.canMake) return null;
    try {
      const res = await fetch(`${elevenlabs()}/v1/sound-generation`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text: s.text, duration_seconds: s.seconds, prompt_influence: 0.6 }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) { const body = await res.text(); this.problems.set(kind, elevenlabsProblem(res.status, body)); this.log.warn(`elevenlabs sound ${kind}: ${res.status} ${body.slice(0, 200)}`); return null; }
      const audio = Buffer.from(await res.arrayBuffer());
      if (audio.length < 500) { this.log.warn(`elevenlabs sound ${kind}: empty`); return null; }
      this.log.log(`made the crowd's ${kind} (${Math.round(audio.length / 1024)} KB)`);
      return audio;
    } catch (e: any) { this.problems.set(kind, `Couldn’t reach ElevenLabs (${e?.message || e}).`); this.log.warn(`elevenlabs sound ${kind} failed: ${e?.message || e}`); return null; }
  }
}
