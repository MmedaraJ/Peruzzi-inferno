/** The pictures people post: one note, or a tracklist. Drawn on a canvas, flat and matte: the dark of the stage, the
 *  note on light blush paper, Peruzzi's question in a box of rose, as a story (1080×1920) or a square (1080×1080). */
export type CardSize = 'story' | 'square';
/** What a note says: who it's to, and what they did (as Peruzzi told it). */
export interface NoteData { noteNo: string; title: string; dear: string; line: string; nameplate?: string; song?: string; artist?: string }
export interface NoteCardData extends NoteData { site: string }
export interface TracklistCardData { name: string; meta: string; notes: { noteNo: string; title: string; dear: string }[]; site: string; song?: string; artist?: string; nameplate?: string }

/** the matte dark the cards stand on, the paper, its ink, and the three roses */
const BASE = '#1d1418', PAPER = '#f5e6e9', PAPER_INK = '#2b1b21', MUTED = '#8c717a', BONE = '#f7ecee';
export const ROSE = '#c86272', BLUSH = '#ffccd6', PETAL = '#fdb1bf';
/** the paper's rules: under the note's number, and between the tracks */
const RULE = 'rgba(43,27,33,0.14)';
const SERIF = '"EB Garamond Variable", "EB Garamond", Georgia, serif';
/** the display face, with EB Garamond standing in for any letter it lacks (Yoruba's marks) */
const DISPLAY = 'Marcellus, "EB Garamond Variable", "EB Garamond", Georgia, serif';
const CAPS = '"Marcellus SC", Marcellus, Georgia, serif';
/** The song, as the note's corner credits it: "INFERNO BY PERUZZI". */
export const songCredit = (song?: string, artist?: string) => `${song || 'Inferno'} by ${artist || 'Peruzzi'}`.toUpperCase();

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
/** The card's ground: the stage's matte dark, flat, a fine grain to it. */
function ground(x: CanvasRenderingContext2D, w: number, h: number) {
  x.fillStyle = BASE; x.fillRect(0, 0, w, h);
  texture(x, w, h, 0.05);
}
function rounded(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, r: number) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
/** The note's paper: light matte blush, a little round at its corners, a fine grain to it. */
function paper(x: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, tilt: number, r: number) {
  x.save(); x.translate(px + pw / 2, py + ph / 2); x.rotate(tilt);
  const l = -pw / 2, t = -ph / 2;
  x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 60; x.shadowOffsetY = 26;
  x.fillStyle = PAPER; rounded(x, l, t, pw, ph, r); x.fill(); x.shadowColor = 'transparent';
  x.save(); rounded(x, l, t, pw, ph, r); x.clip(); texture(x, pw, ph, 0.06, 'multiply', l, t); x.restore();
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
  x.shadowColor = 'rgba(20,0,16,0.5)'; x.shadowBlur = size * 0.14; x.shadowOffsetY = size * 0.05;
  x.fillStyle = '#ffffff'; x.fillRect(-size / 2 - b, -size / 2 - b, size + b * 2, size + b * 2); x.shadowColor = 'transparent';
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
/** The words in as many lines as `width` takes, each about as long as the others: the narrowest width that takes no
 *  more lines, so the last never holds a word on its own. */
function even(x: CanvasRenderingContext2D, text: string, width: number) {
  const n = lay(x, text, width).length; if (n < 2) return lay(x, text, width);
  let lo = width * 0.4, hi = width;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (lay(x, text, m).length <= n) hi = m; else lo = m; }
  return lay(x, text, hi);
}
/** Text, one line at a size that fits `width`, no bigger than `size`. */
function fit(x: CanvasRenderingContext2D, text: string, font: (px: number) => string, size: number, min: number, width: number, spacing = 0) {
  for (let px = size; px > min; px -= 1) { x.font = font(px); (x as any).letterSpacing = `${spacing}px`; const w = x.measureText(text).width; (x as any).letterSpacing = '0px'; if (w <= width) return px; }
  return min;
}

/** The line under the paper that brings in the next note: the question every card asks the people who see it. */
export const INVITATION = 'Who’s on your mind?';
/** The way in, under the paper: the invitation and the address on one line, in the same type, the address underlined
 *  as a link would be. */
