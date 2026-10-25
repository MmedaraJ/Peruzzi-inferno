import type { Reading } from './peruzzi';
import { asLine } from './peruzzi';

/** Readings written to fit any note, for when the AI is slow or down: the show goes on, and the admin sees which notes
 *  had one. The note keeps its writer's line as written ("You …"), with a title picked for it. */
const pick = <T>(a: T[], seed: number) => a[Math.abs(seed) % a.length];

const TITLES = ['Little Things', 'Bonus Track', 'No Accident', 'Front Row', 'Encore'];
/** what can't read a note: someone writing to it posts it instead of sending it */
const THINGS = /\b(bed|pillow|jollof|amala|suya|rice|food|bread|indomie|phone|charger|generator|wi-?fi|data|nepa|light|car|lagos|abuja|arsenal|chelsea|barca|madrid|dog|cat|bag|money|salary|weekend|sleep|music)\b/i;

/** "my crush" → "Crush", "Tolu" → "Tolu": who a note is to, as it'd say it after "Dear" */
export function dearOf(who: string) {
  const t = who.trim().replace(/^dear\s+/i, '').replace(/^my\s+/i, '').replace(/[,.!:;]+$/, '').split(/\s+/).slice(0, 3).join(' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'You';
}

export function fallbackReading(who: string, what: string, seed: number): Reading {
  return { kind: 'love', dear: dearOf(who), thing: THINGS.test(who), title: pick(TITLES, seed), line: asLine(what) };
}
