import { RefObject, useEffect, useRef } from 'react';
import { beatAt, BREAK, inBreak, partAt, SECTIONS } from '../lib/beat';

type RGB = readonly [number, number, number];
/** The lights' colours: the site's rose, blush and petal as light (brighter than they are on paper), with a warm white,
 *  amber, magenta and violet to play against them. */
const L: Record<string, RGB> = {
  rose: [255, 92, 134], blush: [255, 196, 210], petal: [255, 150, 176], warm: [255, 230, 205],
  amber: [255, 168, 92], magenta: [228, 72, 160], violet: [150, 110, 255],
};
/** A look: the truss's two colours (every other head) and the floor's. A new one with each part of the song, and every
 *  two bars within it. */
const LOOKS: [RGB, RGB, RGB][] = [
  [L.rose, L.blush, L.magenta], [L.warm, L.rose, L.amber], [L.magenta, L.violet, L.rose],
  [L.petal, L.warm, L.rose], [L.amber, L.rose, L.violet], [L.violet, L.blush, L.magenta],
];
/** the moving heads along the truss, and the lights on the stage floor, as fractions of the width */
const HEADS = [0.1, 0.26, 0.42, 0.58, 0.74, 0.9];
const FLOOR = [0.17, 0.38, 0.62, 0.83];
/** how much of the stage's height the truss and its heads take, from the top */
const RIG = 0.2;
/** a beam, as layers: a bright core inside softer, wider cones (spread in degrees each side, and strength) */
const LAYERS: [number, number][] = [[1.7, 0.46], [4, 0.2], [9, 0.09]];

const TAU = Math.PI * 2;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const ease = (k: number) => k * k * (3 - 2 * k);
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
/** a number from 0 to 1 that looks random, the same every time for the same beat and head */
const hash = (k: number) => { const v = Math.sin(k * 12.9898) * 43758.5453; return v - Math.floor(v); };
/** the order a chase lights the heads in, a mirrored pair a beat (0 is the outside pair): in, and back out */
const CHASE = [0, 1, 2, 1];

/** What the heads do, one move to each part of the song. A move says where each head points on every beat, in degrees
 *  off its aim (to the right when positive; `mid` is what points it at Peruzzi), and how bright it is from that beat
 *  on. Every move lands on the beat, however it gets there: a swing leaves one beat's place as the beat goes and
 *  eases into the next one's right on the next beat, as the crowd sways; a snap holds its place, then whips across to
 *  land on the next beat. */
type Move = { at: (n: number, i: number, x: number, mid: number) => number; lit?: (n: number, i: number) => number; snap?: boolean };
const MOVES: Move[] = [
  { at: (n) => (n % 2 ? 26 : -26) },                                                            // all together, a side a beat
  { at: (n, _i, x) => (x - 0.5) * (n % 2 ? 14 : 84), snap: true },                              // fanning out on one and three, in on two and four
  { at: (n, i) => (i % 2 ? 1 : -1) * (n % 2 ? 24 : -24), lit: (n, i) => ((n + i) % 2 ? 1 : 0.4) },   // crossing over, every other head bright in turn
  { at: (n, i) => 24 * Math.sin(TAU * (n / 4 - i / 6)) },                                         // a wave rolling along the rig, a step a beat
  { at: (n, i) => ((n + i) % 2 ? 16 : -16), lit: (n, i) => (CHASE[mod(n, 4)] === Math.min(i, HEADS.length - 1 - i) ? 1 : 0.15), snap: true },   // a chase
  { at: (n, i, _x, mid) => (mod(n, 4) === 0 ? mid : 56 * hash(n * 7 + i * 13) - 28), snap: true },  // all on Peruzzi on the one, scattered between
  { at: (n, i, x) => (n % 2 ? (x - 0.5) * 84 : (i % 2 ? 1 : -1) * 22), snap: true },             // fanned out, then crossed, a beat each: the drop
];

/** Smoke for the light to show up in: a tile of soft noise, made once. */
let tile: HTMLCanvasElement | null = null;
function hazeTile() {
  if (tile) return tile;
  const N = 256; const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); if (!g) return c;
  const img = g.createImageData(N, N);
  const octaves: [number, number][] = [[6, 0.6], [12, 0.28], [24, 0.12]];
  const grids = octaves.map(([n]) => Array.from({ length: n * n }, () => Math.random()));
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    let v = 0;
    octaves.forEach(([n, amp], o) => {
      const fx = (px / N) * n, fy = (py / N) * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = ease(fx - x0), ty = ease(fy - y0);
      const at = (i: number, j: number) => grids[o][mod(j, n) * n + mod(i, n)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx, bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      v += (top + (bot - top) * ty) * amp;
    });
    const k = (py * N + px) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * (0.38 + 0.62 * v));
  }
  g.putImageData(img, 0, 0);
  return (tile = c);
}

