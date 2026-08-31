/**
 * Three things are going on here.
 *
 * The cat is a live instance of the library: her needs drift, her mood follows
 * from them, and the page's grading and readout are re-read off her every frame.
 *
 * The picture is not a scrubber any more. An earlier version made the cursor's
 * horizontal position the playhead, which meant every movement of your hand
 * dragged the footage back and forth: her movements came out mechanical, the
 * clip was visibly a clip, and you were watching a video of a cat rather than
 * being visited by one. Now the footage plays at its own speed in *beats* —
 * short marked stretches of the clip, each one a thing she does — and your hand
 * only decides which beat is next. Real motion at a real speed is most of what
 * makes her feel present.
 *
 * The frame is the third thing. Both clips are blown up and anchored so the
 * hole she is looking into is wider than the window (see layout), so she has
 * the whole page rather than a round frame in the middle of it, and the page
 * behaves like the inside of the tube: it leans a little when you move, it takes
 * one push when she lands on it, and it goes warm and dark when she blocks the
 * light. All of that is kept small on purpose — the footage is handheld and
 * blown up several times, so the picture is already in motion before the page
 * adds any of its own.
 */
import { Carbo, thresholds } from './carbo.js';

/** One real second is six of her minutes, so a full day passes in four. */
const SIM_MINUTES_PER_REAL_SECOND = 6;
/** However long you were away, she skips at most twelve of her hours. */
const CATCH_UP_CAP = 720;
const STORAGE_KEY = 'carbo:v1';
const SOUND_KEY = 'carbo:sound';

/**
 * The clips, and where the hole sits in each one.
 *
 * `anchor` is the point of the footage pinned to the middle of the window, and
 * `fill` is how much wider than the window the hole is asked to be. Both clips
 * are shipped stabilised and cropped in (see the README), which both steadies
 * the hole and makes it wider than the frame it sits in, so `fill` no longer
 * has to ask for extra magnification to keep the tube's white wall out of the
 * page — on any landscape window `cover` in layout() is what governs, which is
 * the least magnification the window can be filled with, and the least
 * magnification is the least movement.
 */
const CLIPS = {
  her: { id: 'her', w: 480, h: 848, anchor: [0.5, 0.36], fill: 0.92 },
  paw: { id: 'paw', w: 464, h: 848, anchor: [0.5, 0.44], fill: 0.95 },
};

/**
 * Past this, magnifying a 480-wide clip stops buying anything but mush — but
 * never at the cost of leaving the window: covering it always wins (see layout).
 */
const MAX_MAGNIFY = 4.2;

/**
 * The beats. Every one is a stretch of footage where she does a single legible
 * thing, cut on the frames either side of it so nothing plays through a jump.
 *
 * They are also cut for stillness, which is most of what stops the page being
 * unpleasant to sit in front of. The clip is handheld inside a paper tube and
 * blown up two to three times on screen, which multiplies every wobble in it by
 * the same amount, so the windows below were chosen by measuring the frame to
 * frame movement across the (already stabilised) clip and taking the calmest
 * stretches that also end close to where they began — the second part being
 * what lets a beat repeat without the repeat showing. The stretches around 5s,
 * 10s and 15s move two to three times as much as these and are never used.
 *
 * `contact` marks the ones where she reaches the lens — the only ones allowed
 * to move the page — and the number is how hard.
 */
