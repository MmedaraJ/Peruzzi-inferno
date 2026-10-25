import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;
/** The one Claude client, for Peruzzi's readings. */
export const anthropic = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
export const aiAvailable = () => !!process.env.ANTHROPIC_API_KEY;

/** Words Peruzzi's lines never carry, whatever the model writes. */
const LINE_BLOCK = /(https?:\/\/|www\.|@\w{2,}|\+?\d[\d\s-]{7,}\d)/i;
export function tidy(s: any, max: number) {
  let t = String(s ?? '').replace(/\s+/g, ' ').replace(/[*_#`]/g, '').trim();
  if (t.length > max) { const cut = t.slice(0, max); const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! ')); t = end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`; }
  return t;
}
export function unsafeLine(s: string) { return LINE_BLOCK.test(s); }