/** The stage's lights, on two canvases over the photo. Behind, the rig: a truss across the top with its moving heads,
 *  each turned to where its beam goes. In front, the light, added to the picture as light is: the beams from the heads
 *  and from the floor through the haze, the wash on the back wall, the lenses' glare, a warm spot on Peruzzi, and a
 *  hit of white where each section of the song starts. It all keeps to the song's beat (see lib/beat.ts): every move
 *  lands on a beat, every beat is the brightest moment, each bar's first brighter still, and the moves and colours
 *  change on a bar's first beat, with each part of the song. For the break before the drop, the beams close in on
 *  Peruzzi and go dark but for a flash on each beat; the drop hits hardest. Between songs they drift at half the tempo,
 *  dimmer; with reduced motion, or `still`, they hold one look. The look's colour is set on `room` as `--rim` and
 *  `--led`, for the crowd's outlines and the stage's LED strip; `kick` makes them all jump (the crash, a tap on the mic). */
export function LightRig({ room, kick, still = false }: { room: RefObject<HTMLElement>; kick: RefObject<{ at: number; s: number }>; still?: boolean }) {
  const rigRef = useRef<HTMLCanvasElement>(null), lightRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const rig = rigRef.current, light = lightRef.current, box = room.current;
    const r = rig?.getContext('2d'), l = light?.getContext('2d');
    if (!rig || !light || !box || !r || !l) return;
    const moving = !still && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let haze: CanvasPattern | null = null;
    try { haze = l.createPattern(hazeTile(), 'repeat'); } catch {}
    let w = 0, h = 0, dpr = 1, raf = 0, lookAt = -1;

    const beam = (ox: number, oy: number, dx: number, dy: number, len: number, r0: number, c: RGB, I: number) => {
      const ex = ox + dx * len, ey = oy + dy * len, nx = dy, ny = -dx;
      for (const [spread, a] of LAYERS) {
        const r1 = r0 + len * Math.tan((spread * Math.PI) / 180); const A = a * I;
        const g = l.createLinearGradient(ox, oy, ex, ey);
        g.addColorStop(0, rgba(c, A)); g.addColorStop(0.3, rgba(c, A * 0.5)); g.addColorStop(1, rgba(c, 0));
        l.fillStyle = g;
        l.beginPath(); l.moveTo(ox + nx * r0, oy + ny * r0); l.lineTo(ex + nx * r1, ey + ny * r1); l.lineTo(ex - nx * r1, ey - ny * r1); l.lineTo(ox - nx * r0, oy - ny * r0); l.closePath(); l.fill();
      }
    };
    /** a soft round of light, brightest in the middle */
    const glow = (cx: number, cy: number, rad: number, c: RGB, a: number, sy = 1) => {
      if (a <= 0.004) return;
      l.save(); l.translate(cx, cy); l.scale(1, sy);
      const g = l.createRadialGradient(0, 0, 0, 0, 0, rad); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
      l.fillStyle = g; l.fillRect(-rad, -rad, rad * 2, rad * 2); l.restore();
    };
    /** a lens: a white-hot point in a ring of its colour, and a faint streak across */
    const flare = (cx: number, cy: number, rad: number, c: RGB, I: number) => {
      const g = l.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(1, 0.95 * I).toFixed(3)})`); g.addColorStop(0.22, rgba(c, 0.75 * I)); g.addColorStop(1, rgba(c, 0));
      l.fillStyle = g; l.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      glow(cx, cy, rad * 3.2, c, 0.18 * I, 0.12);
    };

    const draw = (now: number) => {
      if (!w || !h) return;
      const s = w / 400;
      const { beats, live } = beatAt(now);
      const go = live && moving;
      // the time, in beats: the song's while it plays; a slower clock between songs; one moment held when still
      const b = !moving ? 2 : live ? beats : beats * 0.5;
      const n = Math.floor(b), f = b - n;   // the beat just gone, and how far on from it
      const part = partAt(b, go);
      const lookN = moving ? mod(part.index * 3 + Math.floor((b - part.start) / 8), LOOKS.length) : 0; const look = LOOKS[lookN];
      if (lookN !== lookAt) { lookAt = lookN; const c = `rgb(${look[0].join(' ')})`; box.style.setProperty('--rim', c); box.style.setProperty('--led', c); }
      const dark = go && inBreak(b);                              // the break before the drop
      const pulse = go ? Math.exp(-f * 5) : 0;                    // each beat
      const downbeat = go && mod(n, 4) === 0 ? Math.exp(-f * 3) : 0;   // each bar's first
      // a hit of white where each section starts, the drop hardest
      const hit = go && SECTIONS.includes(part.start) && b - part.start < 1 ? Math.exp(-(b - part.start) * 12) * (part.start === BREAK[1] ? 1.7 : 1) : 0;
      const kk = kick.current; const boost = moving && kk?.at ? kk.s * Math.exp(-(now - kk.at) / 260) : 0;

      // where each head points on a beat: the move of the part that beat is in (in the break, at Peruzzi)
      const y0 = Math.max(3, h * 0.03), th = Math.max(5, 7 * s), hw = Math.max(7, 9 * s), hh = Math.max(8, 11 * s);
      const pivot = y0 + th + hh * 0.5 + 3 * s;
      const aim = (x: number) => (0.5 - x) * 36;
      const mid = (x: number) => (Math.atan2((0.5 - x) * w, h * 0.42 - pivot) * 180) / Math.PI - aim(x);
      const moveOn = (k: number) => (moving ? MOVES[mod(partAt(k, go).index, MOVES.length)] : MOVES[1]);
      const target = (k: number, i: number, x: number) => (go && inBreak(k) ? mid(x) : moveOn(k).at(k, i, x, mid(x)));
      // and on its way to the next beat's place: a swing or a snap, as the next beat's move goes (into the break, and
      // into each section, a snap)
      const snap = !moving ? false : (go && (inBreak(n + 1) || SECTIONS.includes(n + 1))) || !!moveOn(n + 1).snap;
      const t = !moving ? 0 : snap ? (f < 0.55 ? 0 : ((f - 0.55) / 0.45) ** 3) : 0.5 - 0.5 * Math.cos(Math.PI * f);
      const heads = HEADS.map((x, i) => {
        const from = target(n, i, x), to = target(n + 1, i, x);
        const pan = (aim(x) + from + (to - from) * t) * (Math.PI / 180);
        const level = moveOn(n).lit?.(n, i) ?? 1;
        const I = !moving ? 0.75
          : !go ? level * 0.5 + 0.5 * boost
          : dark ? 0.1 + 0.7 * Math.exp(-f * 8)
          : Math.min(1.25, level * (0.5 + 0.45 * pulse + 0.2 * downbeat) + 0.5 * boost);
        const dx = Math.sin(pan), dy = Math.cos(pan);
        return { cx: x * w, pan, dx, dy, ox: x * w + dx * hh * 0.55, oy: pivot + dy * hh * 0.55, I, c: i % 2 ? look[1] : look[0] };
      });
      if (import.meta.env.DEV) (light as any).__frame = { b, live: go, pans: heads.map((hd) => hd.pan), lit: heads.map((hd) => hd.I) };

      // the rig: the truss, each head hanging in its yoke, turned to its beam, its lens lit
      r.setTransform(dpr, 0, 0, dpr, 0, 0); r.clearRect(0, 0, w, h * RIG);
      r.strokeStyle = '#4b3b43'; r.lineWidth = Math.max(1, 1.2 * s); r.beginPath();
      r.moveTo(0, y0); r.lineTo(w, y0); r.moveTo(0, y0 + th); r.lineTo(w, y0 + th);
      for (let xx = 0, up = true; xx < w + th; xx += th, up = !up) { r.moveTo(xx, up ? y0 : y0 + th); r.lineTo(xx + th, up ? y0 + th : y0); }
      r.stroke();
      for (const hd of heads) {
        r.strokeStyle = '#3d3037'; r.lineWidth = Math.max(1.2, 1.6 * s); r.beginPath();
        r.moveTo(hd.cx - hw * 0.62, y0 + th); r.lineTo(hd.cx - hw * 0.62, pivot); r.moveTo(hd.cx + hw * 0.62, y0 + th); r.lineTo(hd.cx + hw * 0.62, pivot);
        r.moveTo(hd.cx - hw * 0.62, y0 + th); r.lineTo(hd.cx + hw * 0.62, y0 + th); r.stroke();
        r.save(); r.translate(hd.cx, pivot); r.rotate(-hd.pan);
        r.fillStyle = '#2b2026'; r.strokeStyle = '#5c4953'; r.lineWidth = Math.max(0.8, s);
        const rr = 2 * s; r.beginPath(); r.moveTo(-hw / 2 + rr, -hh / 2); r.arcTo(hw / 2, -hh / 2, hw / 2, hh / 2, rr); r.arcTo(hw / 2, hh / 2, -hw / 2, hh / 2, rr); r.arcTo(-hw / 2, hh / 2, -hw / 2, -hh / 2, rr); r.arcTo(-hw / 2, -hh / 2, hw / 2, -hh / 2, rr); r.closePath(); r.fill(); r.stroke();
        r.fillStyle = rgba(hd.c, 0.35 + 0.65 * Math.min(1, hd.I)); r.beginPath(); r.ellipse(0, hh * 0.42, hw * 0.34, hh * 0.13, 0, 0, TAU); r.fill();
        r.restore();
      }

      // the light
      l.setTransform(dpr, 0, 0, dpr, 0, 0);
      l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, w, h);
      l.globalCompositeOperation = 'lighter';
      const wash = !moving ? 0.2 : dark ? 0.04 : 0.16 + 0.14 * pulse + 0.08 * downbeat + 0.15 * boost;
      glow(w * 0.14, h * 0.02, w * 0.62, look[0], wash);
      glow(w * 0.86, h * 0.02, w * 0.62, look[1], wash);
      for (const hd of heads) beam(hd.ox, hd.oy, hd.dx, hd.dy, h * 1.3, 2.2 * s, hd.c, hd.I);
      // the floor lights, in every other part and for the drop: leaning across each other a beat at a time, every other
      // one bright in turn
      const floorY = h * 0.765;
      const floorOn = !moving ? 0.8 : dark ? 0 : mod(part.index, 2) || (go && part.start === BREAK[1]) ? 1 : 0;
      const sway = (k: number, j: number) => (moving ? ((k + j) % 2 ? 12 : -12) : 0);
      const tf = moving ? 0.5 - 0.5 * Math.cos(Math.PI * f) : 0;
      const floor = FLOOR.map((x, j) => {
        const lean = ((x - 0.5) * 30 + sway(n, j) + (sway(n + 1, j) - sway(n, j)) * tf) * (Math.PI / 180);
        const I = floorOn * (go ? (mod(n + j, 2) ? 0.85 : 0.35) * (0.45 + 0.55 * pulse) : 0.4) + 0.3 * boost;
        return { x: x * w, dx: Math.sin(lean), dy: -Math.cos(lean), I };
      });
      for (const fl of floor) if (fl.I > 0.01) beam(fl.x, floorY, fl.dx, fl.dy, h * 0.95, 1.8 * s, look[2], fl.I * 0.7);
      // the haze the beams show up in, drifting
      if (haze) {
        try { haze.setTransform(new DOMMatrix([2, 0, 0, 2, -mod(now * 0.012, 512), -mod(now * 0.004, 512)])); } catch {}
        l.globalCompositeOperation = 'destination-in'; l.fillStyle = haze; l.fillRect(0, 0, w, h);
        l.globalCompositeOperation = 'lighter';
      }
      for (const hd of heads) flare(hd.ox, hd.oy, 9 * s, hd.c, Math.min(1, hd.I));
      for (const fl of floor) if (fl.I > 0.01) flare(fl.x, floorY, 6 * s, look[2], Math.min(1, fl.I));
      // the warm spot on Peruzzi, alone in the break
      glow(w * 0.5, h * 0.4, w * 0.3, L.warm, dark ? 0.12 + 0.12 * pulse : 0.07 + 0.04 * pulse, 1.25);
      // a hit of white
      const white = 0.2 * hit + 0.16 * boost;
      if (white > 0.005) { l.fillStyle = `rgba(255,238,226,${Math.min(0.5, white).toFixed(3)})`; l.fillRect(0, 0, w, h); }
    };

    const fit = () => {
      w = box.clientWidth; h = box.clientHeight; dpr = Math.min(1.5, window.devicePixelRatio || 1);
      light.width = Math.round(w * dpr); light.height = Math.round(h * dpr);
      rig.width = Math.round(w * dpr); rig.height = Math.round(h * RIG * dpr);
      draw(performance.now());
    };
    const loop = (now: number) => { draw(now); raf = requestAnimationFrame(loop); };
    const size = new ResizeObserver(fit); size.observe(box);
    // only while the stage can be seen
    const seen = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e?.isIntersecting && moving) raf = requestAnimationFrame(loop); });
    seen.observe(box);
    fit();
    return () => { cancelAnimationFrame(raf); size.disconnect(); seen.disconnect(); };
  }, [room, kick, still]);
  return (
    <>
      <canvas ref={rigRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 w-full" style={{ height: `${RIG * 100}%` }} />
      <canvas ref={lightRef} aria-hidden data-lights className="pointer-events-none absolute inset-0 h-full w-full" style={{ mixBlendMode: 'screen' }} />
    </>
  );
}
