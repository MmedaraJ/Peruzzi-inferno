import { Answer, NoteKind } from './api';

/** The pictures people post: one note (as asked, or ticked once it's answered), or a tracklist. Drawn on a canvas in
 *  the site's look (dark concrete, a sheet of sepia paper, the red of the stamp) as a story (1080×1920) or a square
 *  (1080×1080). */
export type CardSize = 'story' | 'square';
/** What a note says: who it's to, its line, Peruzzi's line and stamp, the three boxes, and the answer once ticked. */
export interface NoteData { noteNo: string; title: string; dear: string; line: string; peruzzi: string; escape: string; kind: NoteKind | null; stamp: string; answer?: Answer | null; nameplate?: string }
export interface NoteCardData extends NoteData { site: string; song?: string; artist?: string }
export interface TracklistCardData { name: string; meta: string; notes: { noteNo: string; title: string; dear: string; answer: Answer | null; escape: string }[]; site: string; song?: string; artist?: string; nameplate?: string }

const BONE = '#ece5d8', PAPER = '#ede5d6', PAPER_INK = '#1d1a16', ASH = '#857d72', STAMP = '#a11d2a', STAMP_DARK = '#26221d';
/** the paper's rules: under the note number, and round Peruzzi's line */
const RULE = 'rgba(29,26,22,0.16)';
const SERIF = '"EB Garamond Variable", "EB Garamond", Georgia, serif';
/** the display face, with EB Garamond standing in for any letter it lacks (Yoruba's marks) */
const DISPLAY = 'Marcellus, "EB Garamond Variable", "EB Garamond", Georgia, serif';
const CAPS = '"Marcellus SC", Marcellus, Georgia, serif';
const INKS: Record<NoteKind, string> = { love: STAMP, not_love: STAMP_DARK, nonsense: STAMP_DARK };
/** the three boxes, in order */
export const CHOICES: Answer[] = ['yes', 'no', 'escape'];
export const choiceLabel = (a: Answer, escape: string) => (a === 'yes' ? 'Yes' : a === 'no' ? 'No' : escape);

