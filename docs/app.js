/**
 * Two things are going on here.
 *
 * The cat is a live instance of the library: her needs drift, her mood follows
 * from them, and the page's grading and readout are re-read off her every frame.
 *
 * The clip is a scrubber. The cursor's horizontal position is the playhead, so
 * moving left and right runs the footage backwards and forwards under your
 * hand. An earlier version matched the cursor to whichever frame had the tube
 * nearest that spot, which put her exactly where you pointed but jumped around
 * the timeline to do it — the picture flickered and it was unpleasant to look
 * at. Mapping to time instead keeps the footage continuous, so every movement
 * is a real camera movement, and the rate cap below stops a fast sweep from
 * turning into a blur.
 */
import { Carbo, thresholds } from './carbo.js';

/** One real second is six of her minutes, so a full day passes in four. */
const SIM_MINUTES_PER_REAL_SECOND = 6;
/** However long you were away, she skips at most twelve of her hours. */
const CATCH_UP_CAP = 720;
const STORAGE_KEY = 'carbo:v1';

/**
 * The most clip-seconds the playhead may cover in one real second. This is the
 * whole anti-flicker measure: a sweep across the window is 23 seconds of
 * footage, and without a cap it would arrive in one.
 */
const MAX_SCRUB_RATE = 2.4;
/** Speed she drifts at when nobody has touched the mouse yet. */
const IDLE_RATE = 0.3;
/** Don't bother the decoder for a seek smaller than this. */
const SEEK_EPSILON = 0.01;

/**
 * Per-mood presentation. `follow` is how eagerly the playhead chases the
 * cursor — an aloof cat that takes her time getting there says more than a
 * label does.
 */
const MOODS = {
  sleepy: { glow: '#5b7fb8', follow: 0.03, note: 'out cold' },
  hungry: { glow: '#d9772f', follow: 0.1, note: 'staring at the cupboard' },
  restless: { glow: '#c8434f', follow: 0.16, note: 'looking for trouble' },
  aloof: { glow: '#7b8592', follow: 0.05, note: 'keeping her distance' },
  affectionate: { glow: '#dd9dbd', follow: 0.14, note: 'velcro cat' },
  playful: { glow: '#49b08a', follow: 0.18, note: 'up for anything' },
  content: { glow: '#c9a227', follow: 0.09, note: 'perfectly fine' },
};

/** A stat is "alerting" once it has crossed the line the library cares about. */
const ALERTS = {
  hunger: (v) => v >= thresholds.hungry,
  boredom: (v) => v >= thresholds.bored,
  energy: (v) => v <= thresholds.exhausted,
  affection: (v) => v <= thresholds.aloof,
};

const root = document.documentElement;
const el = {
  body: document.body,
  video: document.getElementById('video'),
  bubble: document.getElementById('bubble'),
  mood: document.getElementById('mood'),
  meta: document.getElementById('meta'),
  log: document.getElementById('log'),
  hint: document.getElementById('hint'),
  ambient: document.getElementById('ambient'),
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

// -------------------------------------------------------------- the layout

/** Full window height, centred, aspect preserved — the page fills in behind. */
function relayout() {
  const height = window.innerHeight;
  const ratio = el.video.videoWidth / el.video.videoHeight || 464 / 848;
  const width = height * ratio;

  Object.assign(el.video.style, {
    width: `${width}px`,
    height: `${height}px`,
    left: `${(window.innerWidth - width) / 2}px`,
    top: '0px',
  });
}

window.addEventListener('resize', relayout);
el.video.addEventListener('loadedmetadata', relayout);
relayout();

/**
 * Repaint the background from the frame on screen.
 *
 * The canvas is 32x57, so the "blur" is mostly the browser scaling it up by a
 * factor of forty; the CSS blur only takes off the last of the blockiness. It
 * costs almost nothing per frame.
 */
const ambient = el.ambient.getContext('2d', { alpha: false });

function paintAmbient() {
  if (!ambient || el.video.readyState < 2) return;
  ambient.drawImage(el.video, 0, 0, el.ambient.width, el.ambient.height);
}

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
function say(interaction) {
  el.bubble.textContent = interaction.accepted
    ? interaction.response
    : interaction.reason;
  el.bubble.classList.toggle('refused', !interaction.accepted);
  el.bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => el.bubble.classList.remove('show'), 2800);
}

// -------------------------------------------------------------- interaction

function act(fn) {
  say(fn());
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
    case 'toggle-sleep':
      act(() => (cat.asleep ? cat.wake() : cat.sleep()));
      break;
  }
});

/** Anywhere on Carbo herself — which is the whole page — is a pet. */
document.addEventListener('click', (event) => {
  if (event.target.closest('.hud, .masthead')) return;
  ripple(event.clientX, event.clientY);
  act(() => cat.pet());
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
  paint();
});

// ------------------------------------------------------------- the playhead

/** Where along the clip the cursor is asking for, as a fraction. */
let wanted = null;
let shownTime = 0;

function aimAt(clientX) {
  wanted = Math.min(1, Math.max(0, clientX / window.innerWidth));
  el.hint.classList.add('gone');
}

document.addEventListener('pointermove', (event) => aimAt(event.clientX));
document.addEventListener('pointerdown', (event) => {
  aimAt(event.clientX);
  // Some mobile browsers won't paint a video frame until it has been allowed
  // to play once. Doing it here keeps it inside a user gesture.
  void el.video
    .play()
    .then(() => el.video.pause())
    .catch(() => {});
});

el.video.addEventListener('loadedmetadata', () => el.video.pause());

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

  const duration = el.video.duration;
  if (duration > 0) {
    let step;
    if (cat.asleep) {
      step = 0; // she is not following anything right now
    } else if (wanted === null) {
      step = IDLE_RATE * seconds; // drift gently until someone points
    } else {
      step = (wanted * duration - shownTime) * MOODS[cat.mood].follow;
    }

    // The cap is what keeps a fast sweep watchable instead of a strobe.
    const most = MAX_SCRUB_RATE * seconds;
    shownTime += Math.min(most, Math.max(-most, step));

    if (wanted === null && shownTime >= duration - 0.06) {
      shownTime = 0; // the idle drift loops
    } else {
      shownTime = Math.min(duration - 0.05, Math.max(0, shownTime));
    }

    if (!el.video.seeking && Math.abs(el.video.currentTime - shownTime) > SEEK_EPSILON) {
      el.video.currentTime = shownTime;
    }
  }

  paintAmbient();

  // The simulation runs every frame; the readout only needs ten updates a second.
  if (now - lastPainted > 100) {
    lastPainted = now;
    paint();
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else last = performance.now();
});

window.addEventListener('pagehide', save);
setInterval(save, 10_000);

paint();
requestAnimationFrame(frame);
