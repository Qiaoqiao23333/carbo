import type { Food } from './types.js';

/**
 * The pantry.
 *
 * `satiety` is in hunger points removed per serving, so a tin of wet food
 * (`40`) covers roughly half a day's drift while a treat (`6`) buys you
 * about an hour of goodwill.
 */
export const foods = {
  kibble: { name: 'kibble', satiety: 25, delight: 4, energy: 6 },
  wet: { name: 'wet food', satiety: 40, delight: 12, energy: 10 },
  tuna: { name: 'tuna', satiety: 35, delight: 20, energy: 8 },
  chicken: { name: 'chicken', satiety: 38, delight: 18, energy: 9 },
  treat: { name: 'a treat', satiety: 6, delight: 10, energy: 3 },
  grass: { name: 'houseplant', satiety: 2, delight: 6, energy: 0 },
  water: { name: 'water', satiety: 0, delight: 1, energy: 2 },
} as const satisfies Record<string, Food>;

/** Names of everything in {@link foods}. */
export type FoodName = keyof typeof foods;

/** Anything Carbo will accept: a pantry name, or a food you define yourself. */
export type Feedable = FoodName | Food;

/** Normalise a {@link Feedable} into a concrete {@link Food}. */
export function resolveFood(food: Feedable): Food {
  return typeof food === 'string' ? foods[food] : food;
}