let fontsReady: Promise<void> | null = null;
export function loadCardFonts() {
  return (fontsReady ??= Promise.all([
    `400 40px ${DISPLAY}`, `400 40px ${CAPS}`, `400 40px ${SERIF}`, `600 40px ${SERIF}`, `italic 400 40px ${SERIF}`,
  ].map((f) => document.fonts.load(f, 'Tọ́kẹ́ Aa ₦'))).then(() => undefined).catch(() => undefined));
}

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; }
let grainTile: HTMLCanvasElement | null = null;
function grain() {
  if (grainTile) return grainTile;
  const [c, x] = canvas(256, 256); const img = x.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0); return (grainTile = c);
}
function texture(x: CanvasRenderingContext2D, w: number, h: number, alpha: number, op: GlobalCompositeOperation = 'overlay', ox = 0, oy = 0) {
  x.save(); x.globalAlpha = alpha; x.globalCompositeOperation = op; x.fillStyle = x.createPattern(grain(), 'repeat')!; x.fillRect(ox, oy, w, h); x.restore();
}
/** The stage's dark: concrete with a spotlight falling down across it. */
function concrete(x: CanvasRenderingContext2D, w: number, h: number) {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1d1b17'); g.addColorStop(0.55, '#131210'); g.addColorStop(1, '#0a0908');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // the spotlight, from above
  const s = x.createRadialGradient(w / 2, -h * 0.05, 10, w / 2, h * 0.05, h * 0.75);
  s.addColorStop(0, 'rgba(236,229,216,0.16)'); s.addColorStop(0.45, 'rgba(236,229,216,0.06)'); s.addColorStop(1, 'rgba(236,229,216,0)');
  x.fillStyle = s; x.fillRect(0, 0, w, h);
  const v = x.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = v; x.fillRect(0, 0, w, h);
  texture(x, w, h, 0.09);
}
function paper(x: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, tilt: number) {
  x.save(); x.translate(px + pw / 2, py + ph / 2); x.rotate(tilt);
  x.shadowColor = 'rgba(0,0,0,0.65)'; x.shadowBlur = 60; x.shadowOffsetY = 26;
  x.fillStyle = PAPER; x.fillRect(-pw / 2, -ph / 2, pw, ph); x.shadowColor = 'transparent';
  const g = x.createRadialGradient(-pw * 0.3, -ph * 0.45, 10, -pw * 0.3, -ph * 0.45, ph); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(120,96,64,0.14)');
  x.fillStyle = g; x.fillRect(-pw / 2, -ph / 2, pw, ph);
  x.beginPath(); x.rect(-pw / 2, -ph / 2, pw, ph); x.clip(); texture(x, pw, ph, 0.07, 'multiply', -pw / 2, -ph / 2);
  x.restore();
}
let coverImg: Promise<HTMLImageElement | null> | null = null;
/** The cover (Peruzzi, for now), so a note says who asked it before a word of it is read. */
function cover() {
  return (coverImg ??= new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = '/media/img/cover-600.jpg'; }));
}
/** The cover as a print pinned to a corner of the note: a white border, a shadow, a slight tilt. */
function print(x: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, size: number, tilt: number) {
  const b = Math.round(size * 0.05);
  x.save(); x.translate(cx, cy); x.rotate(tilt);
  x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = size * 0.14; x.shadowOffsetY = size * 0.05;
  x.fillStyle = '#f6f1e8'; x.fillRect(-size / 2 - b, -size / 2 - b, size + b * 2, size + b * 2); x.shadowColor = 'transparent';
  x.drawImage(img, -size / 2, -size / 2, size, size);
  x.restore();
}
function spaced(x: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number, align: 'center' | 'left' | 'right' = 'center') {
  (x as any).letterSpacing = `${spacing}px`; x.textAlign = align; x.fillText(text, cx + (align === 'center' ? spacing / 2 : 0), y); (x as any).letterSpacing = '0px';
}
/** Wraps to at most `lines`, shrinking the type until it fits; the last line ends in an ellipsis if it still doesn't. */
function wrap(x: CanvasRenderingContext2D, text: string, font: (px: number) => string, size: number, min: number, width: number, lines: number) {
  for (let px = size; px >= min; px -= 2) {
    x.font = font(px); const out = lay(x, text, width);
    if (out.length <= lines || px - 2 < min) {
      if (out.length > lines) { out.length = lines; let l = out[lines - 1]; while (l && x.measureText(`${l}…`).width > width) l = l.replace(/\s*\S+$/, ''); out[lines - 1] = `${l}…`; }
      return { lines: out, px };
    }
  }
  return { lines: [text], px: min };
}
function lay(x: CanvasRenderingContext2D, text: string, width: number) {
  const words = text.split(/\s+/); const out: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (x.measureText(t).width <= width || !cur) cur = t; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur); return out;
}
/** Two lines of the same size evened out, so the second never holds a word on its own (any other count as it was). */
function balanced(x: CanvasRenderingContext2D, w: { lines: string[]; px: number }, font: (px: number) => string, width: number) {
  if (w.lines.length !== 2 || w.lines[1].endsWith('…')) return w;
  x.font = font(w.px); const words = w.lines.join(' ').split(/\s+/);
  let best = w.lines; let bestW = Math.max(...w.lines.map((l) => x.measureText(l).width));
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '); const m = Math.max(x.measureText(a).width, x.measureText(b).width);
    if (m <= width && m < bestW) { best = [a, b]; bestW = m; }
  }
  return { lines: best, px: w.px };
}
function block(x: CanvasRenderingContext2D, lines: string[], left: number, y: number, lh: number, align: CanvasTextAlign = 'left') { x.textAlign = align; lines.forEach((l, i) => x.fillText(l, left, y + i * lh)); return y + lines.length * lh; }

/** The stamp's mark, inked and worn, unrotated, on a canvas of its own: `maxW` and `big` in the card's units, drawn at
 *  `scale` device pixels to the unit (into `into` when given). Its middle is the stamp's middle. */
