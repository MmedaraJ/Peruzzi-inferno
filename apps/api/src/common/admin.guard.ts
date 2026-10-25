import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { ipOf } from './util';

/** How long a sign-in lasts. */
const SESSION_MS = 12 * 3600_000;
/** What signs the sessions: ADMIN_SESSION_SECRET, or else a key made from ADMIN_PASSWORD, so a new password signs every
 *  session out. Without ADMIN_PASSWORD there's no admin at all. */
function sessionKey(): Buffer | null {
  const pw = process.env.ADMIN_PASSWORD; if (!pw) return null;
  return process.env.ADMIN_SESSION_SECRET ? Buffer.from(process.env.ADMIN_SESSION_SECRET) : createHmac('sha256', pw).update('admin-session').digest();
}
const signature = (key: Buffer, exp: string, nonce: string) => createHmac('sha256', key).update(`admin.${exp}.${nonce}`).digest('base64url');

/** A signed-in admin's session token, `${exp}.${nonce}.${sig}`, good for 12 hours: sent as x-admin-token. */
export function adminSession() {
  const key = sessionKey(); if (!key) throw new UnauthorizedException();
  const exp = String(Date.now() + SESSION_MS); const nonce = randomBytes(16).toString('base64url');
  return { token: `${exp}.${nonce}.${signature(key, exp, nonce)}`, expiresAt: Number(exp) };
}
/** A session this server signed (compared in constant time) that hasn't run out. */
function validSession(token: string) {
  const key = sessionKey(); const parts = token.split('.');
  if (!key || parts.length !== 3 || !/^\d{1,16}$/.test(parts[0]) || Number(parts[0]) <= Date.now() || !parts[1]) return false;
  const given = Buffer.from(parts[2]); const expected = Buffer.from(signature(key, parts[0], parts[1]));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
/** The admin password, in constant time whatever its length. */
export function passwordIs(given: string) {
  const pw = process.env.ADMIN_PASSWORD; if (!pw) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(given), digest(pw));
}

/** Wrong passwords, by the connection they came through (see ipOf): ten in a quarter of an hour, and it gets no more
 *  tries until the quarter has passed. Through the site that's one of Vercel's addresses, so a run of wrong guesses
 *  near the same Vercel server holds the form there too; sessions already signed in keep working. Nothing is counted
 *  across all connections together, so no one can lock everyone out. Signing in and the x-admin-password header count
 *  together. */
const WINDOW = 15 * 60_000;
const misses = new Map<string, number[]>();
const keysOf = (req: Request): [string, number][] => [[`conn ${ipOf(req)}`, 10]];
const recent = (k: string, now: number) => (misses.get(k) || []).filter((t) => now - t < WINDOW);
export function lockedOut(req: Request) { const now = Date.now(); return keysOf(req).some(([k, n]) => recent(k, now).length >= n); }
/** A wrong password: counted, then answered after a moment, so guessing is slow. */
export async function wrongPassword(req: Request) {
  const now = Date.now();
  if (misses.size > 10_000) for (const k of [...misses.keys()]) if (!recent(k, now).length) misses.delete(k);
  for (const [k] of keysOf(req)) misses.set(k, [...recent(k, now), now]);
  await new Promise((r) => setTimeout(r, 800));
}
export const tooManyTries = () => new HttpException({ message: 'Too many wrong passwords. Try again in a few minutes.', reason: 'locked' }, HttpStatus.TOO_MANY_REQUESTS);

/** The admin: a session token from signing in (POST /api/admin/login), sent as x-admin-token, or the password itself as
 *  x-admin-password, for scripts. */
@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (validSession(String(req.headers['x-admin-token'] || ''))) return true;
    if (req.headers['x-admin-password'] === undefined) throw new UnauthorizedException();
    if (lockedOut(req)) throw tooManyTries();
    const given = Buffer.from(String(req.headers['x-admin-password'] || ''));
    const expected = Buffer.from(process.env.ADMIN_PASSWORD || '');
    if (!expected.length || given.length !== expected.length || !timingSafeEqual(given, expected)) { await wrongPassword(req); throw new UnauthorizedException(); }
    return true;
  }
}
