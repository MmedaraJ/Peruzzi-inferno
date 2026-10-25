import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '../common/config.service';
import { sha256 } from '../common/util';
import { VoiceMode } from '../common/defaults';
import { elevenlabs, elevenlabsProblem } from './sound.service';

/** The stage's fixed lines, read at set moments. In "Peruzzi's recorded lines" mode, his uploaded recordings of these
 *  replace the MC's reading. */
export const FIXED_LINES: Record<string, string> = {
  open: 'Make some noise! Who’s on your mind tonight?',
  found: 'Somebody here has a question for you.',
  question: 'Could this be love?',
  yes: 'I knew it.',
  no: 'Respect.',
  escape: 'Hmm. I don’t believe you.',
};

/** Text to speech through ElevenLabs. It only ever reads Peruzzi's own words: the fixed lines, and what he wrote after
 *  it passed the checks, never what anyone typed. Each reading is kept, so the same words in the same voice are paid for
 *  once. Without ELEVENLABS_API_KEY there is no voice, and the screen shows the words alone. */
@Injectable()
export class VoiceService {
  private log = new Logger('voice');
  private inflight = new Map<string, Promise<{ audio: Buffer; mime: string } | null>>();
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  get ready() { return !!process.env.ELEVENLABS_API_KEY; }
  /** why the last reading failed, for the admin's “Hear the MC” */
  problem: string | null = null;
  private artistVoice() { return process.env.ELEVENLABS_VOICE_ID || ''; }
  private async mcVoice() { return process.env.ELEVENLABS_MC_VOICE_ID || (await this.cfg.stage()).voice.mcVoiceId; }
  private async mode(): Promise<VoiceMode> { return (await this.cfg.stage()).voice.mode; }
  private model() { return process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'; }

  /** One of the fixed lines, in the voice the admin chose. */
  async fixed(key: string) {
    const text = FIXED_LINES[key]; if (!text) return null;
    const mode = await this.mode(); if (mode === 'off') return null;
    if (mode === 'artist_lines') {
      const rec = await this.prisma.voiceLine.findUnique({ where: { key } });
      if (rec) return { audio: Buffer.from(rec.audio), mime: rec.mime };
    }
    if (!this.ready) return null;
    return this.speak(mode === 'artist_ai' ? this.artistVoice() : await this.mcVoice(), text);
  }

  /** Which voice reads the stage, in short: the readings' links carry it, so a new voice isn't heard in an old one. */
  async version() {
    const c = (await this.cfg.stage()).voice;
    return sha256(`${c.mode}|${await this.mcVoice()}|${this.artistVoice()}|${this.model()}`).slice(0, 8);
  }

  /** Peruzzi's own words: his line on a note, and the question. */
  async say(text: string) {
    const mode = await this.mode(); if (mode === 'off' || !this.ready) return null;
    return this.speak(mode === 'artist_ai' ? this.artistVoice() : await this.mcVoice(), text);
  }

  async speak(voice: string, text: string): Promise<{ audio: Buffer; mime: string } | null> {
    if (!voice || !text.trim()) return null;
    const model = this.model();
    const key = sha256(`${voice}|${model}|${text}`);
    const hit = await this.prisma.voiceClip.findUnique({ where: { key } });
    if (hit) { this.prisma.voiceClip.update({ where: { key }, data: { hits: { increment: 1 } } }).catch(() => {}); return { audio: Buffer.from(hit.audio), mime: hit.mime }; }
    const going = this.inflight.get(key); if (going) return going;
    const p = this.tts(voice, model, text).then(async (audio) => {
      if (!audio) return null;
      await this.prisma.voiceClip.create({ data: { key, voice, text, audio } }).catch(() => {});
      return { audio, mime: 'audio/mpeg' };
    }).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async tts(voice: string, model: string, text: string): Promise<Buffer | null> {
    if (!this.ready) return null;
    try {
      const res = await fetch(`${elevenlabs()}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }),
        // well inside what the web's proxy waits for, so a slow ElevenLabs comes back as words, not a dead request
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) { const body = await res.text(); this.problem = elevenlabsProblem(res.status, body); this.log.warn(`elevenlabs ${res.status}: ${body.slice(0, 200)}`); return null; }
      this.problem = null;
      return Buffer.from(await res.arrayBuffer());
    } catch (e: any) {
      this.problem = e?.name === 'TimeoutError' ? 'ElevenLabs took more than 20 seconds to answer. Try again in a moment.' : `Couldn’t reach ElevenLabs (${e?.message || e}).`;
      this.log.warn(`elevenlabs failed: ${e?.message || e}`); return null;
    }
  }
}