export function stampMark(kind: NoteKind, text: string, maxW: number, big: number, scale = 1, into?: HTMLCanvasElement) {
  const ink = INKS[kind] || STAMP; const word = text.toUpperCase();
  const cw = maxW + 60, ch = big * 1.7 + 60;
  const c = into ?? document.createElement('canvas'); c.width = Math.ceil(cw * scale); c.height = Math.ceil(ch * scale);
  const s = c.getContext('2d')!; s.setTransform(scale, 0, 0, scale, 0, 0);
  let px = big; s.font = `400 ${px}px ${CAPS}`; (s as any).letterSpacing = `${px * 0.09}px`;
  while (s.measureText(word).width > maxW - px * 0.9 && px > 20) { px -= 2; s.font = `400 ${px}px ${CAPS}`; (s as any).letterSpacing = `${px * 0.09}px`; }
  const w = Math.min(maxW, s.measureText(word).width + px * 0.9); const h = px * 1.3; const ox = (cw - w) / 2, oy = (ch - h) / 2;
  s.strokeStyle = ink; s.fillStyle = ink; s.lineWidth = Math.max(4, px * 0.075); s.strokeRect(ox, oy, w, h);
  s.lineWidth = Math.max(2, px * 0.03); const ins = px * 0.11; s.strokeRect(ox + ins, oy + ins, w - ins * 2, h - ins * 2);
  s.textAlign = 'center'; s.textBaseline = 'middle';
  s.fillText(word, cw / 2 + px * 0.045, oy + h * 0.54);
  // worn ink: knock specks out of it
  s.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) { s.globalAlpha = Math.random() * 0.6; const r = Math.random() * 2.6; s.beginPath(); s.arc(ox + Math.random() * w, oy + Math.random() * h, r, 0, Math.PI * 2); s.fill(); }
  s.globalAlpha = 0.22; s.fillStyle = s.createPattern(grain(), 'repeat')!; s.fillRect(0, 0, cw, ch);
  return c;
}
/** The stamp, inked and worn, pressed onto the card around (cx, cy). */
function stamp(x: CanvasRenderingContext2D, kind: NoteKind, text: string, cx: number, cy: number, maxW: number, big: number, angle: number) {
  const c = stampMark(kind, text, maxW, big);
  x.save(); x.translate(cx, cy); x.rotate(angle); x.globalAlpha = 0.92; x.globalCompositeOperation = 'multiply'; x.drawImage(c, -c.width / 2, -c.height / 2); x.restore();
}
/** A tick in biro, in the stamp's red, over a box of `size` with its top left at (bx, by): a short stroke down and a
 *  long one up, the way a hand makes it. */
export const TICK = (size: number) => `M ${size * 0.16} ${size * 0.5} L ${size * 0.4} ${size * 0.82} L ${size * 1.02} ${-size * 0.08}`;
function tick(x: CanvasRenderingContext2D, bx: number, by: number, size: number) {
  x.save(); x.translate(bx, by); x.strokeStyle = STAMP; x.lineWidth = Math.max(4, size * 0.13); x.lineCap = 'round'; x.lineJoin = 'round'; x.globalAlpha = 0.95;
  x.stroke(new Path2D(TICK(size))); x.restore();
}

/** The line under the paper that brings in the next note: the question every card asks the people who see it. */
export const INVITATION = 'Who’s on your mind?';
const SIGNED = (nameplate?: string) => `ASKED BY ${(nameplate || 'Peruzzi').toUpperCase()}`;
/** The way in, under the paper: the invitation and the address on one line, in the same type, the address underlined
 *  as a link would be. */
function invite(x: CanvasRenderingContext2D, site: string, cx: number, y: number, px: number) {
  x.font = `400 ${px}px ${SERIF}`; x.textAlign = 'left'; x.fillStyle = BONE;
  const a = `${INVITATION} `, wa = x.measureText(a).width, ws = x.measureText(site).width, at = cx - (wa + ws) / 2;
  x.fillText(a, at, y); x.fillText(site, at + wa, y);
  x.fillRect(at + wa, y + px * 0.14, ws, Math.max(2, Math.round(px * 0.05)));
}
/** "PERUZZI ASKED", over the paper. */
function wordmark(x: CanvasRenderingContext2D, cx: number, y: number, px: number) {
  x.fillStyle = BONE; x.font = `400 ${px}px ${DISPLAY}`; spaced(x, 'PERUZZI ASKED', cx, y, px * 0.16);
  const w = Math.min(px * 4.2, 300); x.fillStyle = 'rgba(236,229,216,0.35)'; x.fillRect(cx - w / 2, y + px * 0.42, w, 2);
}

