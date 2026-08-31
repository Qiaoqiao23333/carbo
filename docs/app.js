/**
 * The homepage is a live instance of the library, not a mock-up of one.
 * The mood, the bars, how the video is graded and how fast it plays are all
 * read straight off a `Carbo` and re-read every frame.
 */
import { Carbo, thresholds } from './carbo.js';

/** One real second is six of her minutes, so a full day passes in four. */
const SIM_MINUTES_PER_REAL_SECOND = 6;
/** However long you were away, she skips at most twelve of her hours. */
const CATCH_UP_CAP = 720;
const STORAGE_KEY = 'carbo:v1';
/** How quickly the tube catches up to the cursor. 1 would be instant. */
const FOLLOW = 0.16;

/**
 * Per-mood presentation. `rate` is the video's playback speed and `hole` scales
 * the tube: a sleepy cat drifting at 0.55× behind a narrowed opening carries
 * the state better than any label does. Keep the `hole` range tight — the tube
 * resizing under the cursor should be felt, not noticed.
 */
const MOODS = {
  sleepy: { glow: '#5b7fb8', rate: 0.55, hole: 0.82, note: 'out cold' },
  hungry: { glow: '#d9772f', rate: 1.0, hole: 1.06, note: 'staring at the cupboard' },
  restless: { glow: '#c8434f', rate: 1.5, hole: 1.1, note: 'looking for trouble' },
  aloof: { glow: '#7b8592', rate: 0.8, hole: 0.9, note: 'keeping her distance' },
  affectionate: { glow: '#dd9dbd', rate: 0.85, hole: 1.14, note: 'velcro cat' },
  playful: { glow: '#49b08a', rate: 1.35, hole: 1.12, note: 'up for anything' },
  content: { glow: '#c9a227', rate: 0.95, hole: 1, note: 'perfectly fine' },
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
  hud: document.getElementById('hud'),
  sound: document.getElementById('sound'),
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

let cat = load();
wire(cat);

// ------------------------------------------------------------- persistence

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
  // The first click also satisfies autoplay policies, if they bit earlier.
  void el.video.play().catch(() => {});
});

function ripple(x, y) {
  const mark = document.createElement('span');
  mark.className = 'ripple';
  mark.style.left = `${x}px`;
  mark.style.top = `${y}px`;
  document.body.append(mark);
  mark.addEventListener('animationend', () => mark.remove());
}

el.sound.addEventListener('click', () => {
  const turningOn = el.video.muted;
  el.video.muted = !turningOn;
  el.sound.setAttribute('aria-pressed', String(turningOn));
  el.sound.innerHTML = turningOn
    ? '<span aria-hidden="true">🔊</span> sound'
    : '<span aria-hidden="true">🔈</span> sound';
});

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

// ------------------------------------------------------- the tube's position

const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const tube = { ...pointer };
let moved = false;

function aimAt(x, y) {
  pointer.x = x;
  pointer.y = y;
  if (!moved) {
    moved = true;
    el.hint.classList.add('gone');
  }
}

document.addEventListener('pointermove', (event) => aimAt(event.clientX, event.clientY));
document.addEventListener('pointerdown', (event) => aimAt(event.clientX, event.clientY));
window.addEventListener('resize', () => {
  // Keep it in frame if the window shrinks under it.
  pointer.x = Math.min(pointer.x, window.innerWidth);
  pointer.y = Math.min(pointer.y, window.innerHeight);
});

/**
 * Rendered width of the clip, before the mood widens or narrows it. The tube's
 * opening is about 87% of the frame's width, so this lands the opening itself
 * at roughly a quarter of the shorter viewport edge.
 */
function baseWidth() {
  const shorter = Math.min(window.innerWidth, window.innerHeight);
  return shorter * (window.innerWidth < 880 ? 0.46 : 0.3);
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
    el.video.playbackRate = look.rate;
  }

  root.style.setProperty('--vw', `${baseWidth() * look.hole}px`);
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

  // Pausing rather than just slowing it down is what sells "she is asleep".
  if (cat.asleep) el.video.pause();
  else void el.video.play().catch(() => {});
}

// --------------------------------------------------------------- the clock

let last = performance.now();

function frame(now) {
  // A rAF timestamp is the frame's start time, which can predate a
  // performance.now() taken moments earlier — hence the floor at zero. A large
  // gap means the tab was throttled, not that centuries passed.
  const elapsed = Math.min(Math.max(now - last, 0), 1000);
  last = now;

  cat.tick((elapsed / 1000) * SIM_MINUTES_PER_REAL_SECOND);

  // Ease towards the cursor rather than snapping: a tube this heavy should
  // have some weight to it.
  tube.x += (pointer.x - tube.x) * FOLLOW;
  tube.y += (pointer.y - tube.y) * FOLLOW;
  root.style.setProperty('--x', `${tube.x.toFixed(1)}px`);
  root.style.setProperty('--y', `${tube.y.toFixed(1)}px`);

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
