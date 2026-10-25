import { streaming } from './stream';
import { isField, touch } from './viewport';

/** All the stage's sound: the song underneath everything, the show's effects, and Peruzzi's voice.
 *
 *  The effects and the voice run through one Web Audio graph. The song is a plain audio element, as on Love, Banggz:
 *  a phone pauses and resumes one of those cleanly, where a song running through Web Audio can squeak as the phone
 *  stops it and stay silent after. Only on iPhones, which ignore an element's volume set from code, does the song go
 *  through a gain node, the one volume they honour. It sits at the admin's level (a quarter as loud as full, by
 *  default) and drops to the duck level whenever anything else plays. The effects are synthesised here (no files to load), apart from the
 *  crowd's voices, which the server makes with ElevenLabs (or the admin uploads) and serves from /api/sfx/.
 *
 *  The song starts the moment the stage opens wherever the browser allows it. Most phones only allow sound after a tap
 *  on the page, so when it's refused, a pill asks for one ("Tap to play the music"), and the next tap anywhere starts
 *  it. The same pill comes back whenever the song should be playing and isn't: stopped by something other than the
 *  fan (a call, the phone's media controls, headphones pulled out), or stuck waiting on the network.
 *
 *  Leaving the page cuts the sound at once (an iPhone takes focus away before it hides the page, so the cut comes on
 *  the blur), and coming back carries the song on where it was. After the fan goes off to stream the song, it waits
 *  for the pill instead, so it never cuts into the song playing in another app. */

export type Sfx = 'mic' | 'crash' | 'drumroll' | 'whoosh' | 'murmur' | 'paper' | 'chime';
export type CrowdSound = 'ooh' | 'gasp' | 'laugh' | 'murmur' | 'aww' | 'cheer';

export const SONG = '/media/audio/inferno.mp3';
const CROWD: CrowdSound[] = ['ooh', 'gasp', 'laugh', 'murmur', 'aww', 'cheer'];
/** How loud something sounds, as a share of full, to the gain that does it. The ear hears every 10 dB as twice or
 *  half as loud, so a quarter as loud is 20 dB down (a gain of 0.1), half is 10 dB down (0.32). */
const gainFor = (share: number) => (share <= 0 ? 0 : Math.min(1, share) ** (Math.log2(10) / 2));
/** iPhones ignore an element's volume set from code: there the song needs the gain node */
const fixedVolume = () => { if ((window as any).__routeSong) return true; try { const a = new Audio(); a.volume = 0.5; return a.volume !== 0.5; } catch { return false; } };
/** iPhones count the lift of the finger as the tap that allows sound, not the touch-down: listen for all of them */
const TAPS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
/** a tap on a link out of the page isn't a tap to start the song on */
const leavesPage = (e: Event) => { const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null; return !!a && (a.target === '_blank' || a.origin !== location.origin); };