let ruler: CanvasRenderingContext2D | null = null;
/** The note, on its paper, laid out in the story card's units (the paper 928 wide, as tall as what's on it), from its
 *  top: the note's number, who it's to as its headline under the cover pinned to its corner, its line, Peruzzi's line
 *  in a box with his stamp on its corner, the question, the three boxes, and who asked it. The card draws it on its
 *  wall, and the note's page draws the same paper, so the two never differ. */
function notePaper(d: NoteData, story: boolean, img: HTMLImageElement | null) {
  const x = (ruler ??= canvas(1, 1)[1]);
  const pw = 1080 - (story ? 76 : 64) * 2, inset = story ? 64 : 50, TW = pw - inset * 2;
  const ps = story ? 200 : 136, pinDX = pw - (story ? 76 : 52), pinDY = story ? 80 : 44;
  const headDY = story ? 86 : 60;
  const nameDY = Math.max(headDY + (story ? 150 : 100), img ? pinDY + ps / 2 + (story ? 116 : 78) : 0);
  const presGap = story ? 70 : 44, foot = story ? 36 : 24;
  const room = (story ? 1340 : 820) - nameDY - presGap - foot;
  const head = `Dear ${d.dear},`;
  // the line, centred, its first words ("I think you") lighter
  const m = /^(I think you)\s+([\s\S]*)$/i.exec(d.line.trim());
  type Run = { t: string; font: string; ink: string; w: number };
  const runs = (px: number) => [
    ...(m ? m[1].split(/\s+/).map((t) => ({ t, font: `400 ${px}px ${DISPLAY}`, ink: 'rgba(29,26,22,0.55)' })) : []),
    ...(m ? m[2] : d.line).split(/\s+/).filter(Boolean).map((t) => ({ t, font: `400 ${px}px ${DISPLAY}`, ink: PAPER_INK })),
  ];
  const layRuns = (px: number, width: number) => {
    const out: Run[][] = []; let cur: Run[] = []; let cw = 0; const space = px * 0.26;
    for (const wd of runs(px)) {
      x.font = wd.font; const w = x.measureText(wd.t).width;
      if (cur.length && cw + space + w > width) { out.push(cur); cur = []; cw = 0; }
      cw += (cur.length ? space : 0) + w; cur.push({ ...wd, w });
    }
    if (cur.length) out.push(cur);
    // two lines are balanced, so the second never holds a word on its own
    if (out.length === 2) {
      const all = [...out[0], ...out[1]]; const wid = (rs: Run[]) => rs.reduce((t, r, i) => t + r.w + (i ? space : 0), 0);
      let best = out; let bestW = Math.max(wid(out[0]), wid(out[1]));
      for (let k = 1; k < all.length; k++) { const a = all.slice(0, k), b = all.slice(k); const w = Math.max(wid(a), wid(b)); if (w <= width && w < bestW) { best = [a, b]; bestW = w; } }
      return { lines: best, px };
    }
    return { lines: out, px };
  };
  const theLine = (k: number) => {
    for (let p = Math.round((story ? 54 : 34) * k); p >= (story ? 34 : 22); p -= 2) { const l = layRuns(p, TW); if (l.lines.length <= 3 || p <= (story ? 34 : 22)) return l; }
    return layRuns(story ? 34 : 22, TW);
  };
  const bleed = story ? 22 : 14, pad = story ? 34 : 22, labelH = story ? 30 : 20;
  // Peruzzi's line, on one line when it fits large enough, evened out over two (or three) when it doesn't
  const saying = (k: number) => {
    const font = (p: number) => `400 ${p}px ${DISPLAY}`, width = TW + bleed * 2 - pad * 2, big = Math.round((story ? 46 : 28) * k);
    for (let p = big; p >= Math.round((story ? 36 : 22) * k); p -= 2) { x.font = font(p); if (x.measureText(d.peruzzi).width <= width) return { lines: [d.peruzzi], px: p }; }
    return balanced(x, wrap(x, d.peruzzi, font, big, story ? 26 : 16, width, story ? 3 : 2), font, width);
  };
  // the three boxes: the third's words shrink to fit the paper
  const rowsOf = (k: number) => {
    const rowH = Math.round((story ? 92 : 56) * k), size = Math.round((story ? 48 : 30) * k), gap = Math.round(size * 0.55);
    const px = Math.round((story ? 44 : 28) * k);
    const labels = CHOICES.map((a) => {
      const font = (p: number) => `400 ${p}px ${DISPLAY}`; const text = choiceLabel(a, d.escape);
      const w = wrap(x, text, font, px, Math.round(px * 0.6), TW - size - gap, 1); return { a, text: w.lines[0], px: w.px };
    });
    return { rowH, size, gap, labels };
  };
  let li = theLine(1), se = { lines: [] as string[], px: 0 }, rows = rowsOf(1), boxH = 0, need = 0, qPx = 0;
  const lineGap = story ? 44 : 26, boxGap = story ? 40 : 22, qGap = story ? 52 : 28, rowsGap = story ? 26 : 14;
  for (let k = 1; k >= 0.6; k -= 0.05) {
    li = theLine(k); se = saying(k); rows = rowsOf(k); qPx = Math.round((story ? 64 : 38) * k);
    boxH = pad + labelH + (story ? 18 : 12) + se.lines.length * se.px * 1.25 + pad * 0.8;
    need = lineGap + li.lines.length * li.px * 1.18 + boxGap + boxH + qGap + qPx + rowsGap + rows.rowH * 3;
    if (need <= room) break;
  }
  const ph = nameDY + need + presGap + foot;
  // where things sit, from the paper's top: the box, its stamp on the corner, and each of the three rows
  const lineTop = nameDY + lineGap;
  const boxTop = lineTop + li.lines.length * li.px * 1.18 + boxGap;
  const qY = boxTop + boxH + qGap + qPx * 0.8;
  const rowsTop = qY + qPx * 0.2 + rowsGap;
  // Peruzzi's stamp on the box's top right corner, low enough to clear the line above the box
  const mark = { cx: pw - inset - (story ? 100 : 62), cy: boxTop + (story ? 30 : 19), maxW: story ? 270 : 168, big: story ? 70 : 42, angle: -0.14 };
  // each row's box, its left in from the paper's middle: the three line up under one another, centred as a block
  const longest = Math.max(...rows.labels.map((l) => { x.font = `400 ${l.px}px ${DISPLAY}`; return x.measureText(l.text).width; }));
  const blockW = Math.min(TW, rows.size + rows.gap + longest);
  const boxLeft = (pw - blockW) / 2;
  const rowAt = rows.labels.map((l, i) => ({ a: l.a, top: rowsTop + i * rows.rowH, box: { x: boxLeft, y: rowsTop + i * rows.rowH + (rows.rowH - rows.size) / 2, size: rows.size } }));
  /** The paper with its top left at (px, py), with or without its stamp and its tick. */
  const draw = (x: CanvasRenderingContext2D, px: number, py: number, o: { stamped?: boolean; ticked?: boolean } = {}) => {
    const L = px + inset, R = px + pw - inset, mid = px + pw / 2, bottom = py + ph;
    paper(x, px, py, pw, ph, -0.006);
    // the note's number keeps clear of the cover
    const pin = { x: px + pinDX, y: py + pinDY };
    const clear = img ? pin.x - ps / 2 - (story ? 34 : 24) : R;
    let y = py + headDY;
    x.fillStyle = PAPER_INK; x.font = `400 ${story ? 25 : 19}px ${CAPS}`; spaced(x, `PERUZZI ASKED · NOTE ${d.noteNo}`, L, y, 4, 'left');
    x.strokeStyle = RULE; x.lineWidth = 2; x.beginPath(); x.moveTo(L, y + (story ? 22 : 16)); x.lineTo(clear, y + (story ? 22 : 16)); x.stroke();
    // who it's to, as the headline
    y = py + nameDY;
    x.fillStyle = PAPER_INK; const h = wrap(x, head, (p) => `400 ${p}px ${DISPLAY}`, story ? 104 : 66, 44, TW, 1);
    x.textAlign = 'center'; x.font = `400 ${h.px}px ${DISPLAY}`; x.fillText(h.lines[0], mid, y);
    // the line
    y = py + lineTop;
    li.lines.forEach((line) => {
      const total = line.reduce((t, r, i) => t + r.w + (i ? li.px * 0.26 : 0), 0); let at = mid - total / 2;
      y += li.px * 0.95;
      line.forEach((r) => { x.font = r.font; x.fillStyle = r.ink; x.textAlign = 'left'; x.fillText(r.t, at, y); at += r.w + li.px * 0.26; });
      y += li.px * 0.23;
    });
    // Peruzzi's line, in its box: drawn on the paper in the gray of the rule under the number, the label in the stamp's
    // red, the words in the paper's ink
    y = py + boxTop;
    const bx = L - bleed, bw = TW + bleed * 2;
    x.strokeStyle = RULE; x.lineWidth = 2; x.strokeRect(bx, y, bw, boxH);
    x.fillStyle = STAMP; x.font = `400 ${story ? 24 : 16}px ${CAPS}`; spaced(x, `${(d.nameplate || 'Peruzzi').toUpperCase()} SAYS`, bx + pad, y + pad + labelH * 0.75, story ? 5 : 3, 'left');
    x.fillStyle = PAPER_INK; x.font = `400 ${se.px}px ${DISPLAY}`; block(x, se.lines, bx + pad, y + pad + labelH + (story ? 18 : 12) + se.px * 0.9, se.px * 1.25);
    if (o.stamped && d.kind) stamp(x, d.kind, d.stamp, px + mark.cx, py + mark.cy, mark.maxW, mark.big, mark.angle);
    // the question, and the three boxes under it
    x.fillStyle = PAPER_INK; x.textAlign = 'center'; x.font = `400 ${qPx}px ${DISPLAY}`; x.fillText('Could this be love?', mid, py + qY);
    rowAt.forEach((r, i) => {
      const l = rows.labels[i];
      x.strokeStyle = 'rgba(29,26,22,0.7)'; x.lineWidth = story ? 3 : 2; x.strokeRect(px + r.box.x, py + r.box.y, r.box.size, r.box.size);
      x.fillStyle = PAPER_INK; x.font = `400 ${l.px}px ${DISPLAY}`; x.textAlign = 'left';
      x.fillText(l.text, px + r.box.x + r.box.size + rows.gap, py + r.box.y + r.box.size * 0.5 + l.px * 0.34);
      if (o.ticked && d.answer === r.a) tick(x, px + r.box.x, py + r.box.y, r.box.size);
    });
    // who asked it, at the foot
    x.fillStyle = PAPER_INK; x.font = `400 ${story ? 20 : 15}px ${CAPS}`; (x as any).letterSpacing = `${story ? 5 : 4}px`; x.textAlign = 'right'; x.fillText(SIGNED(d.nameplate), R, bottom - foot); (x as any).letterSpacing = '0px';
    if (img) print(x, img, pin.x, pin.y, ps, 0.06);
  };
  return { pw, ph, mark, rows: rowAt, draw };
}

