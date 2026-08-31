/** A pseudo-random source in `[0, 1)`. Inject one to make Carbo deterministic in tests. */
export type Random = () => number;

/**
 * Carbo's four needs, each on a 0–100 scale.
 *
 * They are deliberately *not* all "higher is better" — that mirrors how the
 * underlying drives actually work: hunger and boredom are pressures that build
 * up, energy and affection are reserves that drain.
 */
export interface CatStats {
  /** 0 = just ate, 100 = yowling at the cupboard. */
  hunger: number;
  /** 0 = flat out asleep on her feet, 100 = 3am zoomies. */
  energy: number;
  /** 0 = won't look at you, 100 = velcro cat. */
  affection: number;
  /** 0 = thoroughly entertained, 100 = climbing the curtains. */
  boredom: number;
}

/** What Carbo is feeling right now, derived from {@link CatStats}. */
export type Mood =
  | 'sleepy'
  | 'hungry'
  | 'restless'
  | 'aloof'
  | 'affectionate'
  | 'playful'
  | 'content';

/** Broad age bracket, derived from how long she has been alive. */
export type LifeStage = 'kitten' | 'adolescent' | 'adult';

/** Something you can offer Carbo. */
export interface Food {
  /** Display name, used in interaction responses. */
  name: string;
  /** How much hunger a single serving removes, in stat points. */
  satiety: number;
  /** How much affection a single serving earns you. */
  delight: number;
  /** How much energy a single serving restores. */
  energy: number;
}

/** The kinds of things you can do to (or, honestly, *for*) a cat. */
export type ActionName = 'feed' | 'play' | 'pet' | 'sleep' | 'wake';

/**
 * The outcome of an interaction.
 *
 * Cats decline things. An interaction that was refused is not an error — it is
 * a perfectly normal answer — so this is a value, not a thrown exception.
 */
export interface Interaction {
  action: ActionName;
  /** `false` when Carbo declined; the stats are then left untouched. */
  accepted: boolean;
  /** Why she declined. Only present when `accepted` is `false`. */
  reason?: string;
  /** What she said about it. */
  response: string;
  /** Her mood immediately after the interaction. */
  mood: Mood;
}

/** A point-in-time snapshot of everything worth knowing about Carbo. */
export interface CatStatus {
  name: string;
  stats: CatStats;
  mood: Mood;
  lifeStage: LifeStage;
  ageInDays: number;
  asleep: boolean;
  /** Total simulated minutes since she was created. */
  minutesLived: number;
}

/** Serialised form, as produced by `Carbo#toJSON()`. */
export interface CatState {
  name: string;
  stats: CatStats;
  asleep: boolean;
  minutesLived: number;
  /** Her age in days at the moment she was first constructed. */
  startingAgeInDays: number;
}

export interface CarboOptions {
  /** Defaults to `'Carbo'`. */
  name?: string;
  /** Starting stats. Anything you leave out gets a well-rested default. */
  stats?: Partial<CatStats>;
  /** Age in days at creation time. Defaults to `84` (a twelve-week kitten). */
  ageInDays?: number;
  /** Injectable randomness, so tests can pin every meow. */
  random?: Random;
}

/** Payload map for {@link CarboEvent} listeners. */
export interface CarboEvents {
  /** Simulated time passed. */
  tick: { minutes: number; status: CatStatus };
  /** Her mood changed to something new. */
  mood: { from: Mood; to: Mood };
  /** Hunger crossed the "please feed me" threshold going up. */
  hungry: { hunger: number };
  /** Boredom crossed the "entertain me" threshold going up. */
  bored: { boredom: number };
  /** She fell asleep, on her own or because you asked. */
  sleep: { energy: number };
  /** She woke up. */
  wake: { energy: number };
  /** An interaction resolved, accepted or not. */
  interaction: Interaction;
}

export type CarboEvent = keyof CarboEvents;