const BEATS = {
  /** Straight down the tube at you, from a polite distance. */
  watch: { clip: 'her', in: 2.72, out: 4.18 },
  /** Ear and cheek: she is interested in the tube, not in you. */
  sniff: { clip: 'her', in: 7.34, out: 9.31 },
  /** Coming closer. Always played into a contact. */
  lean: { clip: 'her', in: 11.07, out: 12.55 },
  /**
   * Her face against the hole until it blocks the light. Cut the moment it is
   * dark: at full window, a second of that is a touch and two is a page that
   * looks like it has failed to load.
   */
  press: { clip: 'her', in: 12.6, out: 13.3, contact: 0.8, rate: 0.92 },
  /** Looking off at the room. The one beat where you are not the subject. */
  away: { clip: 'her', in: 17.32, out: 18.24 },
  /** All face, filling the hole, nose first. */
  nuzzle: { clip: 'her', in: 18.45, out: 20.38, contact: 1, rate: 0.92 },
  /**
   * The tail of the same stretch, without the arrival: her face resting over the
   * hole with the light shut out behind it. It is the steadiest footage in the
   * clip by a factor of two, but at full window it is also very dark and hard to
   * read as a cat, so it is only where she is dozing rather than a beat the page
   * sits in generally.
   */
  close: { clip: 'her', in: 19.09, out: 20.38 },
  /** Settled back down, still watching. */
  settle: { clip: 'her', in: 21.74, out: 23.03 },
  /**
   * A paw over the lens, twice, from the second clip.
   *
   * Both are kept to under a second. Fur pressed against a lens is a brown
   * blur, and a brown blur is a touch for half a second and a wallpaper for
   * two — so the impact plays and she is pulled straight back off you.
   */
  pawA: { clip: 'paw', in: 0.06, out: 0.88, contact: 1.1, rate: 0.85 },
  pawB: { clip: 'paw', in: 1.72, out: 2.54, contact: 1, rate: 0.85 },
};

/**
 * What she cycles through when nothing is happening, in the order the footage
 * runs. Each one repeats a couple of times before the next, because a repeat of
 * a beat cut to loop is nearly invisible and a cut to another one is not.
 */
const IDLE_ORDER = ['watch', 'sniff', 'away', 'close', 'settle'];

/**
 * Which of those a mood will sit through. `away` is the busiest of them — she
 * turns her head through most of it — so only the moods it says something about
 * are given it.
 */
const IDLE_BY_MOOD = {
  sleepy: ['close', 'settle'],
  hungry: ['watch', 'settle'],
  restless: ['watch', 'sniff', 'away'],
  aloof: ['away', 'sniff'],
  affectionate: ['watch', 'settle'],
  playful: ['watch', 'sniff'],
  content: ['watch', 'settle'],
};

/**
 * Contact beats, and how likely each mood is to spend one on you. Drawn from a
 * list rather than weighted, and the face beats appear twice in most of them:
 * a paw over the lens lands harder, but you came here to see the cat.
 */
const CONTACTS = {
  sleepy: ['press', 'nuzzle'],
  hungry: ['nuzzle', 'nuzzle', 'press'],
  restless: ['pawA', 'pawB', 'press', 'nuzzle'],
  aloof: ['press', 'sniff'],
  affectionate: ['nuzzle', 'nuzzle', 'press', 'pawB'],
  playful: ['pawA', 'pawB', 'nuzzle', 'nuzzle'],
  content: ['nuzzle', 'nuzzle', 'press', 'pawA'],
};

/**
 * Per-mood presentation. `lean` is how eagerly the page leans with your cursor,
 * `wait` is how long you have to hold still before she comes over — an aloof cat
 * that makes you wait says more than a label does — and `rate` is how fast the
 * footage runs.
 *
 * Everything runs under real speed. Her own movements are small and quick and
 * the picture is magnified, so at 1× the screen slides about far more than
 * anything you would sit in front of comfortably; a shade under three quarters
 * reads as a cat taking her time rather than as slow motion.
 */
const MOODS = {
  sleepy: {
    glow: '#5b7fb8',
    lean: 0.012,
    wait: Infinity,
    rate: 0.55,
    note: 'out cold',
  },
  hungry: {
    glow: '#d9772f',
    lean: 0.05,
    wait: 3400,
    rate: 0.74,
    note: 'staring at the cupboard',
  },
  restless: {
    glow: '#c8434f',
    lean: 0.07,
    wait: 4200,
    rate: 0.8,
    note: 'looking for trouble',
  },
  aloof: {
    glow: '#7b8592',
    lean: 0.025,
    wait: 7000,
    rate: 0.66,
    note: 'keeping her distance',
  },
  affectionate: {
    glow: '#dd9dbd',
    lean: 0.06,
    wait: 2400,
    rate: 0.72,
    note: 'velcro cat',
  },
  playful: {
    glow: '#49b08a',
    lean: 0.08,
    wait: 3000,
    rate: 0.8,
    note: 'up for anything',
  },
  content: {
    glow: '#c9a227',
    lean: 0.045,
    wait: 3600,
    rate: 0.72,
    note: 'perfectly fine',
  },
};