/** A note as a card: as asked, or with its tick once it's answered. */
export async function noteCard(d: NoteCardData, size: CardSize): Promise<HTMLCanvasElement> {
  const [, img] = await Promise.all([loadCardFonts(), cover()]);
  const W = 1080, H = size === 'story' ? 1920 : 1080; const story = size === 'story';
  const [c, x] = canvas(W, H); concrete(x, W, H); x.textBaseline = 'alphabetic';
  const n = notePaper(d, story, img);
  // the card, centred top to bottom: the wordmark, the paper, and the way in under it
  const over = story ? 150 : 92, under = story ? 158 : 56;
  const T = Math.max(story ? 64 : 30, Math.round((H - over - n.ph - under) / 2));
  wordmark(x, W / 2, T + (story ? 62 : 40), story ? 52 : 34);
  const py = T + over, bottom = py + n.ph;
  n.draw(x, (W - n.pw) / 2, py, { stamped: true, ticked: true });
  invite(x, d.site, W / 2, bottom + (story ? 92 : under - 6), story ? 36 : 28);
  if (story) { x.fillStyle = 'rgba(236,229,216,0.55)'; x.font = `400 21px ${CAPS}`; spaced(x, `${(d.song || 'Inferno').toUpperCase()} · ${(d.artist || 'Peruzzi').toUpperCase()}`, W / 2, bottom + under, 6); }
  return c;
}

