import type { Reading } from './peruzzi';
import { asLine } from './peruzzi';

/** Readings written to fit any note, for when the AI is slow or down: the show goes on, and the admin sees which notes
 *  had one. The note keeps its writer's line as written; Peruzzi's line, the title and the third box are picked
 *  separately, so two in a row rarely read the same. */
const pick = <T>(a: T[], seed: number) => a[Math.abs(seed) % a.length];

const SAYINGS = [
  '{dear}, nobody does that for just anybody.',
  '{dear}, I’ve read a lot of notes tonight. This one is love.',
  '{dear}, the whole room can see it. Can you?',
  '{dear}, the band stopped playing to hear your answer.',
  '{dear}, that’s not small. That’s love in work clothes.',
];
const THING_SAYINGS = [
  '{dear}, you’ve never once let them down.',
  '{dear}, that’s the most loyal love in Lagos.',
];
const ESCAPES = ['I do that for everybody.', 'It was an accident.', 'I was just being nice.', 'Ask me again in January.', 'I didn’t even notice.'];
const THING_ESCAPES = ['I’m just doing my job.', 'I didn’t ask for this.'];
const TITLES = ['Little Things', 'Exhibit A', 'No Accident', 'Front Row', 'Encore'];
/** what can't read a note: someone writing to it posts it instead of sending it */
const THINGS = /\b(bed|pillow|jollof|amala|suya|rice|food|bread|indomie|phone|charger|generator|wi-?fi|data|nepa|light|car|lagos|abuja|arsenal|chelsea|barca|madrid|dog|cat|bag|money|salary|weekend|sleep|music)\b/i;

/** "my crush" → "Crush", "Tolu" → "Tolu": who a note is to, as it'd say it after "Dear" */
export function dearOf(who: string) {
  const t = who.trim().replace(/^dear\s+/i, '').replace(/^my\s+/i, '').replace(/[,.!:;]+$/, '').split(/\s+/).slice(0, 3).join(' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'You';
}

export function fallbackReading(who: string, what: string, seed: number): Reading {
  const dear = dearOf(who); const thing = THINGS.test(who);
  return {
    kind: 'love', dear, thing, title: pick(TITLES, seed),
    line: asLine(what),
    peruzzi: pick(thing ? THING_SAYINGS : SAYINGS, seed + 1).replace('{dear}', dear),
    escape: pick(thing ? THING_ESCAPES : ESCAPES, seed + 2),
  };
}