/** A stat is "alerting" once it has crossed the line the library cares about. */
const ALERTS = {
  hunger: (v) => v >= thresholds.hungry,
  boredom: (v) => v >= thresholds.bored,
  energy: (v) => v <= thresholds.exhausted,
  affection: (v) => v <= thresholds.aloof,
};

/**
 * She will not walk over twice inside this, however still you hold. Long,
 * because a contact is the one thing on the page that moves it, and one every
 * few seconds is what turns being visited into being shaken.
 */
const CONTACT_COOLDOWN = 11000;
/** Waving your hand about is what startles her out of an approach. */
const STARTLE_SPEED = 2.6;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const root = document.documentElement;
const el = {
  body: document.body,
  her: document.getElementById('her'),
  paw: document.getElementById('paw'),
  warmth: document.getElementById('warmth'),
  blink: document.getElementById('blink'),
  bubble: document.getElementById('bubble'),
  mood: document.getElementById('mood'),
  chipMood: document.getElementById('chipMood'),
  meta: document.getElementById('meta'),
  log: document.getElementById('log'),
  hint: document.getElementById('hint'),
  hud: document.getElementById('hud'),
  panelBtn: document.getElementById('panelBtn'),
  soundBtn: document.getElementById('soundBtn'),
  sleepBtn: document.getElementById('sleepBtn'),
  reset: document.getElementById('reset'),
  actions: document.querySelector('.actions'),
  bars: new Map(
    [...document.querySelectorAll('.stat')].map((node) => [
      node.dataset.key,
      { node, fill: node.querySelector('i') },
    ]),
  ),
};

CLIPS.her.el = el.her;
CLIPS.paw.el = el.paw;

// -------------------------------------------------------------- the layout

/**
 * Blow each clip up until the hole she is looking into is wider than the
 * window, then hang it off its anchor point so the middle of the hole is in the
 * middle of the page.
 *
 * The hole is about as wide as the footage, so filling the window means scaling
 * by its longer side, which on a phone held upright is a lot: capped, because
 * past that the picture is only bigger, not better.
 */
function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const longest = Math.max(vw, vh);

  for (const clip of Object.values(CLIPS)) {
    // Cover first, then fill the hole if the cap allows: an ultrawide window
    // asks for more magnification than the footage can really give, and a soft
    // picture is still better than a black band down each side of her. The few
    // percent over is the room the lean needs to move in without pulling an
    // edge into the window.
    const cover = Math.max(vw / clip.w, vh / clip.h) * 1.03;
    const wanted = (longest * clip.fill) / clip.w;
    const scale = Math.max(cover, Math.min(MAX_MAGNIFY, wanted));
    const w = clip.w * scale;
    const h = clip.h * scale;
    Object.assign(clip.el.style, {
      width: `${w}px`,
      height: `${h}px`,
      left: `${vw / 2 - clip.anchor[0] * w}px`,
      top: `${vh / 2 - clip.anchor[1] * h}px`,
    });
  }
}

window.addEventListener('resize', layout);
layout();

// ------------------------------------------------------------- persistence

let cat = load();
wire(cat);

function load() {
  let saved;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    return new Carbo(); // private browsing, storage disabled — not worth a fuss
  }
  if (!saved) return new Carbo();

  try {
    const { state, savedAt } = JSON.parse(saved);
    const restored = Carbo.from(state);
    const away = ((Date.now() - savedAt) / 1000) * SIM_MINUTES_PER_REAL_SECOND;
    if (away > 0) restored.tick(Math.min(away, CATCH_UP_CAP));
    return restored;
  } catch {
    return new Carbo();
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: cat.toJSON(), savedAt: Date.now() }),
    );
  } catch {
    /* nothing worth breaking the page over */
  }
}