function invite(x: CanvasRenderingContext2D, site: string, cx: number, y: number, px: number) {
  x.font = `400 ${px}px ${SERIF}`; x.textAlign = 'left'; x.fillStyle = BONE;
  const a = `${INVITATION} `, wa = x.measureText(a).width, ws = x.measureText(site).width, at = cx - (wa + ws) / 2;
  x.fillText(a, at, y); x.fillText(site, at + wa, y);
  x.fillStyle = PETAL; x.fillRect(at + wa, y + px * 0.14, ws, Math.max(2, Math.round(px * 0.06)));
}
/** "PERUZZI ASKS", over the paper, on a short rule of rose. */
function wordmark(x: CanvasRenderingContext2D, cx: number, y: number, px: number) {
  x.fillStyle = BLUSH; x.font = `400 ${px}px ${DISPLAY}`; spaced(x, 'PERUZZI ASKS', cx, y, px * 0.16);
  const w = Math.min(px * 4.2, 300); x.fillStyle = ROSE; x.fillRect(cx - w / 2, y + px * 0.42, w, Math.max(3, px * 0.07));
}

let ruler: CanvasRenderingContext2D | null = null;
/** The note, on its paper, laid out in the story card's units (the paper 928 wide, as tall as what's on it), from its
 *  top: the note's number and title, who it's to as its headline under the cover pinned to its corner, what they did,
 *  Peruzzi's question in a box of rose, and the song in the corner. The card draws it on the stage's dark, and the
 *  note's page draws the same paper, so the two never differ. */
function notePaper(d: NoteData, story: boolean, img: HTMLImageElement | null) {
  const x = (ruler ??= canvas(1, 1)[1]);
  const pw = 1080 - (story ? 76 : 64) * 2, inset = story ? 64 : 50, TW = pw - inset * 2;
  const radius = story ? 26 : 20;
  const ps = story ? 200 : 136, pinDX = pw - (story ? 76 : 52), pinDY = story ? 80 : 44;
  const headDY = story ? 92 : 64;
  const nameDY = Math.max(headDY + (story ? 150 : 100), img ? pinDY + ps / 2 + (story ? 116 : 78) : 0);
  const creditGap = story ? 64 : 40, foot = story ? 40 : 26;
  const room = (story ? 1340 : 820) - nameDY - creditGap - foot;
  // what they did, centred, a line or up to three
  const theLine = (k: number) => {
    const font = (p: number) => `400 ${p}px ${DISPLAY}`;
    for (let p = Math.round((story ? 60 : 38) * k); p >= (story ? 34 : 22); p -= 2) { x.font = font(p); const l = lay(x, d.line, TW); if (l.length <= 3 || p <= (story ? 34 : 22)) return { lines: even(x, d.line, TW), px: p }; }
    return { lines: [d.line], px: story ? 34 : 22 };
  };
  const pad = story ? 36 : 24, labelH = story ? 28 : 18;
  let li = theLine(1), boxH = 0, need = 0, qPx = 0;
  const lineGap = story ? 50 : 30, boxGap = story ? 60 : 34;
  for (let k = 1; k >= 0.6; k -= 0.05) {
    li = theLine(k); qPx = Math.round((story ? 72 : 46) * k);
    boxH = pad + labelH + (story ? 16 : 10) + qPx * 1.1 + pad * 0.85;
    need = lineGap + li.lines.length * li.px * 1.2 + boxGap + boxH;
    if (need <= room) break;
  }
  const ph = nameDY + need + creditGap + foot;
  // where things sit, from the paper's top: the line, and Peruzzi's question
  const lineTop = nameDY + lineGap;
  const boxTop = lineTop + li.lines.length * li.px * 1.2 + boxGap;
  const asks = `${(d.nameplate || 'Peruzzi').toUpperCase()} ASKS`;
  /** The paper with its top left at (px, py). */
  const draw = (x: CanvasRenderingContext2D, px: number, py: number) => {
    const L = px + inset, R = px + pw - inset, mid = px + pw / 2, bottom = py + ph;
    paper(x, px, py, pw, ph, -0.006, radius);
    // the note's number and its title, clear of the cover
    const pin = { x: px + pinDX, y: py + pinDY };
    const clear = img ? pin.x - ps / 2 - (story ? 34 : 24) : R;
    let y = py + headDY;
    const head = `NOTE ${d.noteNo} · ${d.title.toUpperCase()}`, hs = story ? 4 : 3;
    const hp = fit(x, head, (p) => `400 ${p}px ${CAPS}`, story ? 25 : 19, story ? 16 : 12, clear - L, hs);
    x.fillStyle = MUTED; x.font = `400 ${hp}px ${CAPS}`; spaced(x, head, L, y, hs, 'left');
    x.strokeStyle = RULE; x.lineWidth = 2; x.beginPath(); x.moveTo(L, y + (story ? 24 : 17)); x.lineTo(clear, y + (story ? 24 : 17)); x.stroke();
    // who it's to, as the headline
    y = py + nameDY;
    const head2 = `Dear ${d.dear},`;
    const np = fit(x, head2, (p) => `400 ${p}px ${DISPLAY}`, story ? 104 : 66, 40, TW);
    x.fillStyle = PAPER_INK; x.font = `400 ${np}px ${DISPLAY}`; x.textAlign = 'center'; x.fillText(head2, mid, y);
    // what they did
    y = py + lineTop; x.fillStyle = PAPER_INK; x.font = `400 ${li.px}px ${DISPLAY}`; x.textAlign = 'center';
    li.lines.forEach((line, i) => x.fillText(line, mid, y + li.px * 0.95 + i * li.px * 1.2));
    // Peruzzi asks, in a box of rose
    y = py + boxTop;
    x.fillStyle = ROSE; rounded(x, L, y, TW, boxH, story ? 18 : 12); x.fill();
    x.fillStyle = BLUSH; x.font = `400 ${story ? 27 : 18}px ${CAPS}`; spaced(x, asks, mid, y + pad + labelH * 0.8, story ? 6 : 4);
    x.fillStyle = '#ffffff'; x.font = `400 ${qPx}px ${DISPLAY}`; x.textAlign = 'center'; x.fillText('Could this be love?', mid, y + pad + labelH + (story ? 16 : 10) + qPx * 0.86);
    // the song, in the corner
    x.fillStyle = MUTED; x.font = `400 ${story ? 20 : 15}px ${CAPS}`; (x as any).letterSpacing = `${story ? 5 : 4}px`; x.textAlign = 'right';
    x.fillText(songCredit(d.song, d.artist), R, bottom - foot); (x as any).letterSpacing = '0px';
    if (img) print(x, img, pin.x, pin.y, ps, 0.06);
  };
  return { pw, ph, draw };
}

