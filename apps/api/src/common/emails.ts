import { esc } from './util';

/** The four emails the site sends. The admin edits the words (Admin → Emails); the frame around them is fixed here.
 *  {placeholders} are filled in when an email goes out; a blank line starts a new paragraph. */
export type EmailKind = 'code' | 'ask' | 'answered' | 'tracklist';
export interface EmailTemplate { subject: string; body: string; cta: string; cta2?: string; cta3?: string; footer: string }

export const EMAIL_DEFAULTS: Record<EmailKind, EmailTemplate> = {
  code: {
    subject: 'Your code: {code}',
    body: 'Here is your code for Peruzzi Asked:\n\n{code}\n\nIt works for 15 minutes. If you didn’t ask for it, ignore this email and nothing will happen.',
    cta: '',
    footer: 'Sent because someone typed this address into {site}.',
  },
  ask: {
    subject: '{sender} asked Peruzzi to ask you something',
    body: 'Dear {recipient},\n\n{sender} wrote you a note, and Peruzzi is asking it for them.\n\nOpen it and tick your answer. One tick only, so take your time.',
    cta: 'Open the note and answer',
    cta2: 'Write {sender} a note back',
    cta3: 'Listen to {song} by {artist}',
    footer: '{sender} ({senderMask}) asked us to deliver this note and confirmed their address first. We haven’t kept yours.',
  },
  answered: {
    subject: '{recipient} answered your note',
    body: '{sender},\n\n{recipient} opened your note and ticked an answer.',
    cta: 'See the note',
    cta2: 'Write another note',
    cta3: 'Listen to {song} by {artist}',
    footer: 'You’re getting this because you sent a note from {site} and it was answered.',
  },
  tracklist: {
    subject: 'Your tracklist from Peruzzi Asked',
    body: '{name},\n\nHere’s your tracklist so far: every note Peruzzi has asked for you. Write another and it goes on too.',
    cta: 'See your tracklist',
    cta2: 'Write another note',
    cta3: 'Listen to {song} by {artist}',
    footer: 'You asked for this on {site}.',
  },
};

/** A note in an email: who it's to, its line, Peruzzi's line and the three boxes, one ticked once it's answered. */
export interface NoteBox { noteNo?: string; title: string; dear: string; line: string; peruzzi: string; escape: string; answer?: 'yes' | 'no' | 'escape' | null }
export interface EmailParts { vars: Record<string, string>; boxes?: NoteBox[]; links: { cta?: string; cta2?: string; cta3?: string }; unsubscribe?: { url: string; label: string } }

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const INK = '#141210', PAPER = '#efe8dc', ASH = '#6f685e', STAMP = '#8e1b26';
/** the three boxes, as the note has them */
export const choices = (b: NoteBox) => [['yes', 'Yes'], ['no', 'No'], ['escape', b.escape]] as const;

