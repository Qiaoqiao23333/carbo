import { faceFor } from './art.js';
import { Emitter } from './emitter.js';
import { resolveFood, type Feedable } from './foods.js';
import { lifeStageFor, moodFor, thresholds, wellbeing } from './moods.js';
import type {
  ActionName,
  CarboEvents,
  CarboOptions,
  CatState,
  CatStats,
  CatStatus,
  Interaction,
  LifeStage,
  Mood,
  Random,
} from './types.js';
import { meowFor } from './voice.js';

/** Per-simulated-minute drift while awake. */
const AWAKE_DRIFT: CatStats = {
  hunger: 0.1,
  energy: -0.07,
  affection: -0.015,
  boredom: 0.13,
};

/** Per-simulated-minute drift while asleep. Sleep is when energy comes back. */
const ASLEEP_DRIFT: CatStats = {
  hunger: 0.05,
  energy: 0.35,
  affection: -0.005,
  boredom: -0.02,
};

const DEFAULT_STATS: CatStats = {
  hunger: 30,
  energy: 80,
  affection: 50,
  boredom: 20,
};

/** Twelve weeks: old enough to have opinions, young enough to be a kitten. */
const DEFAULT_AGE_DAYS = 84;

const MINUTES_PER_DAY = 1440;

/** She wakes up on her own once she is this rested. */
const WELL_RESTED = 95;

/**
 * A small virtual cat.
 *
 * Carbo has four needs that drift as simulated time passes, a mood derived from
 * whichever need is loudest, and a set of interactions she may or may not go
 * along with. Nothing here is real-time — you advance the clock yourself with
 * {@link Carbo.tick}, which makes the whole thing deterministic and trivial to
 * test.
 *
 * ```ts
 * const carbo = new Carbo();
 * carbo.tick(60 * 6);   // six hours pass
 * carbo.mood;           // 'hungry'
 * carbo.feed('tuna');   // { accepted: true, response: 'prrrrrrr', ... }
 * ```
 */
export class Carbo extends Emitter<CarboEvents> {
  readonly #random: Random;
  readonly #startingAgeInDays: number;
  #name: string;
  #stats: CatStats;
  #asleep = false;
  #minutesLived = 0;
  /** The mood we last told listeners about, so `mood` events never duplicate. */
  #lastMood: Mood;

  constructor(options: CarboOptions = {}) {
    super();
    this.#name = options.name ?? 'Carbo';
    this.#random = options.random ?? Math.random;
    this.#startingAgeInDays = options.ageInDays ?? DEFAULT_AGE_DAYS;
    this.#stats = clampStats({ ...DEFAULT_STATS, ...options.stats });
    this.#lastMood = this.mood;
  }

  // ---------------------------------------------------------------- reading

  get name(): string {
    return this.#name;
  }

  set name(next: string) {
    const trimmed = next.trim();
    if (!trimmed) throw new RangeError('a cat needs a name');
    this.#name = trimmed;
  }