// ------------------------------------------------------------------ events

function wire(instance) {
  instance.on('hungry', () => note('She has started yowling at the cupboard.'));
  instance.on('bored', () => note('Something is about to get knocked off a shelf.'));
  instance.on('sleep', () => note('She has gone to sleep.'));
  instance.on('wake', () => note('She is up again.'));
  instance.on('mood', ({ from, to }) => note(`${from} → ${to}`));
}

let noteTimer;
function note(text) {
  el.log.textContent = text;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    el.log.textContent = '';
  }, 6000);
}

let bubbleTimer;
function say(text, refused = false) {
  el.bubble.textContent = text;
  el.bubble.classList.toggle('refused', refused);
  el.bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => el.bubble.classList.remove('show'), 3200);
}

function sayInteraction(interaction) {
  say(
    interaction.accepted ? interaction.response : interaction.reason,
    !interaction.accepted,
  );
}

// --------------------------------------------------------------- the beats

const state = {
  beat: null,
  /** What to play when the current beat runs out: a name, or a function. */
  then: null,
  /** Cursor, smoothed, in -1..1 either way. */
  aim: { x: 0, y: 0 },
  want: { x: 0, y: 0 },
  /** Screen widths of cursor travel per second, smoothed. */
  speed: 0,
  /** How long the cursor has been parked, in ms. */
  still: 0,
  approaching: false,
  contactAt: -Infinity,
  startledAt: -Infinity,
  bump: 0,
  bumpAngle: 0,
  push: 1,
  stray: 0,
  repeats: 0,
  blocked: false,
  sound: false,
  petted: false,
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * What she does when nothing in particular is going on.
 *
 * The same beat repeats a couple of times before moving on. Its ends were cut
 * to match, so a repeat barely registers, while a move to another beat is a
 * real cut — which is why those are counted and kept rare, and blinked over.
 */
function idleBeat() {
  if (cat.asleep) return 'settle';
  const allowed = IDLE_BY_MOOD[cat.mood] ?? IDLE_BY_MOOD.content;

  if (state.repeats > 0 && allowed.includes(state.beat)) {
    state.repeats -= 1;
    return state.beat;
  }

  state.repeats = 1 + (Math.random() < 0.45 ? 1 : 0);
  // Chronological, so a cut is usually a small step forward through the take
  // rather than a jump to a different part of it.
  const from = IDLE_ORDER.indexOf(state.beat);
  for (let step = 1; step <= IDLE_ORDER.length; step += 1) {
    const candidate = IDLE_ORDER[(from + step + IDLE_ORDER.length) % IDLE_ORDER.length];
    if (allowed.includes(candidate)) return candidate;
  }
  return allowed[0];
}

/**
 * Put a beat on screen. Seeking is cheap — the clips are cut with a keyframe
 * every half second — but it is never done mid-beat, so the footage only ever
 * runs forwards at its own speed.
 */
function cue(name, then = null) {
  const beat = BEATS[name];
  if (!beat) return;
  const from = BEATS[state.beat];
  state.beat = name;
  state.then = then;

  const clip = CLIPS[beat.clip];
  const other = clip === CLIPS.her ? CLIPS.paw : CLIPS.her;
  el.paw.classList.toggle('on', beat.clip === 'paw');

  const mood = cat.asleep ? 0.6 : MOODS[cat.mood].rate;
  clip.el.playbackRate = Math.min(1, mood * (beat.rate ?? 1));
  if (Math.abs(clip.el.currentTime - beat.in) > 0.04) clip.el.currentTime = beat.in;
  start(clip.el);
  other.el.pause();

  // Blink over a real jump only. A repeat of the same beat has nothing to hide,
  // and neither has a step to the next stretch of the same take a second later;
  // but a cut between two faces at arm's length reads as a jolt, and covering
  // it costs a flicker of light rather than any movement.
  if (from && from !== beat) {
    const sameClip = from.clip === beat.clip;
    if (!sameClip || Math.abs(beat.in - from.out) > 1.2) blink();
  }
}

/** A dip over a cut. Light, not movement: nothing here is allowed to slide. */
function blink() {
  if (reduceMotion) return;
  el.blink.classList.remove('shut');
  void el.blink.offsetWidth;
  el.blink.classList.add('shut');
}

function start(video) {
  const attempt = video.play();
  if (attempt?.catch) {
    attempt.catch(() => {
      // Autoplay refused: nothing is going to move until she is touched.
      state.blocked = true;
      el.hint.textContent = 'Tap to wake her.';
      el.hint.classList.remove('gone');
    });
  }
}

/** The current beat has run out. */
function nextBeat() {
  const then = state.then;
  state.then = null;
  if (typeof then === 'function') then();
  else if (then) cue(then);
  else cue(idleBeat());
}

// ------------------------------------------------------------- being touched

/**
 * She reaches the lens: the picture cuts to whichever contact beat suits her
 * mood, the room takes one push, the light goes warm where she landed, and she
 * purrs if you have let the page make a sound.
 */
function contact({ x, y, beat, mood = cat.mood } = {}) {
  const name = beat ?? pick(CONTACTS[mood] ?? CONTACTS.content);
  const force = BEATS[name].contact ?? 0.6;

  state.contactAt = performance.now();
  state.approaching = false;
  // Always pulled back onto her face afterwards: being touched and then finding
  // her looking at you is the shape of it. idleBeat() can offer her looking away.
  cue(name, () => cue(cat.asleep ? 'press' : pick(['settle', 'watch'])));

  const acrossX = (x ?? window.innerWidth / 2) / window.innerWidth;
  const acrossY = (y ?? window.innerHeight * 0.46) / window.innerHeight;
  root.style.setProperty('--touch-x', `${(acrossX * 100).toFixed(1)}%`);
  root.style.setProperty('--touch-y', `${(acrossY * 100).toFixed(1)}%`);
  el.warmth.classList.remove('flash');
  void el.warmth.offsetWidth; // restart the animation rather than queue it
  el.warmth.classList.add('flash');

  // One push, damped, in one direction — never an oscillation. A screen that
  // shakes back and forth is what makes a page like this unpleasant to sit in
  // front of, and none of the feeling of being touched lives in the second
  // wobble anyway; it is in the cut, the warmth and the sound.
  if (!reduceMotion) {
    state.bump = Math.max(state.bump, force);
    state.bumpAngle = Math.random() * Math.PI * 2;
  }
  thump(force);
  purr(force);
}

/** She has decided to come over, which takes her a couple of seconds. */
function approach() {
  state.approaching = true;
  cue('lean', () => {
    const interaction = cat.pet();
    if (interaction.accepted) {
      contact({});
      note('She came over on her own.');
    } else {
      // Changed her mind on the way in, which is very much a cat.
      state.approaching = false;
      state.contactAt = performance.now();
      cue('away', () => cue(idleBeat()));
      say(interaction.reason, true);
    }
    save();
  });
}

/** Waving your hand at a kitten does not bring it closer. */
function startle() {
  if (!state.approaching) return;
  state.approaching = false;
  state.startledAt = performance.now();
  state.contactAt = performance.now() - CONTACT_COOLDOWN / 2;
  cue('away', () => cue(idleBeat()));
}

// -------------------------------------------------------------- interaction

function act(fn) {
  const interaction = fn();
  sayInteraction(interaction);
  if (interaction.accepted) contact({});
  else cue('away', () => cue(idleBeat()));
  save();
  paint();
}

el.actions.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  switch (button.dataset.action) {
    case 'feed':
      act(() => cat.feed(button.dataset.food));
      break;
    case 'play':
      act(() => cat.play(15));
      break;
    case 'pet':
      act(() => cat.pet());
      break;
    case 'toggle-sleep': {
      const interaction = cat.asleep ? cat.wake() : cat.sleep();
      sayInteraction(interaction);
      cue(idleBeat());
      save();
      paint();
      break;
    }
  }
});