/** The fonts and the cover the note is drawn with, fetched ahead so the note's page can draw it at once. */
export function preloadNote() { void loadCardFonts(); void cover(); }

/** The note as its page shows it: the story card's own paper, `width` page pixels wide, drawn into `sheet` for the
 *  screen's pixel density without its stamp or its tick (the page lands its own: the stamp drawn into `mark`). The
 *  sheet reaches `bleed` page pixels past the paper's sides, above it for the cover pinned to its corner, and below it
 *  for its shadow. Returns, in page pixels, where the paper, the stamp and each of the three boxes sit. */
export async function drawNote(sheet: HTMLCanvasElement, markInto: HTMLCanvasElement, d: NoteData, width: number, bleed: number) {
  const [, img] = await Promise.all([loadCardFonts(), cover()]);
  const n = notePaper(d, true, img);
  const k = width / n.pw, dpr = Math.min(3, window.devicePixelRatio || 1), side = bleed / k, top = 64, below = 90;
  sheet.width = Math.round((n.pw + side * 2) * k * dpr); sheet.height = Math.round((top + n.ph + below) * k * dpr);
  const x = sheet.getContext('2d')!; x.setTransform(k * dpr, 0, 0, k * dpr, 0, 0); x.textBaseline = 'alphabetic';
  n.draw(x, side, top, { stamped: false, ticked: false });
  if (d.kind) stampMark(d.kind, d.stamp, n.mark.maxW, n.mark.big, k * dpr, markInto);
  return {
    top: top * k, height: n.ph * k, sheet: { left: -bleed, width: sheet.width / dpr, height: sheet.height / dpr },
    stamp: { x: n.mark.cx * k, y: (top + n.mark.cy) * k, width: markInto.width / dpr, height: markInto.height / dpr, angle: (n.mark.angle * 180) / Math.PI },
    rows: n.rows.map((r) => ({ a: r.a, top: (top + r.top) * k, height: (n.rows[1]?.top - n.rows[0]?.top || 92) * k, box: { x: r.box.x * k, y: (top + r.box.y) * k, size: r.box.size * k } })),
  };
}
export type NoteLayout = Awaited<ReturnType<typeof drawNote>>;

