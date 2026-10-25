import type { Reading } from './peruzzi';
import { asLine } from './peruzzi';

/** Readings written to fit any note, for when the AI is slow or down: the show goes on, and the admin sees which notes
 *  had one. The note keeps its writer's line as written ("You …"), with a title and Peruzzi's answer picked for it. */
const pick = <T>(a: T[], seed: number) => a[Math.abs(seed) % a.length];

const TITLES = ['Little Things', 'Bonus Track', 'No Accident', 'Front Row', 'Encore'];
/** Peruzzi's answer, for any note at all: the kinds of love that fit whatever someone did; and for a thing */
const VERDICTS = ['Situationship', 'Complicated Love', 'Pending Love', 'Almost Love', 'Love Loading', 'Certified Delulu'];
const THING_VERDICTS = ['Soft Life', 'True Love', 'Comfort Love', 'Forever Love'];
/** what can't read a note: someone writing to it posts it instead of sending it */
const THINGS = /\b(bed|pillow|jollof|amala|suya|rice|food|bread|indomie|phone|charger|generator|wi-?fi|data|nepa|light|car|lagos|abuja|arsenal|chelsea|barca|madrid|dog|cat|bag|money|salary|weekend|sleep|music)\b/i;

/** "my crush" → "Crush", "Tolu" → "Tolu": who a note is to, as it'd say it after "Dear" */
export function dearOf(who: string) {
  const t = who.trim().replace(/^dear\s+/i, '').replace(/^my\s+/i, '').replace(/[,.!:;]+$/, '').split(/\s+/).slice(0, 3).join(' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'You';
}

/** Peruzzi's answer picked for a note: for a reading whose own didn't come, or one with none at all. */
export const fallbackVerdict = (thing: boolean, seed: number) => pick(thing ? THING_VERDICTS : VERDICTS, seed);

export function fallbackReading(who: string, what: string, seed: number): Reading {
  const thing = THINGS.test(who);
  return { kind: 'love', dear: dearOf(who), thing, title: pick(TITLES, seed), line: asLine(what), verdict: fallbackVerdict(thing, seed) };
}
