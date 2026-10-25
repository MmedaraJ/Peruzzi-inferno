import { Injectable, Logger } from '@nestjs/common';

/** A sender Resend will deliver from: MAIL_FROM on the site's own domain, verified in Resend. Its testing address only
 *  reaches the account's owner, and the placeholders never send. */
export const senderReady = () => { const f = (process.env.MAIL_FROM || '').trim(); return !!f && !/@(example\.com|your-domain\.com|resend\.dev)\b/i.test(f); };
/** Whether the site can send email: with a Resend key and a sender of its own, or locally with MAIL_DRY_RUN=1 (emails
 *  are logged and kept in the admin's outbox instead). Without either, the site hides everything that sends one. */
export const emailReady = () => (!!process.env.RESEND_API_KEY && senderReady()) || process.env.MAIL_DRY_RUN === '1';
/** The most emails the site sends in an hour, all kinds together (MAIL_PER_HOUR, 300 unless set): codes and tracklists go
 *  to any address typed in, so without it nothing holds the Resend bill or its quota. */
const perHour = () => { const n = Number(process.env.MAIL_PER_HOUR || 300); return Number.isFinite(n) && n >= 0 ? n : 300; };

/** Email through Resend's HTTP API. Without RESEND_API_KEY and a sender of its own it only logs, so everything can be
 *  tried locally. The last few "sent" emails are kept in memory so local tests can read them. */
@Injectable()
export class MailService {
  private log = new Logger('mail');
  readonly outbox: { to: string; subject: string; html: string; text: string; at: number }[] = [];
  private sentAt: number[] = []; private capSaid = 0;
  async send(to: string, subject: string, html: string, text: string, headers?: Record<string, string>) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM || 'Peruzzi Asks <notes@example.com>';
    const replyTo = process.env.MAIL_REPLY_TO || undefined;
    if (!key || !senderReady()) {
      this.log.log(`[dry-run] to=${to} subject="${subject}"`);
      this.outbox.unshift({ to, subject, html, text, at: Date.now() }); this.outbox.length = Math.min(this.outbox.length, 50);
      return { ok: true, dryRun: true };
    }
    const now = Date.now(); this.sentAt = this.sentAt.filter((t) => now - t < 3600_000);
    if (this.sentAt.length >= perHour()) {
      if (now - this.capSaid > 10 * 60_000) { this.capSaid = now; this.log.warn(`the hour's ${perHour()} emails are sent: holding the rest (MAIL_PER_HOUR)`); }
      return { ok: false };
    }
    this.sentAt.push(now);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}), ...(headers ? { headers } : {}) }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) this.log.warn(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { ok: res.ok };
    } catch (e) { this.log.warn(`resend failed: ${e}`); return { ok: false }; }
  }
}
