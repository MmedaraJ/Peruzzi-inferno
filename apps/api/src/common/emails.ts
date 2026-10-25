import { esc } from './util';

/** The three emails the site sends. The admin edits the words (Admin → Emails); the frame around them is fixed here.
 *  {placeholders} are filled in when an email goes out; a blank line starts a new paragraph. */
export type EmailKind = 'code' | 'ask' | 'tracklist';
export interface EmailTemplate { subject: string; body: string; cta: string; cta2?: string; cta3?: string; footer: string }

export const EMAIL_DEFAULTS: Record<EmailKind, EmailTemplate> = {
  code: {
    subject: 'Your code: {code}',
    body: 'Here is your code for Peruzzi Asks:\n\n{code}\n\nIt works for 15 minutes. If you didn’t ask for it, ignore this email and nothing will happen.',
    cta: '',
    footer: 'Sent because someone typed this address into {site}.',
  },
  ask: {
    subject: '{sender} asked Peruzzi to ask you something',
    body: 'Dear {recipient},\n\n{sender} wrote you a note, and Peruzzi is asking it for them.\n\nOpen it on the stage, and write {sender} one back if you like.',
    cta: 'Open the note',
    cta2: 'Write {sender} a note back',
    cta3: 'Listen to {song} by {artist}',
    footer: '{sender} ({senderMask}) asked us to deliver this note and confirmed their address first. We haven’t kept yours.',
  },
  tracklist: {
    subject: 'Your tracklist from Peruzzi Asks',
    body: '{name},\n\nHere’s your tracklist so far: every note Peruzzi has asked for you. Write another and it goes on too.',
    cta: 'See your tracklist',
    cta2: 'Write another note',
    cta3: 'Listen to {song} by {artist}',
    footer: 'You asked for this on {site}.',
  },
};

