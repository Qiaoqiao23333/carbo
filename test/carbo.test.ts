import { describe, expect, it, vi } from 'vitest';
import { Carbo, foods, thresholds, type CatStats, type Mood } from '../src/index.js';

/** A fixed RNG, so every meow and every coin flip is pinned. */
const fixed = (value: number) => () => value;

/** An RNG that walks a script and then repeats its last value forever. */
function scripted(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}

function cat(stats?: Partial<CatStats>, random = fixed(0.5)): Carbo {
  return new Carbo({ ...(stats ? { stats } : {}), random });
}

describe('construction', () => {
  it('is a twelve-week kitten named Carbo by default', () => {
    const carbo = new Carbo();
    expect(carbo.name).toBe('Carbo');
    expect(carbo.ageInDays).toBe(84);
    expect(carbo.lifeStage).toBe('kitten');
    expect(carbo.asleep).toBe(false);
    expect(carbo.mood).toBe('playful');
  });

  it('merges partial stats over the defaults', () => {
    const carbo = cat({ hunger: 90 });
    expect(carbo.stats).toEqual({ hunger: 90, energy: 80, affection: 50, boredom: 20 });
  });

  it('clamps out-of-range starting stats into 0–100', () => {
    const carbo = cat({ hunger: 400, energy: -20 });
    expect(carbo.stats.hunger).toBe(100);
    expect(carbo.stats.energy).toBe(0);
  });

  it('hands out a copy of the stats, not the live object', () => {
    const carbo = cat();
    carbo.stats.hunger = 0;
    expect(carbo.stats.hunger).toBe(30);
  });

  it('brackets life stages by age', () => {
    expect(new Carbo({ ageInDays: 100 }).lifeStage).toBe('kitten');
    expect(new Carbo({ ageInDays: 200 }).lifeStage).toBe('adolescent');
    expect(new Carbo({ ageInDays: 900 }).lifeStage).toBe('adult');
  });

  it('refuses an empty name', () => {
    const carbo = cat();
    expect(() => {
      carbo.name = '   ';
    }).toThrow(RangeError);
  });
});