/** A note as a card. */
export async function noteCard(d: NoteCardData, size: CardSize): Promise<HTMLCanvasElement> {
  const [, img] = await Promise.all([loadCardFonts(), cover()]);
  const W = 1080, H = size === 'story' ? 1920 : 1080; const story = size === 'story';
  const [c, x] = canvas(W, H); ground(x, W, H); x.textBaseline = 'alphabetic';
  const n = notePaper(d, story, img);
  // the card, centred top to bottom: the wordmark, the paper, and the way in under it
  const over = story ? 150 : 92, under = story ? 120 : 56;
  const T = Math.max(story ? 64 : 30, Math.round((H - over - n.ph - under) / 2));
  wordmark(x, W / 2, T + (story ? 62 : 40), story ? 52 : 34);
  const py = T + over, bottom = py + n.ph;
  n.draw(x, (W - n.pw) / 2, py);
  invite(x, d.site, W / 2, bottom + (story ? 96 : under - 6), story ? 36 : 28);
  return c;
}

/** The fonts and the cover the note is drawn with, fetched ahead so the note's page can draw it at once. */
export function preloadNote() { void loadCardFonts(); void cover(); }

/** The note as its page shows it: the story card's own paper, `width` page pixels wide, drawn into `sheet` for the
 *  screen's pixel density. The sheet reaches `bleed` page pixels past the paper's sides, above it for the cover pinned
 *  to its corner, and below it for its shadow. Returns, in page pixels, where the paper sits. */
export async function drawNote(sheet: HTMLCanvasElement, d: NoteData, width: number, bleed: number) {
  const [, img] = await Promise.all([loadCardFonts(), cover()]);
  const n = notePaper(d, true, img);
  const k = width / n.pw, dpr = Math.min(3, window.devicePixelRatio || 1), side = bleed / k, top = 64, below = 90;
  sheet.width = Math.round((n.pw + side * 2) * k * dpr); sheet.height = Math.round((top + n.ph + below) * k * dpr);
  const x = sheet.getContext('2d')!; x.setTransform(k * dpr, 0, 0, k * dpr, 0, 0); x.textBaseline = 'alphabetic';
  n.draw(x, side, top);
  return { top: top * k, height: n.ph * k, sheet: { left: -bleed, width: sheet.width / dpr, height: sheet.height / dpr } };
}
export type NoteLayout = Awaited<ReturnType<typeof drawNote>>;