/** A note in an email: who it's to, what they did, Peruzzi's question, and his answer. */
export interface NoteBox { noteNo?: string; title: string; dear: string; line: string; verdict?: string | null }
export interface EmailParts { vars: Record<string, string>; boxes?: NoteBox[]; links: { cta?: string; cta2?: string; cta3?: string }; unsubscribe?: { url: string; label: string } }

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
/** the site's matte colours: the dark of the stage, its rose (#C86272) and blush (#FFCCD6), the notes' light paper */
const INK = '#2b1b21', PAGE = '#fbf6f7', PAPER = '#f5e6e9', EDGE = '#e8d2d8', ASH = '#866b75', ROSE = '#c86272', BLUSH = '#ffccd6', NIGHT = '#1d1418';
/** The frame: the letterhead, the words, the notes on their paper, the buttons, the footer, in flat colour. */
export function renderEmail(t: EmailTemplate, p: EmailParts) {
  const v = p.vars;
  const subject = fill(t.subject, v);
  const paras = fill(t.body, v).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const song = v.song && v.artist ? `${v.song} by ${v.artist}` : '';
  const box = (b: NoteBox) => `
    <tr><td style="padding:0 0 14px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${EDGE};background:${PAPER};border-radius:6px">
        <tr><td style="padding:16px 18px 6px;font:600 11px/1.4 Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:${ASH}">${b.noteNo ? `Note ${esc(b.noteNo)} · ` : ''}${esc(b.title)}</td></tr>
        <tr><td style="padding:2px 18px 6px;font:24px/1.3 Georgia,serif;color:${INK}">Dear ${esc(b.dear)},</td></tr>
        <tr><td style="padding:0 18px 14px;font:18px/1.5 Georgia,serif;color:${INK}">${esc(b.line)}</td></tr>
        <tr><td style="padding:0 18px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:12px 16px;border-radius:6px;background:${ROSE};color:#ffffff"><span style="font:700 11px/1.4 Georgia,serif;letter-spacing:.16em;text-transform:uppercase;color:${BLUSH}">Peruzzi asks</span><br><span style="font:24px/1.3 Georgia,serif">Could this be love?</span></td></tr></table></td></tr>
        ${b.verdict ? `<tr><td style="padding:0 18px 14px;text-align:center"><span style="font:700 11px/1.4 Georgia,serif;letter-spacing:.16em;text-transform:uppercase;color:${ROSE}">Peruzzi answers</span><br><span style="font:26px/1.3 Georgia,serif;color:${INK}">${esc(b.verdict)}.</span></td></tr>` : ''}
        ${song ? `<tr><td style="padding:0 18px 14px;text-align:right;font:600 10px/1.4 Georgia,serif;letter-spacing:.16em;text-transform:uppercase;color:${ASH}">${esc(song)}</td></tr>` : ''}
      </table>
    </td></tr>`;
  const btn = (label: string, url: string, solid: boolean) => `<tr><td style="padding:0 0 10px"><a href="${esc(url)}" style="display:block;text-align:center;text-decoration:none;font:600 16px/1 Georgia,serif;padding:15px 18px;border-radius:6px;${solid ? `background:${ROSE};color:#ffffff;` : `border:1px solid ${INK};color:${INK};`}">${esc(label)}</a></td></tr>`;
  const buttons = [
    t.cta && p.links.cta ? btn(fill(t.cta, v), p.links.cta, true) : '',
    t.cta2 && p.links.cta2 ? btn(fill(t.cta2, v), p.links.cta2, false) : '',
    t.cta3 && p.links.cta3 ? btn(fill(t.cta3, v), p.links.cta3, false) : '',
  ].join('');
  const isCode = !!v.code && paras.some((x) => x === v.code);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:${PAGE};padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
  <tr><td style="padding:0 0 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:16px 0 14px;text-align:center;background:${NIGHT};border-radius:6px;font:600 13px/1.4 Georgia,serif;letter-spacing:.3em;text-transform:uppercase;color:${BLUSH}">Peruzzi Asks<div style="height:3px;width:84px;margin:10px auto 0;background:${ROSE}"></div></td></tr></table></td></tr>
  ${paras.map((x) => isCode && x === v.code
    ? `<tr><td style="padding:4px 0 18px;text-align:center;font:700 36px/1 'Courier New',monospace;letter-spacing:.3em;color:${INK}">${esc(x)}</td></tr>`
    : `<tr><td style="padding:0 0 14px;font:17px/1.55 Georgia,serif;color:${INK}">${esc(x).replace(/\n/g, '<br>')}</td></tr>`).join('')}
  ${(p.boxes || []).map(box).join('')}
  ${buttons ? `<tr><td style="padding:8px 0 6px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${buttons}</table></td></tr>` : ''}
  <tr><td style="padding:22px 0 0;border-top:1px solid ${EDGE};font:13px/1.5 Georgia,serif;color:${ASH}">${esc(fill(t.footer, v))}${p.unsubscribe ? `<br><a href="${esc(p.unsubscribe.url)}" style="color:${ASH}">${esc(p.unsubscribe.label)}</a>` : ''}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    'PERUZZI ASKS', '',
    ...paras.flatMap((x) => [x, '']),
    ...(p.boxes || []).flatMap((b) => [
      `${b.noteNo ? `Note ${b.noteNo} · ` : ''}${b.title}`, `Dear ${b.dear},`, b.line, 'Peruzzi asks: Could this be love?', ...(b.verdict ? [`Peruzzi answers: ${b.verdict}.`] : []), ...(song ? [song] : []), '',
    ]),
    ...(t.cta && p.links.cta ? [`${fill(t.cta, v)}: ${p.links.cta}`] : []),
    ...(t.cta2 && p.links.cta2 ? [`${fill(t.cta2, v)}: ${p.links.cta2}`] : []),
    ...(t.cta3 && p.links.cta3 ? [`${fill(t.cta3, v)}: ${p.links.cta3}`] : []),
    '', '--', fill(t.footer, v), ...(p.unsubscribe ? [`${p.unsubscribe.label}: ${p.unsubscribe.url}`] : []),
  ].join('\n');
  return { subject, html, text };
}
