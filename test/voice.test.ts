import { describe, expect, it } from 'vitest';
import { faceFor, meowFor, phrasesFor, type Mood } from '../src/index.js';

const moods: Mood[] = [
  'sleepy',
  'hungry',
  'restless',
  'aloof',
  'affectionate',
  'playful',
  'content',
];

describe('pick', () => {
  it('reaches the first and last entry at the ends of the range', () => {
    const pool = phrasesFor('content');
    expect(meowFor('content', () => 0)).toBe(pool[0]);
    expect(meowFor('content', () => 0.999999)).toBe(pool[pool.length - 1]);
  });

  it('stays in bounds even for a badly behaved RNG returning 1', () => {
    const pool = phrasesFor('hungry');
    expect(meowFor('hungry', () => 1)).toBe(pool[pool.length - 1]);
  });
});

describe('phrases', () => {
  it('gives every mood its own non-trivial pool', () => {
    for (const mood of moods) {
      expect(phrasesFor(mood).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('does not reuse the same phrase across moods', () => {
    const all = moods.flatMap((mood) => [...phrasesFor(mood)]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('faces', () => {
  it('draws a distinct cat for every mood', () => {
    const faces = moods.map(faceFor);
    for (const face of faces) expect(face).toContain('/\\_/\\');
    expect(new Set(faces).size).toBe(moods.length);
  });

  it('does not start with a stray newline', () => {
    expect(faceFor('content').startsWith('\n')).toBe(false);
  });
});