describe('tick', () => {
  it('drifts every need in the right direction while awake', () => {
    const carbo = cat();
    carbo.tick(100);
    const { hunger, energy, affection, boredom } = carbo.stats;
    expect(hunger).toBeGreaterThan(30);
    expect(energy).toBeLessThan(80);
    expect(affection).toBeLessThan(50);
    expect(boredom).toBeGreaterThan(20);
    expect(carbo.minutesLived).toBe(100);
  });

  it('reaches the same state whether time passes in one jump or many', () => {
    const one = cat();
    const many = cat();
    one.tick(120);
    for (let i = 0; i < 120; i++) many.tick(1);
    expect(one.stats).toEqual(many.stats);
    expect(one.minutesLived).toBe(many.minutesLived);
  });

  it('handles fractional minutes', () => {
    const carbo = cat();
    carbo.tick(0.5);
    expect(carbo.minutesLived).toBe(0.5);
    expect(carbo.stats.hunger).toBeCloseTo(30.05, 2);
  });

  it('never lets a stat leave 0–100', () => {
    const carbo = cat();
    carbo.tick(10_000);
    for (const value of Object.values(carbo.stats)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('rejects negative and non-finite durations', () => {
    const carbo = cat();
    expect(() => carbo.tick(-1)).toThrow(RangeError);
    expect(() => carbo.tick(Number.NaN)).toThrow(RangeError);
    expect(() => carbo.tick(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('turns an unattended cat hungry, then restless', () => {
    const carbo = cat();
    carbo.tick(60 * 8);
    expect(carbo.stats.hunger).toBeGreaterThanOrEqual(thresholds.hungry);
    expect(carbo.mood).toBe('hungry');
  });
});

describe('events', () => {
  it('fires hungry and bored once, on the crossing step', () => {
    const carbo = cat();
    const hungry = vi.fn();
    const bored = vi.fn();
    carbo.on('hungry', hungry);
    carbo.on('bored', bored);

    carbo.tick(60 * 10);

    expect(hungry).toHaveBeenCalledTimes(1);
    expect(bored).toHaveBeenCalledTimes(1);
    expect(hungry.mock.calls[0]?.[0].hunger).toBeGreaterThanOrEqual(thresholds.hungry);
  });

  it('reports mood transitions in order, with no duplicates', () => {
    const carbo = cat();
    const moods: Mood[] = [];
    carbo.on('mood', ({ from, to }) => {
      expect(from).not.toBe(to);
      moods.push(to);
    });

    carbo.tick(60 * 8);

    expect(moods).toContain('hungry');
    expect(new Set(moods).size).toBe(moods.length);
  });

  it('emits exactly one mood event for an interaction that changes stats twice', () => {
    const carbo = cat({ hunger: 95, boredom: 10, energy: 80, affection: 50 });
    const mood = vi.fn();
    carbo.on('mood', mood);

    expect(carbo.mood).toBe('hungry');
    carbo.feed('wet');

    expect(mood).toHaveBeenCalledTimes(1);
    expect(mood.mock.calls[0]?.[0]).toEqual({ from: 'hungry', to: 'playful' });
  });

  it('unsubscribes via the returned function', () => {
    const carbo = cat();
    const listener = vi.fn();
    const off = carbo.on('tick', listener);

    carbo.tick(1);
    off();
    carbo.tick(1);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports every interaction, refusals included', () => {
    const carbo = cat({ energy: 5, hunger: 30, affection: 50, boredom: 20 });
    const seen: boolean[] = [];
    carbo.on('interaction', (i) => seen.push(i.accepted));

    carbo.play(5);
    carbo.pet();

    expect(seen).toEqual([false, true]);
  });
});

describe('feeding', () => {
  it('fills her up and buys goodwill', () => {
    const carbo = cat({ hunger: 80, energy: 50, affection: 40, boredom: 30 });
    const result = carbo.feed('tuna');

    expect(result.accepted).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(carbo.stats.hunger).toBe(80 - foods.tuna.satiety);
    expect(carbo.stats.affection).toBe(40 + foods.tuna.delight);
    expect(carbo.stats.energy).toBe(50 + foods.tuna.energy);
  });

  it('scales with servings', () => {
    const carbo = cat({ hunger: 100, energy: 50, affection: 40, boredom: 30 });
    carbo.feed('kibble', 2);
    expect(carbo.stats.hunger).toBe(100 - foods.kibble.satiety * 2);
  });

  it('accepts a custom food', () => {
    const carbo = cat({ hunger: 60, energy: 50, affection: 40, boredom: 30 });
    carbo.feed({ name: 'a whole roast chicken', satiety: 60, delight: 50, energy: 20 });
    expect(carbo.stats.hunger).toBe(0);
    expect(carbo.stats.affection).toBe(90);
  });

  it('turns down a real meal when she has just eaten', () => {
    const carbo = cat({ hunger: 2, energy: 50, affection: 40, boredom: 30 });
    const result = carbo.feed('wet');

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('walks away');
    expect(carbo.stats.hunger).toBe(2);
  });

  it('always has room for a treat', () => {
    const carbo = cat({ hunger: 2, energy: 50, affection: 40, boredom: 30 });
    expect(carbo.feed('treat').accepted).toBe(true);
    expect(carbo.stats.affection).toBe(40 + foods.treat.delight);
  });

  it('wakes a sleeping cat if she is hungry enough', () => {
    const carbo = cat({ hunger: 60, energy: 30, affection: 40, boredom: 30 });
    carbo.sleep();

    expect(carbo.feed('tuna').accepted).toBe(true);
    expect(carbo.asleep).toBe(false);
  });

  it('does not wake a sleeping cat that is not hungry', () => {
    const carbo = cat({ hunger: 20, energy: 30, affection: 40, boredom: 30 });
    carbo.sleep();

    const result = carbo.feed('tuna');
    expect(result.accepted).toBe(false);
    expect(carbo.asleep).toBe(true);
  });

  it('rejects a non-positive number of servings', () => {
    expect(() => cat().feed('kibble', 0)).toThrow(RangeError);
  });
});

describe('playing', () => {
  it('burns energy, kills boredom, and advances the clock', () => {
    const carbo = cat({ hunger: 20, energy: 90, affection: 40, boredom: 80 });
    const result = carbo.play(10);

    expect(result.accepted).toBe(true);
    expect(carbo.minutesLived).toBe(10);
    expect(carbo.stats.boredom).toBeLessThan(30);
    expect(carbo.stats.energy).toBeLessThan(90);
    expect(carbo.stats.affection).toBeGreaterThan(40);
    expect(carbo.stats.hunger).toBeGreaterThan(20);
  });

  it('is declined by an exhausted cat, and costs her nothing', () => {
    const carbo = cat({ hunger: 20, energy: thresholds.exhausted, affection: 40, boredom: 80 });
    const before = carbo.stats;
    const result = carbo.play(10);

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('too tired');
    expect(carbo.stats).toEqual(before);
    expect(carbo.minutesLived).toBe(0);
  });

  it('is declined by a sleeping cat', () => {
    const carbo = cat();
    carbo.sleep();
    expect(carbo.play(10).accepted).toBe(false);
  });

  it('rejects a non-positive duration', () => {
    expect(() => cat().play(0)).toThrow(RangeError);
  });
});

describe('petting', () => {
  it('is the cheapest way to build affection', () => {
    const carbo = cat({ hunger: 20, energy: 80, affection: 40, boredom: 40 });
    const result = carbo.pet();

    expect(result.accepted).toBe(true);
    expect(carbo.stats.affection).toBe(46);
    expect(carbo.stats.boredom).toBe(36);
  });

  it('gets you nibbled by a standoffish cat on an unlucky roll', () => {
    const carbo = cat({ hunger: 20, energy: 80, affection: 10, boredom: 20 }, scripted([0.1]));
    expect(carbo.mood).toBe('aloof');

    const result = carbo.pet();
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('nibbles');
    expect(carbo.stats.affection).toBe(8);
  });

  it('goes fine for the same cat on a lucky roll', () => {
    const carbo = cat({ hunger: 20, energy: 80, affection: 10, boredom: 20 }, scripted([0.9]));
    expect(carbo.pet().accepted).toBe(true);
    expect(carbo.stats.affection).toBe(16);
  });

  it('is tolerated by a sleeping cat without waking her', () => {
    const carbo = cat({ hunger: 20, energy: 40, affection: 40, boredom: 20 });
    carbo.sleep();

    expect(carbo.pet().accepted).toBe(true);
    expect(carbo.asleep).toBe(true);
    expect(carbo.stats.affection).toBe(43);
  });
});

describe('sleep', () => {
  it('collapses on its own once energy runs out', () => {
    const carbo = cat({ hunger: 20, energy: 6, affection: 40, boredom: 20 });
    const slept = vi.fn();
    carbo.on('sleep', slept);

    carbo.tick(60);

    expect(slept).toHaveBeenCalledTimes(1);
    expect(carbo.asleep).toBe(true);
  });

  it('recovers energy during a nap, and rests off a little boredom too', () => {
    const carbo = cat({ hunger: 20, energy: 20, affection: 40, boredom: 60 });
    const woke = vi.fn();
    carbo.on('wake', woke);

    carbo.nap(200);

    expect(woke).toHaveBeenCalledTimes(1);
    expect(carbo.asleep).toBe(false);
    expect(carbo.stats.energy).toBeGreaterThan(80);
    expect(carbo.stats.boredom).toBeLessThan(60);
  });

  it('wakes on its own once rested, and nap() leaves her up', () => {
    const carbo = cat({ hunger: 20, energy: 20, affection: 40, boredom: 60 });
    const woke = vi.fn();
    carbo.on('wake', woke);

    // Long enough to hit the well-rested line partway through, so she gets up
    // by herself and spends the remainder awake.
    carbo.nap(300);

    expect(woke).toHaveBeenCalledTimes(1);
    expect(carbo.asleep).toBe(false);
    expect(carbo.stats.energy).toBeGreaterThan(80);
    // Awake time after waking adds boredom back faster than sleep removed it.
    expect(carbo.stats.boredom).toBeGreaterThan(60);
  });

  it('reads as sleepy while asleep, whatever else is going on', () => {
    const carbo = cat({ hunger: 100, energy: 50, affection: 40, boredom: 100 });
    expect(carbo.mood).toBe('hungry');
    carbo.sleep();
    expect(carbo.mood).toBe('sleepy');
  });

  it('declines redundant sleep and wake requests', () => {
    const carbo = cat();
    expect(carbo.wake().accepted).toBe(false);
    expect(carbo.sleep().accepted).toBe(true);
    expect(carbo.sleep().accepted).toBe(false);
  });
});

describe('reporting', () => {
  it('summarises everything in status()', () => {
    const carbo = cat();
    carbo.tick(30);
    expect(carbo.status()).toEqual({
      name: 'Carbo',
      stats: carbo.stats,
      mood: carbo.mood,
      lifeStage: 'kitten',
      ageInDays: carbo.ageInDays,
      asleep: false,
      minutesLived: 30,
    });
  });

  it('renders an ASCII cat with a summary line', () => {
    const rendered = cat().render();
    expect(rendered).toContain('/\\_/\\');
    expect(rendered).toContain('Carbo · playful');
    expect(rendered).toContain('hunger 30');
  });

  it('meows in character without changing anything', () => {
    const carbo = cat({ hunger: 95, energy: 80, affection: 40, boredom: 20 });
    const before = carbo.stats;
    expect(carbo.mood).toBe('hungry');
    expect(carbo.meow()).toMatch(/MEOW|mrr|meow|cupboard/i);
    expect(carbo.stats).toEqual(before);
  });

  it('scores wellbeing between 0 and 1, worst for a neglected cat', () => {
    const happy = cat({ hunger: 5, energy: 90, affection: 90, boredom: 5 });
    const neglected = cat({ hunger: 95, energy: 10, affection: 5, boredom: 95 });
    expect(happy.wellbeing).toBeGreaterThan(0.85);
    expect(neglected.wellbeing).toBeLessThan(0.15);
  });
});

describe('persistence', () => {
  it('round-trips through JSON unchanged', () => {
    const original = cat();
    original.tick(200);
    original.feed('tuna');
    original.sleep();

    const restored = Carbo.from(JSON.parse(JSON.stringify(original)) as ReturnType<Carbo['toJSON']>);

    expect(restored.status()).toEqual(original.status());
  });

  it('keeps drifting identically after being restored', () => {
    const original = cat();
    original.tick(120);
    const restored = Carbo.from(original.toJSON(), { random: fixed(0.5) });

    original.tick(120);
    restored.tick(120);

    expect(restored.stats).toEqual(original.stats);
  });
});
