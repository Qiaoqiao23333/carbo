<img src="docs/assets/carbo.jpg" alt="Carbo, a tabby kitten, peering down into a tube" width="180" align="right" />

# carbo

A tiny virtual cat, modelled after a real kitten of the same name.

Carbo has four needs that drift as time passes, a mood derived from whichever
need is loudest, and a set of interactions she may or may not go along with.
Nothing runs in real time — you advance the clock yourself, which makes the
whole thing deterministic and trivial to test.

```
 /\_/\
( 0.0 )
 >/ \<   ~

Carbo · playful · hunger 30 · energy 80 · affection 50 · boredom 20
```

- Zero dependencies, ESM + CJS, works in Node and in the browser
- Fully typed, including event payloads
- Injectable RNG, so every meow can be pinned in a test

## Install

```sh
npm install carbo
```

## Quick start

```ts
import { Carbo } from 'carbo';

const carbo = new Carbo();

carbo.on('hungry', () => carbo.feed('tuna'));

carbo.tick(60 * 8); // eight hours pass
console.log(carbo.render());

carbo.play(15);
console.log(carbo.mood); // 'content'
```

```
 /\_/\
( =.= )
 > ^ <   prrr

Carbo · content · hunger 51 · energy 35 · affection 77 · boredom 0
```

## How she works

### The four needs

Every stat runs 0–100. They are deliberately not all "higher is better" —
hunger and boredom are pressures that build up, energy and affection are
reserves that drain.

| Stat        | 0                        | 100                       |
| ----------- | ------------------------ | ------------------------- |
| `hunger`    | just ate                 | yowling at the cupboard   |
| `energy`    | asleep on her feet       | 3am zoomies               |
| `affection` | won't look at you        | velcro cat                |
| `boredom`   | thoroughly entertained   | climbing the curtains     |

### Mood

`mood` is derived, never set. The checks run most-urgent first, so only one
need gets to be the mood at a time:

```
asleep or energy ≤ 15  → 'sleepy'
hunger ≥ 70            → 'hungry'
boredom ≥ 70           → 'restless'
affection ≤ 20         → 'aloof'
affection ≥ 75         → 'affectionate'   (if hunger < 40)
boredom < 25           → 'playful'        (if energy > 60)
otherwise              → 'content'
```

Those cut-offs are exported as `thresholds`, so a UI can be built against the
same numbers Carbo uses internally instead of guessing at them.

### Time

`tick(minutes)` advances the simulated clock. Time is stepped a minute at a
time internally, so threshold crossings, collapsing from exhaustion, and waking
up rested all land on the right minute rather than being smeared over one jump.

```ts
carbo.tick(30);      // half an hour
carbo.tick(60 * 24); // a full day
carbo.tick(0.5);     // fractional minutes are fine
```

## Interactions

Every interaction returns an `Interaction` rather than throwing, because a cat
declining something is a normal answer, not an error. A refused interaction
leaves her stats untouched.

```ts
const result = carbo.play(10);
// { action: 'play', accepted: false, reason: 'Carbo is far too tired', response: '*yawn*', mood: 'sleepy' }
```

### `feed(food?, servings?)`

Pantry names: `'kibble'`, `'wet'`, `'tuna'`, `'chicken'`, `'treat'`, `'grass'`,
`'water'` — or pass your own `Food`.

```ts
carbo.feed();          // kibble
carbo.feed('tuna');
carbo.feed('kibble', 2);
carbo.feed({ name: 'a whole roast chicken', satiety: 60, delight: 50, energy: 20 });
```

She turns down a real meal if she has just eaten, but there is always room for
a treat. Food is also the one thing that will wake her up — if she is hungry
enough to care.

### `play(minutes?)`

Burns energy, kills boredom, builds affection, and advances the clock by
`minutes`. You cannot get a free hour of enrichment out of a cat. Declined if
she is asleep or too tired.

### `pet()`

The cheapest way to build affection. A `restless` or `aloof` cat has about a
one-in-three chance of nibbling you instead — which is where the injectable RNG
earns its keep. Petting a sleeping cat is allowed and will not wake her.

### `sleep()` / `wake()` / `nap(minutes?)`

She also falls asleep on her own at `energy ≤ 5` and gets up at `energy ≥ 95`,
whether or not you were done.

```ts
carbo.nap(120); // sleep, let two hours pass, get up — unless she got up already
```

## Events

Typed payloads, and an unsubscribe function back from `on`:

```ts
const off = carbo.on('mood', ({ from, to }) => console.log(`${from} → ${to}`));

carbo.on('hungry', ({ hunger }) => carbo.feed('wet'));
carbo.on('bored', () => carbo.play(20));
carbo.once('sleep', () => console.log('out cold'));

off();
```

| Event         | Fires when                                        |
| ------------- | ------------------------------------------------- |
| `tick`        | simulated time passed                             |
| `mood`        | her mood changed (never fires twice for one change) |
| `hungry`      | hunger crossed 70 going up                        |
| `bored`       | boredom crossed 70 going up                       |
| `sleep`       | she fell asleep                                   |
| `wake`        | she woke up                                       |
| `interaction` | any interaction resolved, refusals included       |

## Reading her state

```ts
carbo.status();    // everything in one object
carbo.stats;       // a copy — mutating it won't move the real cat
carbo.mood;        // 'playful'
carbo.wellbeing;   // 0.72 — rough 0–1 "is this cat alright" score
carbo.ageInDays;   // 84.34
carbo.lifeStage;   // 'kitten' | 'adolescent' | 'adult'
carbo.render();    // ASCII cat + summary line
carbo.meow();      // a mood-appropriate noise; changes nothing
```

## Saving and restoring

```ts
localStorage.setItem('carbo', JSON.stringify(carbo));

const carbo = Carbo.from(JSON.parse(localStorage.getItem('carbo')!));
```

The RNG is not serialisable, so pass it again if you were injecting one:
`Carbo.from(state, { random })`.

## Determinism

Every random choice goes through one injectable function, so a seeded cat
behaves identically on every run:

```ts
const carbo = new Carbo({ random: () => 0.4 });
carbo.meow(); // same string, every time
```

## Options

```ts
new Carbo({
  name: 'Carbo',      // default 'Carbo'
  ageInDays: 84,      // default 84 — a twelve-week kitten
  stats: { hunger: 10 }, // merged over the defaults, clamped to 0–100
  random: Math.random,
});
```

## The demo page

`docs/` holds a full-screen homepage built on the library: the real Carbo fills
the window, and a tube-shaped opening follows your cursor — inside it she is
sharp and lit, outside she is dark and out of focus. The mood grading, the
playback speed, the size of the opening and the readout are all driven by a
live `Carbo` instance, ticking at 360× real time.

It is plain static files with no build step at serve time, so any static host
works:

```sh
npm run build          # regenerates docs/carbo.js from src/
cd docs && python3 -m http.server 8765
```

The page needs `docs/carbo1.mp4` — the source clip — to be present.

## Development

```sh
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## License

MIT