/** The tracklist: every note on this phone as a track on an album's back cover, numbered, each with who it was for. */
export async function tracklistCard(d: TracklistCardData, size: CardSize): Promise<HTMLCanvasElement> {
  const [, img] = await Promise.all([loadCardFonts(), cover()]);
  const W = 1080, H = size === 'story' ? 1920 : 1080; const story = size === 'story';
  const [c, x] = canvas(W, H); ground(x, W, H); x.textBaseline = 'alphabetic';
  wordmark(x, W / 2, story ? 140 : 70, story ? 52 : 34);
  x.fillStyle = PETAL; x.font = `400 ${story ? 26 : 20}px ${CAPS}`; spaced(x, 'THE TRACKLIST', W / 2, story ? 226 : 128, 8);
  x.fillStyle = BONE; const t = wrap(x, d.name, (p) => `400 ${p}px ${DISPLAY}`, story ? 96 : 64, 44, W - 180, 1); x.textAlign = 'center'; x.fillText(t.lines[0], W / 2, story ? 340 : 206);
  x.fillStyle = 'rgba(247,236,238,0.65)'; x.font = `400 ${story ? 24 : 18}px ${CAPS}`; spaced(x, d.meta.toUpperCase(), W / 2, story ? 398 : 246, 4);
  const notes = d.notes.slice(0, story ? 10 : 5);
  const px = story ? 70 : 60, pw = W - px * 2, rowH = story ? 104 : 86, padT = story ? 60 : 44, sig = story ? 76 : 52;
  const ph = padT + rowH * Math.max(1, notes.length) + sig;
  const top0 = story ? 470 : 290, area = story ? 1180 : 690;
  const py = top0 + Math.max(0, (area - ph) / 2);
  paper(x, px, py, pw, ph, 0.004, story ? 26 : 20);
  const L = px + 52, R = px + pw - 52;
  notes.forEach((k, i) => {
    const y = py + padT + i * rowH;
    if (i > 0) { x.strokeStyle = RULE; x.lineWidth = 2; x.beginPath(); x.moveTo(L, y); x.lineTo(R, y); x.stroke(); }
    const base = y + rowH * 0.6;
    x.fillStyle = ROSE; x.font = `400 ${story ? 30 : 24}px ${CAPS}`; x.textAlign = 'left'; x.fillText(String(i + 1).padStart(2, '0'), L, base);
    const nameW = R - L - (story ? 70 : 56);
    x.fillStyle = PAPER_INK; const tt = wrap(x, k.title, (p) => `400 ${p}px ${DISPLAY}`, story ? 42 : 32, 22, nameW, 1);
    x.font = `400 ${tt.px}px ${DISPLAY}`; x.textAlign = 'left'; x.fillText(tt.lines[0], L + (story ? 70 : 56), base - (story ? 8 : 6));
    x.fillStyle = 'rgba(43,27,33,0.6)'; x.font = `italic 400 ${story ? 25 : 19}px ${SERIF}`; x.fillText(`for ${k.dear}`, L + (story ? 70 : 56), base + (story ? 30 : 22));
  });
  x.strokeStyle = RULE; x.lineWidth = 2; x.beginPath(); x.moveTo(L, py + ph - sig); x.lineTo(R, py + ph - sig); x.stroke();
  x.fillStyle = MUTED; x.font = `400 ${story ? 21 : 16}px ${CAPS}`; (x as any).letterSpacing = `${story ? 5 : 4}px`; x.textAlign = 'right';
  x.fillText(songCredit(d.song, d.artist), R, py + ph - (story ? 28 : 18)); (x as any).letterSpacing = '0px';
  // the cover pinned above the first track
  if (img && story) print(x, img, px + pw - 74, py - 34, 140, 0.07);
  invite(x, d.site, W / 2, story ? 1810 : H - 34, story ? 36 : 28);
  return c;
}

export function toBlob(c: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality));
}
