/**
 * carbo — a tiny virtual cat, modelled after a kitten of the same name.
 *
 * @example
 * ```ts
 * import { Carbo } from 'carbo';
 *
 * const carbo = new Carbo();
 * carbo.on('hungry', () => carbo.feed('tuna'));
 * carbo.tick(60 * 8);
 * console.log(carbo.render());
 * ```
 */
export { Carbo } from './carbo.js';
export { Emitter } from './emitter.js';
export { foods, resolveFood, type Feedable, type FoodName } from './foods.js';
export { lifeStageFor, moodFor, thresholds, wellbeing } from './moods.js';
export { faceFor } from './art.js';
export { meowFor, phrasesFor, pick } from './voice.js';
export type {
  ActionName,
  CarboEvent,
  CarboEvents,
  CarboOptions,
  CatState,
  CatStats,
  CatStatus,
  Food,
  Interaction,
  LifeStage,
  Mood,
  Random,
} from './types.js';
