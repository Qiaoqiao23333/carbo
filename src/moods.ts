import type { CatStats, LifeStage, Mood } from './types.js';

/**
 * The lines at which a need stops being background noise and starts driving
 * behaviour. Exported so callers can build their own UI against the same
 * numbers Carbo uses internally, instead of guessing.
 */
export const thresholds = {
  /** At or above this, hunger dominates her mood. */
  hungry: 70,
  /** At or above this, boredom dominates her mood. */
  bored: 70,
  /** At or below this, she is too tired for anything but sleeping. */
  exhausted: 15,
  /** At or below this, she keeps her distance. */
  aloof: 20,
  /** At or above this, she seeks you out. */
  devoted: 75,
  /** At or below this, she falls asleep whether or not you were done. */
  collapse: 5,
} as const;

/**
 * Derive a mood from the current stats.
 *
 * Order matters: the checks run most-urgent first, so a starving cat reads as
 * `'hungry'` even when she is also bored and full of affection. Only one need
 * gets to be the mood.
 */
export function moodFor(stats: CatStats, asleep: boolean): Mood {
  if (asleep || stats.energy <= thresholds.exhausted) return 'sleepy';
  if (stats.hunger >= thresholds.hungry) return 'hungry';
  if (stats.boredom >= thresholds.bored) return 'restless';
  if (stats.affection <= thresholds.aloof) return 'aloof';
  if (stats.affection >= thresholds.devoted && stats.hunger < 40) return 'affectionate';
  if (stats.boredom < 25 && stats.energy > 60) return 'playful';
  return 'content';
}

/** Bracket an age in days into a {@link LifeStage}. */
export function lifeStageFor(ageInDays: number): LifeStage {
  if (ageInDays < 180) return 'kitten';
  if (ageInDays < 365) return 'adolescent';
  return 'adult';
}

/**
 * A rough 0–1 "how well is this cat doing" score.
 *
 * Handy for a status bar. Hunger and energy are weighted heaviest because they
 * are the two that actually make a cat miserable.
 */
export function wellbeing(stats: CatStats): number {
  const fed = 1 - stats.hunger / 100;
  const rested = stats.energy / 100;
  const entertained = 1 - stats.boredom / 100;
  const loved = stats.affection / 100;
  return round2(fed * 0.35 + rested * 0.3 + entertained * 0.2 + loved * 0.15);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