el.panelBtn.addEventListener('click', () => {
  const open = el.body.dataset.panel !== 'open';
  el.body.dataset.panel = open ? 'open' : 'shut';
  el.panelBtn.setAttribute('aria-expanded', String(open));
  el.hud.inert = !open;
});
el.hud.inert = true;

el.soundBtn.addEventListener('click', () => setSound(!state.sound));

/** Anywhere on Carbo herself — which is the whole page — is a pet. */
document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.hud, .masthead, .controls')) return;
  aimAt(event.clientX, event.clientY);
  wakeAudio();

  if (state.blocked) {
    // The first touch is also the gesture that lets the footage play at all.
    state.blocked = false;
    el.hint.textContent = 'Hold still. She comes closer.';
    cue(state.beat ?? 'watch');
  }

  ripple(event.clientX, event.clientY);
  const interaction = cat.pet();
  sayInteraction(interaction);
  if (interaction.accepted) contact({ x: event.clientX, y: event.clientY });
  else cue('away', () => cue(idleBeat()));

  state.petted = true;
  el.hint.classList.add('gone');
  save();
  paint();
});

function ripple(x, y) {
  const mark = document.createElement('span');
  mark.className = 'ripple';
  mark.style.left = `${x}px`;
  mark.style.top = `${y}px`;
  document.body.append(mark);
  mark.addEventListener('animationend', () => mark.remove());
}

