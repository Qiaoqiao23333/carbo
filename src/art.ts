import type { Mood } from './types.js';

/**
 * One small ASCII cat per mood.
 *
 * Written with the eyes doing the work — that is the only part small enough to
 * read at this size, and it is what actually reads as an emotion.
 */
const faces: Record<Mood, string> = {
  sleepy: String.raw`
 /\_/\
( -.- )
 > ^ <   zzz`,
  hungry: String.raw`
 /\_/\
( O.O )
 > ^ <   feed me`,
  restless: String.raw`
 /\_/\
( >_< )
 >/ \<   !!!`,
  aloof: String.raw`
 /\_/\
( -_- )
 > ^ <`,
  affectionate: String.raw`
 /\_/\
( ^.^ )
 > ^ <   <3`,
  playful: String.raw`
 /\_/\
( 0.0 )
 >/ \<   ~`,
  content: String.raw`
 /\_/\
( =.= )
 > ^ <   prrr`,
};

/** The ASCII cat for a mood, without the leading newline. */
export function faceFor(mood: Mood): string {
  return faces[mood].slice(1);
}