/** The tracklist: every note on this phone as a track on an album's back cover, numbered, each with who it was for
 *  and its answer once ticked. */
export async function tracklistCard(d: TracklistCardData, size: CardSize): Promise<HTMLCanvasElement> {
  const [, img] = await Promise.all([loadCardFonts(), cover()]);
  const W = 1080, H = size === 'story' ? 1920 : 1080; const story = size === 'story';
  const [c, x] = canvas(W, H); concrete(x, W, H); x.textBaseline = 'alphabetic';
  wordmark(x, W / 2, story ? 140 : 70, story ? 52 : 34);
  x.fillStyle = 'rgba(236,229,216,0.8)'; x.font = `400 ${story ? 26 : 20}px ${CAPS}`; spaced(x, 'THE TRACKLIST', W / 2, story ? 226 : 128, 8);
  x.fillStyle = BONE; const t = wrap(x, d.name, (p) => `400 ${p}px ${DISPLAY}`, story ? 96 : 64, 44, W - 180, 1); x.textAlign = 'center'; x.fillText(t.lines[0], W / 2, story ? 340 : 206);
  x.fillStyle = 'rgba(236,229,216,0.6)'; x.font = `400 ${story ? 24 : 18}px ${CAPS}`; spaced(x, d.meta.toUpperCase(), W / 2, story ? 398 : 246, 4);
  const notes = d.notes.slice(0, story ? 10 : 5);
  const px = story ? 70 : 60, pw = W - px * 2, rowH = story ? 104 : 86, padT = story ? 54 : 40, sig = story ? 76 : 52;
  const ph = padT + rowH * Math.max(1, notes.length) + sig;
  const top0 = story ? 470 : 290, area = story ? 1180 : 690;
  const py = top0 + Math.max(0, (area - ph) / 2);
  paper(x, px, py, pw, ph, 0.004);
  const L = px + 52, R = px + pw - 52;
  notes.forEach((k, i) => {
    const y = py + padT + i * rowH;
    if (i > 0) { x.strokeStyle = RULE; x.lineWidth = 2; x.beginPath(); x.moveTo(L, y); x.lineTo(R, y); x.stroke(); }
    const base = y + rowH * 0.6;
    x.fillStyle = ASH; x.font = `400 ${story ? 30 : 24}px ${CAPS}`; x.textAlign = 'left'; x.fillText(String(i + 1).padStart(2, '0'), L, base);
    const answered = k.answer ? (k.answer === 'escape' ? `“${k.escape.replace(/[.]$/, '')}”` : k.answer === 'yes' ? 'Yes' : 'No') : '';
    // the answer at the right, in red with its tick; the title and who it was for in what's left
    x.font = `italic 400 ${story ? 28 : 22}px ${SERIF}`;
    const ans = answered ? wrap(x, answered, (p) => `italic 400 ${p}px ${SERIF}`, story ? 28 : 22, 16, (R - L) * 0.32, 1) : null;
    const ansW = ans ? (x.font = `italic 400 ${ans.px}px ${SERIF}`, x.measureText(ans.lines[0]).width) : 0;
    if (ans) {
      const s = story ? 30 : 24;
      x.fillStyle = STAMP; x.textAlign = 'right'; x.fillText(ans.lines[0], R, base);
      x.strokeStyle = 'rgba(161,29,42,0.8)'; x.lineWidth = 2; x.strokeRect(R - ansW - s - 12, base - s * 0.86, s, s); tick(x, R - ansW - s - 12, base - s * 0.86, s);
    }
    const nameW = R - L - (story ? 70 : 56) - (ans ? ansW + (story ? 60 : 50) : 0);
    x.fillStyle = PAPER_INK; const tt = wrap(x, k.title, (p) => `400 ${p}px ${DISPLAY}`, story ? 42 : 32, 22, nameW, 1);
    x.font = `400 ${tt.px}px ${DISPLAY}`; x.textAlign = 'left'; x.fillText(tt.lines[0], L + (story ? 70 : 56), base - (story ? 8 : 6));
    x.fillStyle = 'rgba(29,26,22,0.6)'; x.font = `italic 400 ${story ? 25 : 19}px ${SERIF}`; x.fillText(`for ${k.dear}`, L + (story ? 70 : 56), base + (story ? 30 : 22));
  });
  x.strokeStyle = RULE; x.lineWidth = 2; x.beginPath(); x.moveTo(L, py + ph - sig); x.lineTo(R, py + ph - sig); x.stroke();
  x.fillStyle = ASH; x.font = `400 ${story ? 21 : 16}px ${CAPS}`; (x as any).letterSpacing = `${story ? 5 : 4}px`; x.textAlign = 'right';
  x.fillText(SIGNED(d.nameplate), R, py + ph - (story ? 28 : 18)); (x as any).letterSpacing = '0px';
  // the cover pinned above the first track, clear of its answer
  if (img && story) print(x, img, px + pw - 74, py - 34, 140, 0.07);
  if (story) {
    invite(x, d.site, W / 2, 1790, 36);
    x.fillStyle = 'rgba(236,229,216,0.55)'; x.font = `400 21px ${CAPS}`; spaced(x, `${(d.song || 'Inferno').toUpperCase()} · ${(d.artist || 'Peruzzi').toUpperCase()}`, W / 2, 1858, 6);
  } else invite(x, d.site, W / 2, H - 34, 28);
  return c;
}

export function toBlob(c: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality));
}