  /** A copy — mutating it will not move the real cat. */
  get stats(): CatStats {
    return { ...this.#stats };
  }

  get mood(): Mood {
    return moodFor(this.#stats, this.#asleep);
  }

  get asleep(): boolean {
    return this.#asleep;
  }

  get minutesLived(): number {
    return this.#minutesLived;
  }

  get ageInDays(): number {
    return round2(this.#startingAgeInDays + this.#minutesLived / MINUTES_PER_DAY);
  }

  get lifeStage(): LifeStage {
    return lifeStageFor(this.ageInDays);
  }

  /** Rough 0–1 "is this cat doing alright" score. */
  get wellbeing(): number {
    return wellbeing(this.#stats);
  }

  /** Everything worth knowing, in one object. */
  status(): CatStatus {
    return {
      name: this.#name,
      stats: this.stats,
      mood: this.mood,
      lifeStage: this.lifeStage,
      ageInDays: this.ageInDays,
      asleep: this.#asleep,
      minutesLived: this.#minutesLived,
    };
  }

  /** A mood-appropriate noise. Does not change her state. */
  meow(): string {
    return meowFor(this.mood, this.#random);
  }

  /** ASCII cat plus a one-line summary, ready to `console.log`. */
  render(): string {
    const { hunger, energy, affection, boredom } = this.#stats;
    const summary =
      `${this.#name} · ${this.mood}${this.#asleep ? ' (asleep)' : ''} · ` +
      `hunger ${Math.round(hunger)} · energy ${Math.round(energy)} · ` +
      `affection ${Math.round(affection)} · boredom ${Math.round(boredom)}`;
    return `${faceFor(this.mood)}\n\n${summary}`;
  }

  // ------------------------------------------------------------------- time

  /**
   * Advance the simulated clock.
   *
   * Time is stepped one minute at a time so that threshold crossings, falling
   * asleep from exhaustion, and waking up rested all land on the right minute
   * rather than being smeared over one big jump.
   *
   * @param minutes - Simulated minutes to advance. Must be finite and >= 0.
   */
  tick(minutes: number): this {
    if (!Number.isFinite(minutes) || minutes < 0) {
      throw new RangeError(`tick() needs a non-negative finite number, got ${minutes}`);
    }

    const whole = Math.floor(minutes);

    for (let i = 0; i < whole; i++) this.#step(1);
    const remainder = minutes - whole;
    if (remainder > 0) this.#step(remainder);

    this.emit('tick', { minutes, status: this.status() });
    return this;
  }

  /** Advance one minute's worth of drift and handle any auto-transitions. */
  #step(fraction: number): void {
    const before = this.#stats;
    const drift = this.#asleep ? ASLEEP_DRIFT : AWAKE_DRIFT;

    this.#stats = clampStats({
      hunger: before.hunger + drift.hunger * fraction,
      energy: before.energy + drift.energy * fraction,
      affection: before.affection + drift.affection * fraction,
      boredom: before.boredom + drift.boredom * fraction,
    });
    this.#minutesLived = round2(this.#minutesLived + fraction);

    // Edge-triggered: only fires on the step that crosses the line going up.
    if (before.hunger < thresholds.hungry && this.#stats.hunger >= thresholds.hungry) {
      this.emit('hungry', { hunger: this.#stats.hunger });
    }
    if (before.boredom < thresholds.bored && this.#stats.boredom >= thresholds.bored) {
      this.emit('bored', { boredom: this.#stats.boredom });
    }

    if (!this.#asleep && this.#stats.energy <= thresholds.collapse) {
      this.#asleep = true;
      this.emit('sleep', { energy: this.#stats.energy });
    } else if (this.#asleep && this.#stats.energy >= WELL_RESTED) {
      this.#asleep = false;
      this.emit('wake', { energy: this.#stats.energy });
    }

    this.#syncMood();
  }

  // ----------------------------------------------------------- interactions

  /**
   * Offer food.
   *
   * A treat-sized portion is always welcome; a full meal is not, if she has
   * just eaten. Food is also the one thing that will wake her up.
   *
   * @param food - A pantry name (`'tuna'`, `'kibble'`, …) or your own `Food`.
   * @param servings - How many portions. Defaults to one.
   */
  feed(food: Feedable = 'kibble', servings = 1): Interaction {
    if (servings <= 0) throw new RangeError(`servings must be positive, got ${servings}`);
    const meal = resolveFood(food);

    if (this.#asleep && this.#stats.hunger < 40) {
      return this.#refuse('feed', `${this.#name} is asleep and unmoved by ${meal.name}`);
    }
    if (this.#stats.hunger < 5 && meal.satiety > 10) {
      return this.#refuse('feed', `${this.#name} sniffs the ${meal.name} and walks away`);
    }

    if (this.#asleep) {
      this.#asleep = false;
      this.emit('wake', { energy: this.#stats.energy });
    }

    this.#adjust({
      hunger: -meal.satiety * servings,
      energy: meal.energy * servings,
      affection: meal.delight * servings,
      boredom: -3 * servings,
    });
    return this.#accept('feed');
  }

  /**
   * Play together. This advances the clock by `minutes` as well as burning
   * energy — you cannot get a free hour of enrichment out of a cat.
   *
   * She declines if she is asleep or too tired to bother.
   */
  play(minutes = 5): Interaction {
    if (minutes <= 0) throw new RangeError(`play() needs a positive duration, got ${minutes}`);

    if (this.#asleep) {
      return this.#refuse('play', `${this.#name} is asleep`);
    }
    if (this.#stats.energy <= thresholds.exhausted) {
      return this.#refuse('play', `${this.#name} is far too tired`);
    }

    this.tick(minutes);
    this.#adjust({
      hunger: 0.4 * minutes,
      energy: -1.2 * minutes,
      affection: 0.8 * minutes,
      boredom: -6 * minutes,
    });
    return this.#accept('play');
  }

  /**
   * Pet her.
   *
   * Cheap, quick, and the fastest way to build affection — but a restless or
   * standoffish cat has about a one-in-three chance of nibbling you instead,
   * which is where the injectable RNG earns its keep.
   */
  pet(): Interaction {
    if (this.#asleep) {
      // Petting a sleeping cat is allowed, and she may not even wake up.
      this.#adjust({ affection: 3, boredom: -1, hunger: 0, energy: 0 });
      return this.#accept('pet');
    }

    const mood = this.mood;
    const prickly = mood === 'restless' || mood === 'aloof';
    if (prickly && this.#random() < 0.35) {
      this.#adjust({ affection: -2, boredom: -2, hunger: 0, energy: 0 });
      return this.#refuse('pet', `${this.#name} nibbles your hand and stalks off`);
    }

    this.#adjust({ affection: 6, boredom: -4, energy: -0.5, hunger: 0 });
    return this.#accept('pet');
  }

  /** Put her down for a nap. Refused if she is already asleep. */
  sleep(): Interaction {
    if (this.#asleep) return this.#refuse('sleep', `${this.#name} is already asleep`);
    this.#asleep = true;
    this.emit('sleep', { energy: this.#stats.energy });
    this.#syncMood();
    return this.#accept('sleep');
  }

  /** Wake her up. Refused if she is already awake. */
  wake(): Interaction {
    if (!this.#asleep) return this.#refuse('wake', `${this.#name} is already awake`);
    this.#asleep = false;
    this.emit('wake', { energy: this.#stats.energy });
    this.#syncMood();
    return this.#accept('wake');
  }

  /**
   * Sleep, let `minutes` pass, then wake up — unless she woke on her own part
   * way through, in which case she stays up.
   */
  nap(minutes = 120): this {
    if (!this.#asleep) this.sleep();
    this.tick(minutes);
    if (this.#asleep) this.wake();
    return this;
  }

  // ------------------------------------------------------------ persistence

  /** Serialisable state. Round-trips through `JSON.stringify`. */
  toJSON(): CatState {
    return {
      name: this.#name,
      stats: this.stats,
      asleep: this.#asleep,
      minutesLived: this.#minutesLived,
      startingAgeInDays: this.#startingAgeInDays,
    };
  }

  /**
   * Rebuild a cat from {@link Carbo.toJSON} output.
   *
   * The RNG is not serialisable, so pass it again here if you were injecting
   * one.
   */
  static from(state: CatState, options: Pick<CarboOptions, 'random'> = {}): Carbo {
    const carbo = new Carbo({
      name: state.name,
      stats: state.stats,
      ageInDays: state.startingAgeInDays,
      ...(options.random ? { random: options.random } : {}),
    });
    carbo.#asleep = state.asleep;
    carbo.#minutesLived = state.minutesLived;
    carbo.#lastMood = carbo.mood;
    return carbo;
  }

  // --------------------------------------------------------------- internal

  #adjust(delta: CatStats): void {
    const current = this.#stats;
    this.#stats = clampStats({
      hunger: current.hunger + delta.hunger,
      energy: current.energy + delta.energy,
      affection: current.affection + delta.affection,
      boredom: current.boredom + delta.boredom,
    });
    this.#syncMood();
  }

  /**
   * Emit `mood` if — and only if — the mood differs from the last one we
   * announced. Every mutation funnels through here, so a single interaction
   * that changes stats twice still produces at most one event.
   */
  #syncMood(): void {
    const to = this.mood;
    if (to === this.#lastMood) return;
    const from = this.#lastMood;
    this.#lastMood = to;
    this.emit('mood', { from, to });
  }

  #accept(action: ActionName): Interaction {
    return this.#resolve({ action, accepted: true, response: this.meow(), mood: this.mood });
  }

  #refuse(action: ActionName, reason: string): Interaction {
    return this.#resolve({
      action,
      accepted: false,
      reason,
      response: this.meow(),
      mood: this.mood,
    });
  }

  #resolve(interaction: Interaction): Interaction {
    this.emit('interaction', interaction);
    return interaction;
  }
}

function clamp(value: number): number {
  return round2(Math.min(100, Math.max(0, value)));
}

function clampStats(stats: CatStats): CatStats {
  return {
    hunger: clamp(stats.hunger),
    energy: clamp(stats.energy),
    affection: clamp(stats.affection),
    boredom: clamp(stats.boredom),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