/** The frame: the letterhead, the words, the notes, the buttons, the footer. Monochrome, the red of the stamp aside. */
export function renderEmail(t: EmailTemplate, p: EmailParts) {
  const v = p.vars;
  const subject = fill(t.subject, v);
  const paras = fill(t.body, v).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const box = (b: NoteBox) => `
    <tr><td style="padding:0 0 14px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #cfc6b6;background:#f7f2e9">
        <tr><td style="padding:16px 18px 6px;font:600 11px/1.4 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:${ASH}">${b.noteNo ? `Note ${esc(b.noteNo)} · ` : ''}${esc(b.title)}</td></tr>
        <tr><td style="padding:2px 18px 6px;font:24px/1.3 Georgia,serif;color:${INK}">Dear ${esc(b.dear)},</td></tr>
        <tr><td style="padding:0 18px 12px;font:italic 17px/1.5 Georgia,serif;color:${INK}">${esc(b.line)}</td></tr>
        <tr><td style="padding:0 18px 12px;font:16px/1.5 Georgia,serif;color:${INK}"><b style="color:${STAMP};letter-spacing:.12em;text-transform:uppercase;font-size:11px">Peruzzi says</b><br>${esc(b.peruzzi)}</td></tr>
        <tr><td style="padding:0 18px 6px;font:20px/1.3 Georgia,serif;color:${INK}">Could this be love?</td></tr>
        <tr><td style="padding:0 18px 16px;font:16px/1.7 Georgia,serif;color:${INK}">${choices(b).map(([k, label]) => `<span style="color:${b.answer === k ? STAMP : INK}">${b.answer === k ? '&#9745;' : '&#9744;'} ${esc(label)}</span>`).join('<br>')}</td></tr>
      </table>
    </td></tr>`;
  const btn = (label: string, url: string, solid: boolean) => `<tr><td style="padding:0 0 10px"><a href="${esc(url)}" style="display:block;text-align:center;text-decoration:none;font:600 16px/1 Georgia,serif;padding:15px 18px;${solid ? `background:${INK};color:${PAPER};` : `border:1px solid ${INK};color:${INK};`}">${esc(label)}</a></td></tr>`;
  const buttons = [
    t.cta && p.links.cta ? btn(fill(t.cta, v), p.links.cta, true) : '',
    t.cta2 && p.links.cta2 ? btn(fill(t.cta2, v), p.links.cta2, false) : '',
    t.cta3 && p.links.cta3 ? btn(fill(t.cta3, v), p.links.cta3, false) : '',
  ].join('');
  const isCode = !!v.code && paras.some((x) => x === v.code);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:${PAPER};padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
  <tr><td style="padding:8px 0 22px;text-align:center;font:600 12px/1.4 Georgia,serif;letter-spacing:.3em;text-transform:uppercase;color:${INK}">Peruzzi Asked</td></tr>
  ${paras.map((x) => isCode && x === v.code
    ? `<tr><td style="padding:4px 0 18px;text-align:center;font:700 36px/1 'Courier New',monospace;letter-spacing:.3em;color:${INK}">${esc(x)}</td></tr>`
    : `<tr><td style="padding:0 0 14px;font:17px/1.55 Georgia,serif;color:${INK}">${esc(x).replace(/\n/g, '<br>')}</td></tr>`).join('')}
  ${(p.boxes || []).map(box).join('')}
  ${buttons ? `<tr><td style="padding:8px 0 6px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${buttons}</table></td></tr>` : ''}
  <tr><td style="padding:22px 0 0;border-top:1px solid #cfc6b6;font:13px/1.5 Georgia,serif;color:${ASH}">${esc(fill(t.footer, v))}${p.unsubscribe ? `<br><a href="${esc(p.unsubscribe.url)}" style="color:${ASH}">${esc(p.unsubscribe.label)}</a>` : ''}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    'PERUZZI ASKED', '',
    ...paras.flatMap((x) => [x, '']),
    ...(p.boxes || []).flatMap((b) => [
      `${b.noteNo ? `Note ${b.noteNo} · ` : ''}${b.title}`, `Dear ${b.dear},`, b.line, `Peruzzi says: ${b.peruzzi}`, 'Could this be love?',
      ...choices(b).map(([k, label]) => `[${b.answer === k ? 'x' : ' '}] ${label}`), '',
    ]),
    ...(t.cta && p.links.cta ? [`${fill(t.cta, v)}: ${p.links.cta}`] : []),
    ...(t.cta2 && p.links.cta2 ? [`${fill(t.cta2, v)}: ${p.links.cta2}`] : []),
    ...(t.cta3 && p.links.cta3 ? [`${fill(t.cta3, v)}: ${p.links.cta3}`] : []),
    '', '--', fill(t.footer, v), ...(p.unsubscribe ? [`${p.unsubscribe.label}: ${p.unsubscribe.url}`] : []),
  ].join('\n');
  return { subject, html, text };
}