el.reset.addEventListener('click', () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see save() */
  }
  cat = new Carbo();
  wire(cat);
  note('Back to a twelve-week kitten.');
  cue(idleBeat());
  paint();
});

// ------------------------------------------------------------- your cursor

let lastPointer = null;

function aimAt(clientX, clientY, at = performance.now()) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  state.want.x = (clientX / vw) * 2 - 1;
  state.want.y = (clientY / vh) * 2 - 1;

  if (lastPointer) {
    const seconds = Math.max(0.008, (at - lastPointer.at) / 1000);
    const travelled = Math.hypot(
      (clientX - lastPointer.x) / vw,
      (clientY - lastPointer.y) / vh,
    );
    state.speed = state.speed * 0.7 + (travelled / seconds) * 0.3;
    if (travelled > 0.004) state.still = 0;
  }
  lastPointer = { x: clientX, y: clientY, at };
}

document.addEventListener('pointermove', (event) =>
  aimAt(event.clientX, event.clientY),
);

// -------------------------------------------------------------------- sound

/**
 * A purr, synthesised: filtered noise with its volume run up and down at about
 * 26Hz, which is roughly where a cat idles. Nothing can play until you have
 * touched the page once, so the first purr you hear is always an answer to
 * something you did.
 */
let audio = null;

function setSound(on) {
  state.sound = on;
  el.soundBtn.setAttribute('aria-pressed', String(on));
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* see save() */
  }
  if (on) wakeAudio();
}

try {
  setSound(localStorage.getItem(SOUND_KEY) !== 'off');
} catch {
  setSound(true);
}

function wakeAudio() {
  if (!state.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    state.sound = false;
  }
}

function purr(force = 1, seconds = 2.6) {
  if (!audio || !state.sound || audio.state !== 'running') return;
  const now = audio.currentTime;
  const length = Math.ceil(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < length; i += 1) {
    brown = (brown + 0.035 * (Math.random() * 2 - 1)) / 1.035;
    data[i] = brown * 3;
  }

  const source = audio.createBufferSource();
  source.buffer = buffer;

  const body = audio.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = 260;
  body.Q.value = 0.8;

  const tremolo = audio.createGain();
  tremolo.gain.value = 0.45;
  const rate = audio.createOscillator();
  rate.frequency.value = 26;
  const depth = audio.createGain();
  depth.gain.value = 0.45;
  rate.connect(depth).connect(tremolo.gain);

  const envelope = audio.createGain();
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(0.5 * force, now + 0.3);
  envelope.gain.setTargetAtTime(0, now + seconds * 0.5, 0.5);

  source.connect(body).connect(tremolo).connect(envelope).connect(audio.destination);
  rate.start(now);
  source.start(now);
  source.stop(now + seconds);
  rate.stop(now + seconds);
}

