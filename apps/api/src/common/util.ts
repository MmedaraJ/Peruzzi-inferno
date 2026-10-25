import { createHash, createHmac, randomBytes, randomInt } from 'crypto';
import type { Request } from 'express';

/** The address that connected to the server: the first X-Forwarded-For entry (req.ip, with "trust proxy" on).
 *  Railway's edge replaces whatever X-Forwarded-For a caller sends, so it can't be faked; the entry after it is
 *  Railway's own, the same for everyone. Through the site this is Vercel's address, shared by everyone near the same
 *  Vercel server: the API can't tell the people behind it apart. Called directly, it's the caller's own. */
export const ipOf = (req: Request) => (req.ip || '').replace(/^::ffff:/, '') || null;

/** Short public codes for links (/q/:code, /a/:code, /t/:code): no 0/O or 1/l/I, so they survive being read out. */
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';
export function code(len = 8) { let s = ''; for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)]; return s; }
export function token() { return randomBytes(24).toString('base64url'); }
export function sha256(s: string) { return createHash('sha256').update(s).digest('hex'); }
/** What the keyed hashes, the opt-out links and the senders' tokens are made with, the one in use first: HASH_SECRET,
 *  else ADMIN_PASSWORD. Checks take either, so what was made before HASH_SECRET was set still works. A changed
 *  ADMIN_PASSWORD isn't on the list any more, though: set HASH_SECRET to the old one first (README). Only a run with
 *  neither (a local one) falls back to a fixed key: it's in the source for anyone to read, so it never signs or checks
 *  anything once a real secret is set. */
export function signingSecrets() {
  const real = [...new Set([process.env.HASH_SECRET, process.env.ADMIN_PASSWORD].filter((s): s is string => !!s))];
  return real.length ? real : ['peruzzi-asked'];
}
/** What a stored hash may have been made with: the secrets above, and the fixed key of a run without them. For finding
 *  rows the server stored itself (so an opt-out made then still holds), never for checking a signature. */
export function hashSecrets() { return [...new Set([...signingSecrets(), 'peruzzi-asked'])]; }
/** A keyed hash, so a leaked table of hashes can't be matched against a list of addresses. */
export function keyedHash(s: string, key = signingSecrets()[0]) { return createHmac('sha256', key).update(s).digest('hex'); }
/** The keyed hash under each of hashSecrets, to find what was stored under any of them. */
export function keyedHashes(s: string) { return hashSecrets().map((k) => keyedHash(s, k)); }
export function normEmail(e: string) { return e.trim().toLowerCase(); }
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function maskEmail(e: string) { const [u, d] = e.split('@'); return `${u.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(5, u.length - 1)))}@${d}`; }
/** Midnight in Lagos, the site's own clock: "the stage is closed until tomorrow" means tomorrow there. */
export function startOfDay(now = new Date()) {
  const WAT = 60 * 60_000; const day = 24 * 60 * 60_000;
  return new Date(Math.floor((now.getTime() + WAT) / day) * day - WAT);
}
export function noteNo(seq: number) { return String(seq).padStart(4, '0'); }
export function firstName(s?: string | null) { const t = (s || '').trim().split(/\s+/)[0] || ''; return t.slice(0, 24); }
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
