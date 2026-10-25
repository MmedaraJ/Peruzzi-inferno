/** What happens to a note before Peruzzi reads it: contact details and handles come out, and two quiet checks note
 *  words that can signal real danger and attempts to talk him out of his rules. */

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|ng|net|org|co|io|me|ly|app|link)(?:\/\S*)?\b/gi;
const HANDLE = /(^|[\s(])@[\w.]{2,}/g;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export interface Cleaned { text: string; redacted: boolean; danger: boolean; injection: boolean }

export function clean(input: string, max: number): Cleaned {
  let t = String(input ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const before = t;
  t = t.replace(EMAIL, '[email removed]').replace(URL_RE, '[link removed]').replace(HANDLE, '$1[handle removed]').replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 8 ? '[number removed]' : m));
  return { text: t, redacted: t !== before, danger: dangerWords(t), injection: INJECTION.test(t) };
}

/** Strong signals only; the AI makes the call. Plenty of everyday slang looks
 *  violent ("he hit me up", "she killed it"), so this never decides anything on its own while the AI is up. */
const DANGER = [
  /\bsuicid/i, /\bkill(ing)? my ?self\b/i, /\bend (my|it all|my life)\b/i, /\bself[- ]?harm/i, /\bcut(ting)? my ?self\b/i, /\bwant(s)? to die\b/i,
  /\brap(e|ed|ing)\b/i, /\bsexual(ly)? (assault|abus)/i, /\bmolest/i, /\bforced me\b/i,
  /\b(hits|hit|beats|beat|slaps|slapped|punches|punched|chokes|choked|kicks|kicked) me\b(?! up)/i, /\bthreaten(ed|s|ing)? (to )?(kill|hurt|beat)/i,
  /\babus(e|ed|es|ing|ive)\b/i, /\bstalk/i, /\bscared (to go home|of him|of her|for my life)/i, /\bin danger\b/i,
];
export function dangerWords(t: string) { return DANGER.some((r) => r.test(t)); }

const INJECTION = /\b(ignore (all |the |your )?(previous|prior|above) (instructions|rules)|system prompt|you are now|developer mode|jailbreak|pretend (you are|to be)|act as|disregard (your|the) rules)\b/i;