/** The soft knock of a head or a paw arriving on the other side of the hole. */
function thump(force = 1) {
  if (!audio || !state.sound || audio.state !== 'running') return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(52, now + 0.16);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.32 * force, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.26);
}

// ------------------------------------------------------------------- render

let lastMood = null;
let lastPainted = 0;

function paint() {
  const mood = cat.mood;
  const look = MOODS[mood];

  if (mood !== lastMood) {
    lastMood = mood;
    el.body.dataset.mood = mood;
    root.style.setProperty('--glow', look.glow);
    el.mood.textContent = mood;
    el.chipMood.textContent = mood;
  }

  el.body.dataset.asleep = String(cat.asleep);
  el.sleepBtn.textContent = cat.asleep ? 'wake her' : 'nap';

  const stats = cat.stats;
  for (const [key, parts] of el.bars) {
    const value = stats[key];
    parts.fill.style.width = `${value}%`;
    parts.node.dataset.alert = String(ALERTS[key](value));
  }

  el.meta.textContent = [
    cat.lifeStage,
    `${cat.ageInDays.toFixed(1)} days`,
    cat.asleep ? 'asleep' : look.note,
  ].join(' · ');
}

/**
 * Tint the tube with the colour of what is on screen. Eight by eight pixels,
 * a few times a second: the rim of a paper tube is lit by whatever is coming
 * through the hole, and a rim in the wrong colour is how you notice it is a
 * gradient drawn over a video.
 */
const swatch = document.createElement('canvas');
swatch.width = 8;
swatch.height = 8;
const swatchCtx = swatch.getContext('2d', { alpha: false, willReadFrequently: true });
let sampledAt = 0;
/* Eased in JS rather than by a CSS transition: the sample lands several times a
   second, and a transition that keeps getting restarted never arrives. */
const warmth = { r: 46, g: 34, b: 27 };

function sampleWarmth(now) {
  if (!swatchCtx || now - sampledAt < 180) return;
  sampledAt = now;
  const video = el.paw.classList.contains('on') ? el.paw : el.her;
  if (video.readyState < 2) return;
  try {
    swatchCtx.drawImage(video, 0, 0, swatch.width, swatch.height);
    const { data } = swatchCtx.getImageData(0, 0, swatch.width, swatch.height);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const pixels = data.length / 4;
    warmth.r += ((r / pixels) * 0.42 - warmth.r) * 0.14;
    warmth.g += ((g / pixels) * 0.36 - warmth.g) * 0.14;
    warmth.b += ((b / pixels) * 0.3 - warmth.b) * 0.14;
    root.style.setProperty(
      '--room-warm',
      `${Math.round(warmth.r)}, ${Math.round(warmth.g)}, ${Math.round(warmth.b)}`,
    );
  } catch {
    sampledAt = Infinity; // tainted canvas (file://), so stop asking
  }
}

// --------------------------------------------------------------- the clock

let last = performance.now();

