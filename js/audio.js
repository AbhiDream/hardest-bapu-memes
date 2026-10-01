// One-at-a-time sound desk.
// Browser autoplay only allows play() inside a real user-gesture handler
// (click / wheel / key / touch) — never from rAF / GSAP ticker.
// If a clip is already playing, do nothing. Never queue.

const FILES = {
  1: "assets/1.mp3",
  2: "assets/2.mp3",
  3: "assets/3.mp3",
};

const pool = {
  1: new Audio(FILES[1]),
  2: new Audio(FILES[2]),
  3: new Audio(FILES[3]),
};
for (const a of Object.values(pool)) {
  a.preload = "auto";
  a.playsInline = true;
  a.volume = 1;
  a.load();
}

let muted = false;
let unlocked = false;
let busy = false;
let current = null;

function finish() {
  busy = false;
  current = null;
}

function isBusy() {
  return busy || (current && !current.paused && !current.ended);
}

/** Must be called from a user-gesture event handler. */
function play(id) {
  if (muted || isBusy()) return false;
  const clip = pool[id];
  if (!clip) return false;

  try {
    clip.pause();
    clip.currentTime = 0;
  } catch {
    /* ignore seek-before-ready */
  }

  busy = true;
  current = clip;
  clip.onended = finish;
  clip.onerror = finish;

  const p = clip.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      unlocked = true;
    }).catch(() => {
      finish();
    });
  } else {
    unlocked = true;
  }
  return true;
}

export function playOne() {
  return play(1);
}

export function playAny() {
  return play(1 + Math.floor(Math.random() * 3));
}

export function isMuted() {
  return muted;
}

export function isUnlocked() {
  return unlocked;
}

export function setMuted(next) {
  muted = !!next;
  if (muted && current) {
    try {
      current.pause();
      current.currentTime = 0;
    } catch {
      /* ignore */
    }
    finish();
  }
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

/** Call from a real gesture. Plays 1.mp3 and marks audio unlocked. */
export function unlockAndPlayBoot() {
  const ok = playOne();
  if (ok) unlocked = true;
  return ok;
}
