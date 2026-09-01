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

`docs/` holds a full-screen homepage built on the library. Two clips of the real
Carbo — one shot from inside a cardboard tube she was peering down, one from
inside a box she was reaching into — are blown up and hung off an anchor point
that puts the hole she is looking into in the middle of the window. The page is
the inside of that tube: her face has nearly all of it, the corners are dark, and
behind her the same frame at 32x57 pixels, blown up under a heavy blur, fills
whatever is left, so there is no edge of a video anywhere on screen.

The footage plays in *beats*: short marked stretches of the clips, each one a
single thing she does. Watching you. Sniffing the rim. Leaning in. Putting her
face over the hole until it blocks the light. A paw landing on the lens. Your
cursor does not scrub the timeline any more — it only decides which beat comes
next. Hold still and she comes over and touches the lens, which pushes the page,
warms the light where she landed, and purrs. Wave your hand about and she backs
off. Click anywhere and she is petted, and she may decline. Pet her again while
she is still against the lens and she is stroked where she is rather than brought
closer — cutting to a closer beat on every click used to walk the picture in
until there was nothing left to see — and keep at it and she takes herself off.
The mood grading,
how far the page leans with your cursor, how long you have to hold still before
she comes, and the readout are all driven by a live `Carbo` instance ticking at
360× real time.

An earlier version made the cursor's horizontal position the playhead, so moving
your hand ran the camera back and forth over her. It put her where you pointed,
but it cost her her own motion: the footage moved only when you did and only as
fast as you did, and it read as a video being dragged rather than as a cat.
Beats keep everything on screen a real movement at its real speed, which is most
of what makes her feel like she is there.

Two details of the arrival are load-bearing. It happens without being asked —
the window opens on her already looking at you and she has touched you inside a
couple of seconds — and the beat it uses comes off the short clip, which is
370KB and starts at the head of the file. The one moment the page promises at a
particular second does not wait on a seek twelve seconds into the long one.

The clips are re-encoded with a keyframe every half second, so cutting to a beat
lands quickly instead of decoding forward from the last keyframe.

### Keeping it still enough to sit in front of

The first version of this was unpleasant to look at, and all of it came from the
same place: a page filling the window with a handheld clip magnified three times
is showing you three times the camera shake it was shot with, and that adds up
fast. Five things were done about it, in order of how much they were worth.

1. **The clips are shipped stabilised.** An offline pass estimates the camera's
   own movement frame by frame, subtracts everything above about a third of a
   hertz, and re-renders the clip cropped in 22% so the correction never exposes
   an edge. That takes a third of the movement out of the footage, and about a
   quarter of it off the screen once the crop is paid for. Both signs in that
   pass were settled by measuring the output rather than by reasoning about
   them, which is worth doing: the first attempt had one of them inverted and
   made the shake almost twice as bad.
2. **The beats are cut for stillness.** The frame to frame movement was measured
   across the whole clip, and the beats are the calmest stretches that also end
   close to where they began — the second half of that being what lets a beat
   repeat without the repeat showing. The busiest thirds of the take are never
   played.
3. **The clip is not asked to cover the window.** It is drawn at 70% of the
   magnification that would, with the blurred backdrop taking up the slack. That
   was worth doing for the framing alone — covering a landscape window with a
   portrait clip crops the top of her head and her chin off it, so you get the
   middle of a face rather than a cat — and it takes another sixth off the
   movement for free, because the footage's own shake is magnified by this too.
4. **Everything runs at about three quarters speed**, which reads as a cat
   taking her time rather than as slow motion.
5. **The page adds almost no motion of its own.** An earlier version shook the
   whole window on contact and leaned it a quarter of an inch with the cursor;
   now a contact is a single damped push of a few pixels, there is no rotation
   at any strength, and the lean is about a third of what it was. Hard cuts are
   covered by the page blinking — a dip in light rather than any movement.

Measured off the clips as they ship — movement per frame within the beats that
actually get played, times the playback rate, times the magnification the window
asks for — the picture went from sliding around 43% of the window's width every
second to around 11%. On screenshots of the running page, the number of hard
changes between samples fell by two thirds and the worst quarter of them halved.
`prefers-reduced-motion` drops the lean, the push and the blink entirely; she
still comes and goes.

The beats were re-chosen twice over: once on movement, and then again on what
they actually look like at this size, which is not the same question. Her cheek
is the steadiest thing in the take and reads as a rug; the closest, darkest
stretch is steadier still and reads as nothing at all. What survived is the four
seconds where she holds still and looks into the lens, which is now where the
page sits.

Nothing makes a sound until you have clicked once, because nothing is allowed
to; the purr is synthesised rather than lifted off the clips, and the corner
toggle turns it off for good.

It is plain static files with no build step at serve time, so any static host
works. The host does need to support HTTP range requests — `python3 -m
http.server` does not, and without them the browser cannot seek and the page
sits on the first frame:

```sh
npm run build       # regenerates docs/carbo.js from src/
npx serve docs      # or any range-capable static server
```

This repository is private, so there is no public deployment of the page; the
clip of the real Carbo it is built around stays in here.

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