class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode; private musicGain: GainNode | null = null; private sfxBus!: GainNode; private voiceGain!: GainNode; private verb!: GainNode;
  private musicEl: HTMLAudioElement | null = null; private voiceEl: HTMLAudioElement | null = null;
  private routed = false; private volTimer = 0;
  private samples = new Map<string, AudioBuffer>();
  private crowdMap: Record<string, string> = {}; private crowdHave: Record<string, string> = {}; private crowdBusy = false;
  private noiseBuf: AudioBuffer | null = null;
  private ducks = 0; private wantMusic = false;
  /** the song should be playing but the phone won't start it by itself: the next tap does, and a pill asks for it */
  needsTap = false;
  /** the song was left paused on purpose, while the fan streams the album elsewhere: it waits for the pill */
  held = false;
  private gone = false; private keepUntil = 0; private holdOnReturn = false; private fieldLeft = 0;
  private tapArmed = false; private checkTimer = 0;
  /** the watch on the song: where it was last, and when it last moved */
  private watchTimer = 0; private lastT = -1; private lastMoved = 0;
  level = 0.25; duck = 0.1;
  on = true;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }
  get unlocked() { return !!this.ctx && this.ctx.state === 'running'; }
  get musicPlaying() { return !!this.musicEl && !this.musicEl.paused; }
  /** Where the song is, in seconds, while it plays (the crowd moves to its beat); null while it doesn't. */
  songTime() { const el = this.musicEl; return el && !el.paused && el.readyState >= 2 ? el.currentTime : null; }

  /** Call inside a tap: iPhones only start sound from one. Builds the graph the first time. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
        const ctx: AudioContext = new AC({ latencyHint: 'interactive' }); this.ctx = ctx;
        this.master = ctx.createGain(); this.master.gain.value = this.on ? 1 : 0; this.master.connect(ctx.destination);
        this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
        this.voiceGain = ctx.createGain(); this.voiceGain.gain.value = 1; this.voiceGain.connect(this.master);
        // a hall, for the effects only
        const conv = ctx.createConvolver(); conv.buffer = this.impulse(2.2, 3.2); const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3800;
        this.verb = ctx.createGain(); this.verb.gain.value = 0.55; this.verb.connect(conv); conv.connect(tone); tone.connect(this.master);
        const el = new Audio(); el.src = SONG; el.loop = true; el.preload = 'auto'; (el as any).playsInline = true;
        this.routed = fixedVolume();
        if (this.routed) { el.crossOrigin = 'anonymous'; this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(this.master); ctx.createMediaElementSource(el).connect(this.musicGain); }
        else el.volume = 0;
        el.addEventListener('playing', () => { this.lastMoved = performance.now(); if (this.needsTap) { this.needsTap = false; this.emit(); } });
        // stopped by something else (a call, the phone's media controls, headphones pulled out): ask for the tap
        el.addEventListener('pause', () => this.checkSoon());
        this.musicEl = el;
        const v = new Audio(); v.preload = 'auto'; v.crossOrigin = 'anonymous'; (v as any).playsInline = true; ctx.createMediaElementSource(v).connect(this.voiceGain); this.voiceEl = v;
        try { const s = (navigator as any).audioSession; if (s) s.type = 'playback'; } catch {}   // so the ringer switch doesn't silence it
        document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? this.leave('hidden') : this.back()));
        window.addEventListener('pagehide', () => this.leave('hidden'));
        window.addEventListener('blur', () => this.leave('blur'));
        document.addEventListener('focusout', (e) => { if (isField(e.target as Element)) this.fieldLeft = Date.now(); }, true);
        window.addEventListener('focus', () => this.back());
        window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) this.back(); });
        ctx.addEventListener('statechange', () => { if (ctx.state !== 'running' && !this.gone && document.visibilityState === 'visible') { this.armTap(); this.checkSoon(); } });
        this.loadCrowd();
      }
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      // a moment of silence through the graph seals the unlock on older iPhones
      const b = this.ctx.createBuffer(1, 1, 22050); const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.master); s.start();
    } catch {}
  }

  // ---- leaving and coming back ---------------------------------------------------------------------------------------
  /** Cut, not fade: everything goes to nothing on this very sample, then the song and the voice stop and the room
   *  sleeps. Left to the phone to stop, a playing graph squeaks. */
  private leave(kind: 'blur' | 'hidden') {
    const ctx = this.ctx; if (!ctx || this.gone) return;
    // the share sheet takes focus for a moment and the song plays on under it; going on into another app still stops it
    if (kind === 'blur' && Date.now() < this.keepUntil) return;
    // nor is a phone's keyboard going away, though Brave on an iPhone takes the page's focus away with it (the blank still
    // focused, or only just left): the page being hidden, if it is, still stops it
    if (kind === 'blur' && touch() && (isField(document.activeElement) || Date.now() - this.fieldLeft < 800)) return;
    this.gone = true; this.holdOnReturn = Date.now() - streaming.leftAt < 8000;
    const t = ctx.currentTime;
    for (const g of [this.master.gain, this.musicGain?.gain]) if (g) { g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.value = 0; }
    if (!this.routed && this.musicEl) { window.clearInterval(this.volTimer); try { this.musicEl.volume = 0; } catch {} }
    this.musicEl?.pause(); this.stopVoice();
    // the watch starts afresh on the way back, rather than calling the song stuck for the time it was away
    window.clearTimeout(this.checkTimer); this.lastT = -1;
    window.setTimeout(() => { if (this.gone) ctx.suspend().catch(() => {}); }, 80);
  }
  /** Back: the room wakes and the song carries on where it was, faded up. */
  private back() {
    if (document.visibilityState === 'hidden') return;   // the focus can come back a moment before the page shows
    this.keepUntil = 0;
    const ctx = this.ctx; if (!ctx || !this.gone) return;
    this.gone = false;
    ctx.resume().catch(() => {});
    const t = ctx.currentTime; const g = this.master.gain; g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(this.on ? 1 : 0, t + 0.5);
    if (this.holdOnReturn && this.wantMusic && this.on) { this.holdOnReturn = false; this.held = true; this.emit(); return; }
    this.resumeSong();
  }
  private resumeSong() {
    const el = this.musicEl; if (!el) return;
    if (this.wantMusic && this.on) el.play().catch(() => {});
    this.applyMusic(0.8);
    this.armTap(); this.checkSoon();
  }
  /** Still silent a moment later: ask for the tap in plain sight. */
  private checkSoon() {
    window.clearTimeout(this.checkTimer);
    this.checkTimer = window.setTimeout(() => this.ask(this.silent()), 1200);
  }
  /** the pill, up or down */
  private ask(tap: boolean) {
    if (tap) this.armTap();
    if (tap !== this.needsTap) { this.needsTap = tap; this.emit(); }
  }
  /** The song should be playing, and can't be heard: paused, its sound asleep, or stuck where it is for 4 seconds. */
  private silent() {
    if (this.gone || document.visibilityState !== 'visible' || !this.wantMusic || !this.on || this.held) return false;
    const el = this.musicEl;
    return !el || el.paused || (this.routed && this.ctx?.state !== 'running') || (this.lastT >= 0 && performance.now() - this.lastMoved > 4000);
  }
  /** Keeps an eye on the song, every second, while it should be playing: when it can't be heard, the pill asks for the
   *  tap (and a song stuck on the network gets a nudge). */
  private watch() {
    if (this.watchTimer) return;
    this.watchTimer = window.setInterval(() => {
      const el = this.musicEl;
      if (!el || el.paused) { this.lastT = -1; } else if (el.currentTime !== this.lastT) { this.lastT = el.currentTime; this.lastMoved = performance.now(); }
      const quiet = this.silent();
      if (quiet && el && !el.paused) el.play().catch(() => {});
      this.ask(quiet);
    }, 1000);
  }
  /** Waits for the next tap anywhere (the moment a phone allows sound again), and keeps waiting until it really plays. */
  private armTap() {
    if (this.tapArmed) return; this.tapArmed = true;
    const off = () => { TAPS.forEach((e) => window.removeEventListener(e, go, true)); this.tapArmed = false; };
    const go = (e: Event) => {
      if (leavesPage(e) || this.gone) return;
      this.unlock();
      const ctx = this.ctx; const el = this.musicEl; const want = this.wantMusic && this.on && !this.held;
      Promise.all([ctx?.resume(), want && el?.paused ? el.play() : null]).then(() => {
        if (ctx?.state !== 'running' || (want && el?.paused)) return;
        off(); this.applyMusic(0.6);
        if (this.needsTap) { this.needsTap = false; this.emit(); }
      }, () => {});
    };
    TAPS.forEach((e) => window.addEventListener(e, go, true));
  }
  /** The share sheet is about to open: the song plays on under it. */
  keepThrough() { this.keepUntil = Date.now() + 120_000; }
  /** A link out to stream the song: when the fan comes back, the song waits for the pill instead of cutting in. (The
   *  Listen button marks the time itself; the tests leave through here.) */
  leaveForStream() { streaming.leftAt = Date.now(); }
  /** The pill: the song again, from where it was. Call inside the tap. */
  resume() {
    this.held = false; this.needsTap = false; this.gone = false; this.unlock();
    const el = this.musicEl;
    if (el && this.wantMusic && this.on) {
      // stuck on the network: loaded again, from where it got to
      if (!el.paused && this.lastT >= 0 && performance.now() - this.lastMoved > 4000) { const t = el.currentTime; el.load(); try { el.currentTime = t; } catch {} this.lastMoved = performance.now(); }
      el.play().catch(() => {});
    }
    this.applyMusic(0.8); this.emit(); this.checkSoon();
  }
  /** The song belongs on every screen of the stage, from the moment it opens: it starts now if the browser allows it,
   *  and if it doesn't, the pill asks for the tap that does (any tap anywhere starts it). With the sound off, it starts
   *  the moment the sound is turned back on. */
  playOnStage() {
    this.watch();
    if (this.wantMusic) return;
    this.wantMusic = true;
    if (!this.on) return;
    this.unlock(); this.startMusic();
  }

  setLevels(level: number, duck: number) { this.level = level; this.duck = Math.min(level, duck); this.applyMusic(0.3); }
  /** Sound on or off. Turned on with a tap (the speaker button), that tap is also the one a browser needs before it
   *  plays anything: the sound is set up or woken there and then, and the song starts if the stage wants it. */
  setOn(on: boolean, tap = false) {
    this.on = on; this.held = false; this.needsTap = false; this.emit();
    if (on && tap) this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime; const g = this.master.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? 1 : 0, t + 0.25);
    this.applyMusic(0.25);
    if (on && this.wantMusic) { this.ctx.resume().catch(() => {}); this.musicEl?.play().catch(() => this.armTap()); }
    else if (!on) window.setTimeout(() => { if (!this.on) this.musicEl?.pause(); }, 300);
  }

  /** The song, from the top or where it left off, faded in to its level. Refused (no tap yet), the pill asks for one. */
  startMusic() {
    this.wantMusic = true; this.held = false; this.watch(); if (!this.ctx || !this.musicEl) return;
    if (this.on) this.musicEl.play().then(() => { this.emit(); this.checkSoon(); }, (e) => { if (e?.name === 'NotAllowedError') this.ask(true); else { this.armTap(); this.checkSoon(); } });
    this.applyMusic(1.6);
  }
  stopMusic(fade = 0.8) {
    this.wantMusic = false; this.held = false; if (this.needsTap) { this.needsTap = false; this.emit(); }
    if (!this.ctx || !this.musicEl) return;
    this.applyMusic(fade);
    window.setTimeout(() => { if (!this.wantMusic) this.musicEl?.pause(); this.emit(); }, fade * 1000 + 50);
  }
  private applyMusic(sec: number) {
    if (!this.ctx) return;
    const target = this.wantMusic && this.on && !this.gone ? gainFor(this.ducks > 0 ? this.duck : this.level) : 0;
    if (this.musicGain) { const t = this.ctx.currentTime; const g = this.musicGain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(target, t + sec); return; }
    const el = this.musicEl; if (!el) return;
    window.clearInterval(this.volTimer);
    const from = el.volume; const t0 = performance.now();
    if (sec <= 0 || Math.abs(from - target) < 0.003) { try { el.volume = target; } catch {} return; }
    this.volTimer = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (sec * 1000));
      try { el.volume = from + (target - from) * k; } catch {}
      if (k >= 1) window.clearInterval(this.volTimer);
    }, 30);
  }
  /** The song steps down while something else is heard, and comes back up after. */
  private duckFor(ms: number) {
    this.ducks++; this.applyMusic(0.18);
    window.setTimeout(() => { this.ducks = Math.max(0, this.ducks - 1); if (!this.ducks) this.applyMusic(0.9); }, ms);
  }

  /** Peruzzi's voice. Resolves when it has finished (or straight away if it can't play). */
  speak(url: string, onStart?: (durationSec: number) => void): Promise<boolean> {
    return new Promise((resolve) => {
      const v = this.voiceEl; if (!v || !this.ctx || !this.on || this.gone) { resolve(false); return; }
      let settled = false; this.ducks++; this.applyMusic(0.25);
      const done = (ok: boolean) => { if (settled) return; settled = true; v.removeEventListener('ended', end); v.removeEventListener('error', fail); clearTimeout(guard); this.ducks = Math.max(0, this.ducks - 1); if (!this.ducks) this.applyMusic(1.0); resolve(ok); };
      const end = () => done(true); const fail = () => done(false);
      const guard = window.setTimeout(() => done(false), 60_000);
      v.addEventListener('ended', end); v.addEventListener('error', fail);
      v.src = url;
      v.play().then(() => { const d = isFinite(v.duration) ? v.duration : 0; onStart?.(d); if (!d) v.addEventListener('loadedmetadata', () => onStart?.(v.duration), { once: true }); }).catch(() => done(false));
    });
  }
  stopVoice() { if (this.voiceEl && !this.voiceEl.paused) { this.voiceEl.pause(); this.voiceEl.dispatchEvent(new Event('ended')); } }
  /** Fetches a voice clip ahead of time so it plays the moment it's needed. False when there is no voice (204). */
  async prefetch(url: string): Promise<string | null> {
    try { const r = await fetch(url); if (r.status !== 200) return null; return URL.createObjectURL(await r.blob()); } catch { return null; }
  }

  // ---- effects -----------------------------------------------------------------------------------------------------
  play(name: Sfx, opts: { strength?: number; duration?: number } = {}) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running' || !this.on) return 0;
    const t = ctx.currentTime + 0.004; const s = opts.strength ?? 1;
    let dur = 0.3;
    switch (name) {
      case 'mic': dur = this.mic(t, s); break;
      case 'crash': dur = this.crash(t, s); break;
      case 'drumroll': dur = this.drumroll(t, opts.duration ?? 2.6); break;
      case 'whoosh': dur = this.whoosh(t, opts.duration ?? 0.7); break;
      case 'murmur': dur = this.murmur(t, opts.duration ?? 2.4, 0.55 * s); break;
      case 'paper': dur = this.paper(t); break;
      case 'chime': dur = this.chime(t); break;
    }
    this.duckFor(dur * 1000 + 250);
    return dur;
  }
  /** The crowd: a recording when one exists, the murmur otherwise for the quieter reactions. */
  crowd(kind: CrowdSound) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running' || !this.on) return;
    const buf = this.samples.get(kind);
    if (buf) { const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.value = 0.7; src.connect(g); g.connect(this.sfxBus); g.connect(this.verb); src.start(); this.duckFor(buf.duration * 1000 + 200); return; }
    if (kind === 'murmur' || kind === 'ooh' || kind === 'gasp') this.play('murmur', { duration: kind === 'murmur' ? 2.2 : 1.4, strength: kind === 'murmur' ? 1 : 0.8 });
  }
  /** The crowd's voices the server has (from its settings, by version). They load once the sound is unlocked. */
  setCrowd(map: Record<string, string> | undefined) { this.crowdMap = map || {}; if (this.ctx) this.loadCrowd(); }
  private async loadCrowd() {
    if (this.crowdBusy || !this.ctx) return; this.crowdBusy = true;
    try {
      for (const k of CROWD) {
        const v = this.crowdMap[k]; if (!v || this.crowdHave[k] === v) continue;
        try {
          const r = await fetch(`/api/sfx/${k}?v=${encodeURIComponent(v)}`);
          if (r.status !== 200 || !(r.headers.get('content-type') || '').includes('audio')) continue;
          this.samples.set(k, await this.ctx.decodeAudioData(await r.arrayBuffer())); this.crowdHave[k] = v;
        } catch {}
      }
    } finally { this.crowdBusy = false; }
  }

  private noise() {
    if (this.noiseBuf) return this.noiseBuf;
    const ctx = this.ctx!; const len = ctx.sampleRate * 2; const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (this.noiseBuf = b);
  }
  private impulse(sec: number, decay: number) {
    const ctx = this.ctx!; const len = Math.floor(ctx.sampleRate * sec); const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); const pre = Math.floor(ctx.sampleRate * 0.012); for (let i = 0; i < len; i++) d[i] = i < pre ? 0 : (Math.random() * 2 - 1) * Math.pow(1 - (i - pre) / (len - pre), decay); }
    return b;
  }
  private env(t: number, peak: number, attack: number, decay: number, out: AudioNode, send = 0) {
    const g = this.ctx!.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out); if (send) { const sg = this.ctx!.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(this.verb); }
    return g;
  }
  private osc(type: OscillatorType, f0: number, f1: number, t: number, glide: number, stop: number, to: AudioNode) {
    const o = this.ctx!.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide); o.connect(to); o.start(t); o.stop(t + stop); return o;
  }
  private burst(t: number, dur: number, filter: BiquadFilterType, freq: number, q: number, to: AudioNode, offset = Math.random()) {
    const ctx = this.ctx!; const src = ctx.createBufferSource(); src.buffer = this.noise(); const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
    src.connect(f); f.connect(to); src.start(t, offset, dur + 0.05); return f;
  }

  /** A finger tapping the mic, twice through the PA: a soft thump, the pop of the grille, and the hall answering. */
  private mic(t: number, s: number) {
    this.osc('sine', 120, 52, t, 0.07, 0.25, this.env(t, 0.75 * s, 0.002, 0.16, this.sfxBus, 0.45));
    this.burst(t, 0.04, 'bandpass', 420, 1.1, this.env(t, 0.45 * s, 0.001, 0.035, this.sfxBus, 0.35));
    this.burst(t + 0.004, 0.02, 'highpass', 2600, 0.6, this.env(t + 0.004, 0.08 * s, 0.001, 0.02, this.sfxBus));
    return 0.4;
  }
  /** The drummer's crash cymbal at the end of a roll: a hiss that shimmers and dies away. */
  private crash(t: number, s: number) {
    this.burst(t, 1.8, 'highpass', 5200, 0.5, this.env(t, 0.32 * s, 0.003, 1.6, this.sfxBus, 0.4));
    this.burst(t, 1.2, 'bandpass', 8600, 1.4, this.env(t, 0.14 * s, 0.002, 1.1, this.sfxBus, 0.3));
    this.osc('sine', 110, 70, t, 0.2, 0.4, this.env(t, 0.4 * s, 0.002, 0.3, this.sfxBus, 0.3));
    return 1.8;
  }
  /** A snare roll that builds, while Peruzzi reads. */
  private drumroll(t: number, dur: number) {
    const rate = 26; const n = Math.floor(dur * rate);
    for (let i = 0; i < n; i++) {
      const at = t + i / rate + (Math.random() - 0.5) * 0.004; const k = i / n; const amp = (0.1 + 0.42 * k * k) * (i % 2 ? 0.8 : 1);
      this.burst(at, 0.05, 'bandpass', 1900 + Math.random() * 300, 0.8, this.env(at, amp, 0.001, 0.045, this.sfxBus, 0.2));
      if (i % 3 === 0) this.osc('triangle', 210, 180, at, 0.04, 0.07, this.env(at, amp * 0.25, 0.001, 0.05, this.sfxBus));
    }
    return dur;
  }
  private paper(t: number) { this.burst(t, 0.22, 'highpass', 2600, 0.4, this.env(t, 0.12, 0.03, 0.18, this.sfxBus)); return 0.3; }
  /** Air moving: a note sliding in, a spotlight swinging round. */
  private whoosh(t: number, dur: number) {
    const f = this.burst(t, dur, 'bandpass', 300, 1.1, this.env(t, 0.32, dur * 0.55, dur * 0.45, this.sfxBus, 0.3));
    f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(1900, t + dur * 0.7);
    return dur;
  }
  /** A room full of people talking between songs. */
  private murmur(t: number, dur: number, amp: number) {
    const ctx = this.ctx!; const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(amp, t + 0.5); out.gain.setValueAtTime(amp, t + dur - 0.7); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.sfxBus); const sg = ctx.createGain(); sg.gain.value = 0.6; out.connect(sg); sg.connect(this.verb);
    for (const [freq, q] of [[380, 3], [620, 3.5], [980, 4], [1500, 4.5], [2300, 5]] as [number, number][]) {
      const g = ctx.createGain(); g.gain.value = 0;
      for (let at = t; at < t + dur; at += 0.09 + Math.random() * 0.08) g.gain.setTargetAtTime(Math.random() < 0.3 ? 0.02 : 0.08 + Math.random() * 0.14, at, 0.03);
      g.connect(out); this.burst(t, dur, 'bandpass', freq * (0.95 + Math.random() * 0.1), q, g);
    }
    return dur;
  }
  /** A soft bell, for a sweet note. */
  private chime(t: number) {
    [[659.3, 0], [987.8, 0.09], [1318.5, 0.18]].forEach(([f, d]) => this.osc('sine', f, f, t + d, 0, 1.6, this.env(t + d, 0.09, 0.006, 1.4, this.sfxBus, 0.6)));
    return 1.8;
  }
}

export const sound = new Sound();
// the end-to-end tests read and drive it on the dev server
if (import.meta.env.DEV) (window as any).__sound = sound;