function frame(now) {
  // A rAF timestamp is the frame's start time, which can predate a
  // performance.now() taken moments earlier — hence the floor at zero. A large
  // gap means the tab was throttled, not that centuries passed.
  const elapsed = Math.min(Math.max(now - last, 0), 1000);
  last = now;
  const seconds = elapsed / 1000;

  cat.tick(seconds * SIM_MINUTES_PER_REAL_SECOND);

  // ---- the footage
  const beat = BEATS[state.beat];
  if (beat) {
    const video = CLIPS[beat.clip].el;
    const at = video.currentTime;
    if (at >= beat.out || video.ended) {
      nextBeat();
    } else if (at < beat.in - 0.35) {
      // The seek never landed, which on a slow connection means the frames for
      // that beat had not arrived yet. Ask again rather than play whatever is
      // buffered: playing the wrong beat is how the cuts stop meaning anything.
      state.stray += elapsed;
      if (state.stray > 320) {
        state.stray = 0;
        video.currentTime = beat.in;
      }
    } else {
      state.stray = 0;
    }
  }

  // ---- your hand
  state.still += elapsed;
  state.speed *= Math.pow(0.2, seconds); // forget a flick within a moment
  if (state.speed > STARTLE_SPEED) startle();

  const lean = MOODS[cat.mood].lean;
  state.aim.x += (state.want.x - state.aim.x) * Math.min(1, lean * elapsed * 0.06);
  state.aim.y += (state.want.y - state.aim.y) * Math.min(1, lean * elapsed * 0.06);

  // ---- does she come over
  const idle = !state.approaching && state.beat && !BEATS[state.beat].contact;
  if (
    idle &&
    !cat.asleep &&
    !state.blocked &&
    el.body.dataset.phase === 'live' &&
    state.still > MOODS[cat.mood].wait &&
    now - state.contactAt > CONTACT_COOLDOWN &&
    now - state.startledAt > 2600
  ) {
    approach();
  }

  // ---- the room
  if (state.bump > 0.0008) {
    // A single half-swing that decays: out and back, once.
    state.bump *= Math.pow(0.02, seconds);
    const reach = 4.5 * state.bump;
    const x = Math.cos(state.bumpAngle) * reach;
    const y = Math.sin(state.bumpAngle) * reach;
    root.style.setProperty('--bump-x', `${x.toFixed(2)}px`);
    root.style.setProperty('--bump-y', `${y.toFixed(2)}px`);
  } else if (state.bump) {
    state.bump = 0;
    root.style.setProperty('--bump-x', '0px');
    root.style.setProperty('--bump-y', '0px');
  }

  if (!reduceMotion) {
    // A hint of lean, not a parallax rig. At the old amplitude the whole
    // picture slid a quarter of an inch every time the mouse twitched, on top
    // of footage that is already moving.
    const amount = Math.min(window.innerWidth, window.innerHeight) * 0.011;
    root.style.setProperty('--pan-x', `${(-state.aim.x * amount).toFixed(2)}px`);
    root.style.setProperty('--pan-y', `${(-state.aim.y * amount * 0.6).toFixed(2)}px`);
    // Being touched pushes the room a little further into your face.
    const target = 1 + (beat?.contact ? 0.018 : 0) + state.bump * 0.008;
    state.push += (target - state.push) * Math.min(1, seconds * 2.2);
    root.style.setProperty('--push', state.push.toFixed(4));
  }

  sampleWarmth(now);

  // The simulation runs every frame; the readout only needs ten updates a second.
  if (now - lastPainted > 100) {
    lastPainted = now;
    paint();
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    el.her.pause();
    el.paw.pause();
  } else {
    last = performance.now();
    if (!state.blocked && state.beat) cue(state.beat, state.then);
  }
});

window.addEventListener('pagehide', save);
setInterval(save, 10_000);

// ----------------------------------------------------------- the way in

/**
 * What the page opens with, because a still frame of a cat and a paragraph
 * about a library is not what being visited by one feels like: the window is
 * shut, it opens from the middle onto her already looking at you, and within a
 * couple of seconds she has leaned in and put her face over the hole.
 */
async function open() {
  await ready(el.her);
  layout();
  cue('watch');
  el.body.dataset.phase = 'arriving';

  await wait(reduceMotion ? 900 : 1900);
  if (cat.asleep) {
    cue('settle');
    say('She is asleep in the tube. You are welcome to wait.', true);
  } else {
    // Deliberately a beat off the second clip: it is 300KB and its first beat
    // starts at the head of the file, so the one contact whose timing the page
    // has promised does not depend on 12 seconds of the long clip having
    // arrived. Everything after this happens seconds later, by which time it has.
    contact({ beat: 'pawA' });
    say('A paw comes over the hole, and rests there.');
  }

  await wait(2600);
  el.body.dataset.phase = 'live';
}

function ready(video) {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    video.addEventListener('loadeddata', done, { once: true });
    video.addEventListener('error', done, { once: true });
    setTimeout(done, 4000); // never hold the page shut on a slow network
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

paint();
requestAnimationFrame(frame);
void open();
