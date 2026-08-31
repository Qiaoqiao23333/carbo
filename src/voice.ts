import type { Mood, Random } from './types.js';

/**
 * What Carbo says in each mood.
 *
 * Every pool has at least four entries so repeated calls do not read like a
 * broken record, and none of them are interchangeable across moods — a hungry
 * meow and a sleepy one are different noises.
 */
const phrases: Record<Mood, readonly string[]> = {
  sleepy: ['mrrp...', '*yawn*', 'mew?', '*slow blink*', 'prrr... zzz'],
  hungry: ['MEOW.', 'mrrrOW!', 'meow meow meow', '*stares at the cupboard*', 'MRRRP!'],
  restless: ['mrrrrow!', '*thunders down the hall*', 'chirrrp!', 'mrow? mrow!', '*knocks something off a shelf*'],
  aloof: ['...', '*looks away*', 'mrf.', '*tail flick*', '*sits just out of reach*'],
  affectionate: ['prrrrrrr', 'mrrp!', '*headbutt*', 'prrp? prrp!', '*flops over*'],
  playful: ['chirrup!', 'mrow!', '*pounces*', 'ekekekek', '*wiggles, then launches*'],
  content: ['prrr', 'mrrp', 'mew', '*kneads the blanket*', 'prrp'],
};

/** Pick one element of a non-empty array using an injectable RNG. */
export function pick<T>(items: readonly T[], random: Random): T {
  if (items.length === 0) throw new RangeError('pick() needs a non-empty array');
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] as T;
}

/** A mood-appropriate noise. */
export function meowFor(mood: Mood, random: Random): string {
  return pick(phrases[mood], random);
}

/** The full phrase pool for a mood, for anyone who wants to render their own. */
export function phrasesFor(mood: Mood): readonly string[] {
  return phrases[mood];
}
