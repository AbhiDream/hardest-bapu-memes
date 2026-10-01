import * as THREE from "three";
import { createHead, createShadow, HEAD_SHAPE } from "./head.js";
import { createDither } from "./dither.js";
import { buildWall } from "./wall.js";
import { playOne, playAny, toggleMute, setMuted, isMuted, unlockAndPlayBoot, isUnlocked } from "./audio.js";

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const TAU = Math.PI * 2;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const { clamp } = THREE.MathUtils;

// Swap this when the repo goes live. Stars are fetched from the GitHub API.
const GITHUB_REPO = "FirePheonix/hardest-bapu-memes";

/* ---------------- smooth scroll ---------------- */

history.scrollRestoration = "manual";
scrollTo(0, 0);

const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.8 });
  });
});

/* ---------------- github stars ---------------- */

(function setupGithub() {
  const link = document.getElementById("github");
  const badge = document.getElementById("stars");
  if (!GITHUB_REPO) return;
  link.href = `https://github.com/${GITHUB_REPO}`;
  fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || typeof data.stargazers_count !== "number") return;
      badge.querySelector("b").textContent = formatStars(data.stargazers_count);
      badge.hidden = false;
    })
    .catch(() => {});
})();

function formatStars(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
}

/* ---------------- sound button ---------------- */

const soundBtn = document.getElementById("sound");
function paintMute() {
  const muted = isMuted();
  soundBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  soundBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  soundBtn.querySelector(".ico-on").hidden = muted;
  soundBtn.querySelector(".ico-off").hidden = !muted;
}
soundBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (isMuted()) {
    // Unmute → also (re)boot sound inside this gesture.
    setMuted(false);
    paintMute();
    unlockAndPlayBoot();
    return;
  }
  if (!isUnlocked()) {
    // First press while unmuted: unlock + play, don't mute.
    unlockAndPlayBoot();
    paintMute();
    return;
  }
  // Already unlocked and audible → mute.
  toggleMute();
  paintMute();
});
paintMute();

/* ---------------- three ---------------- */

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setClearColor(0xffffff, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
camera.position.set(0, 0, 7);

const rig = new THREE.Group();
const wobble = new THREE.Group();
const spinner = new THREE.Group();
rig.add(wobble);
wobble.add(spinner);
scene.add(rig);

const shadow = createShadow();
shadow.position.y = -1.85;
rig.add(shadow);

const hitProxy = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24).scale(HEAD_SHAPE.x, HEAD_SHAPE.y, HEAD_SHAPE.z));
hitProxy.visible = false;
spinner.add(hitProxy);

const dither = createDither(renderer);
const view = { halfW: 1, halfH: 1, fit: 1, narrow: false, pr: 1 };

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  view.pr = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(view.pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  dither.setSize(w, h, view.pr);
  view.halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  view.halfW = view.halfH * camera.aspect;
  view.fit = Math.min(1, view.halfW / 1.55);
  view.narrow = camera.aspect < 0.8;
}
resize();
addEventListener("resize", resize);

/* ---------------- motion state ---------------- */

const intro = { s: 0, ry: -TAU * 1.5, y: -1.4 };
const path = { x: 0, y: -0.02, s: 1.2, rx: 0, ry: 0, rz: 0 };
const fx = { ry: 0, sx: 1, sy: 1 };
const tilt = { x: 0, y: 0 };
const tiltX = gsap.quickTo(tilt, "x", { duration: 1, ease: "power3.out" });
const tiltY = gsap.quickTo(tilt, "y", { duration: 1, ease: "power3.out" });

let head = null;
let speed = 0;
let drift = 0;
let lean = 0;
let idle = 0;
let marqueeDir = 1;

// Sudden-scroll SFX must run inside the wheel/touch handler (user gesture),
// not the GSAP ticker — browsers block Audio.play() from rAF otherwise.
let lastScrollSfx = 0;
const SCROLL_SFX_COOLDOWN = 700;
const SCROLL_SUDDEN = 40; // |deltaY| px in one wheel tick
const SCROLL_AGGRESSIVE = 120;

function scrollSfx(intensity) {
  const now = performance.now();
  if (now - lastScrollSfx < SCROLL_SFX_COOLDOWN) return;
  if (!isUnlocked()) {
    // First flick unlocks + plays boot 1.mp3.
    if (unlockAndPlayBoot()) lastScrollSfx = now;
    return;
  }
  const ok = intensity >= SCROLL_AGGRESSIVE ? playAny() : playOne();
  if (ok) lastScrollSfx = now;
}

addEventListener(
  "wheel",
  (e) => {
    const dy = Math.abs(e.deltaY);
    if (dy >= SCROLL_SUDDEN) scrollSfx(dy);
  },
  { passive: true }
);

let touchY = null;
addEventListener(
  "touchstart",
  (e) => {
    touchY = e.touches[0]?.clientY ?? null;
    if (!isUnlocked()) unlockAndPlayBoot();
  },
  { passive: true }
);
addEventListener(
  "touchmove",
  (e) => {
    if (touchY == null) return;
    const y = e.touches[0]?.clientY;
    if (y == null) return;
    const dy = Math.abs(y - touchY);
    touchY = y;
    if (dy >= 18) scrollSfx(dy * 4);
  },
  { passive: true }
);

const marquee = gsap.to(".marquee-track", { xPercent: -50, duration: 24, ease: "none", repeat: -1 });
marquee.totalTime(24 * 500);

gsap.ticker.add((time, deltaTime) => {
  const dt = Math.min(deltaTime, 50) / 1000;
  const step = dt * 60;

  speed += ((lenis.velocity || 0) - speed) * Math.min(1, dt * 6);
  drift += clamp(speed * 0.0035, -0.4, 0.4) * step;
  lean += (clamp(speed * 0.006, -0.45, 0.45) - lean) * Math.min(1, dt * 5);
  if (!reduceMotion) idle += dt * 0.35;

  const bob = reduceMotion ? 0 : Math.sin(time * 1.4) * 0.06;
  rig.position.set(path.x * view.halfW * 2, path.y * view.halfH * 2 + intro.y + bob, 0);
  const s = path.s * intro.s * view.fit;
  rig.scale.setScalar(Math.max(s, 1e-4));

  wobble.rotation.set(tilt.y * 0.28, tilt.x * 0.42, path.rz + lean);
  spinner.rotation.set(path.rx, intro.ry + path.ry + fx.ry + drift + idle, 0);
  if (head) head.scale.set(fx.sx, fx.sy, fx.sx);
  shadow.material.uniforms.uStrength.value = 0.5 * Math.min(1, intro.s) / (1 + Math.abs(bob) * 2);

  if (Math.abs(speed) > 0.5) marqueeDir = Math.sign(speed);
  marquee.timeScale(marqueeDir * (1 + Math.min(Math.abs(speed) * 0.08, 6)));

  dither.uniforms.uPx.value = Math.round(view.pr * (2 + Math.min(Math.abs(speed) * 0.04, 3)));
  dither.render(scene, camera);
});

/* ---------------- text splitting ---------------- */

function split(el) {
  const text = el.textContent.trim();
  el.textContent = "";
  if (!el.closest("[aria-label]")) el.setAttribute("aria-label", text);
  text.split(/\s+/).forEach((word, i) => {
    if (i) el.append(" ");
    const w = document.createElement("span");
    w.className = "w";
    w.setAttribute("aria-hidden", "true");
    for (const ch of word) {
      const c = document.createElement("span");
      c.className = "ch";
      c.textContent = ch;
      w.append(c);
    }
    el.append(w);
  });
}
document.querySelectorAll("[data-split]").forEach(split);

/* ---------------- scroll choreography ---------------- */

function buildPath() {
  const wall = document.getElementById("wall");
  const pageTop = (el) => el.getBoundingClientRect().top + scrollY;
  const side = (desktop, mobile) => () => (view.narrow ? mobile : desktop);
  const end = () => pageTop(wall);

  const poses = [
    { at: 0, x: side(0.18, 0.06), y: 0, s: 1.2, rx: 0.12, ry: 0, rz: -0.1 },
    { at: () => end() * 0.45, x: side(-0.22, -0.08), y: 0.02, s: 1.15, rx: 0.2, ry: TAU * 2.5, rz: 0.14 },
    { at: () => end() * 0.75, x: side(0.16, 0.05), y: 0, s: 1.3, rx: TAU * 0.5, ry: TAU * 4.5, rz: -0.08 },
    { at: end, x: side(0.38, 0.3), y: side(0.24, 0.3), s: side(0.42, 0.34), rx: TAU, ry: TAU * 6, rz: 0 },
  ];

  const tl = gsap.timeline({
    defaults: { ease: "sine.inOut" },
    scrollTrigger: {
      start: 0,
      end,
      scrub: reduceMotion ? true : 1.4,
      invalidateOnRefresh: true,
    },
  });

  for (let i = 1; i < poses.length; i++) {
    const prev = typeof poses[i - 1].at === "function" ? poses[i - 1].at() : poses[i - 1].at;
    const next = typeof poses[i].at === "function" ? poses[i].at() : poses[i].at;
    const { at, ...pose } = poses[i];
    tl.to(path, { ...pose, duration: Math.max(1, next - prev) }, prev);
  }
}
buildPath();

gsap.to(".hero .title, .hero .kicker", {
  yPercent: -40,
  opacity: 0,
  ease: "none",
  scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
});
gsap.to(".hero .hint", {
  opacity: 0,
  ease: "none",
  scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true },
});

gsap.from(".wall-head .ch", {
  yPercent: 120,
  rotate: () => gsap.utils.random(-25, 25),
  opacity: 0,
  duration: 0.9,
  ease: "back.out(1.8)",
  stagger: 0.02,
  scrollTrigger: { trigger: ".wall-head", start: "top 85%", toggleActions: "play none none reverse" },
});
gsap.from(".wall-sub", {
  y: 16,
  opacity: 0,
  duration: 0.8,
  ease: "expo.out",
  scrollTrigger: { trigger: ".wall-head", start: "top 80%", toggleActions: "play none none reverse" },
});

/* ---------------- meme wall ---------------- */

const cards = buildWall();
if (cards.length) {
  gsap.set(cards, { y: 70, opacity: 0, rotate: () => gsap.utils.random(-5, 5) });
  ScrollTrigger.batch(cards, {
    start: "top 92%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, rotate: 0, duration: 1, ease: "expo.out", stagger: 0.08 }),
  });
  const refresh = gsap.delayedCall(0.2, () => ScrollTrigger.refresh()).pause();
  document.querySelectorAll("#grid img, #grid video").forEach((m) => {
    m.addEventListener(m.tagName === "IMG" ? "load" : "loadedmetadata", () => refresh.restart(true), { once: true });
  });
} else {
  gsap.from(".empty", {
    y: 40,
    opacity: 0,
    duration: 1,
    ease: "expo.out",
    scrollTrigger: { trigger: ".empty", start: "top 90%" },
  });
}

/* ---------------- pointer: tilt, hover, click to spin ---------------- */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const INTERACTIVE = "a,button,input,textarea,select,video,iframe,.card,.lightbox,.empty";
const PHRASES = ["Arre!", "Arre beta!", "Chakkar aa gaya!", "Ahimsa please!", "Bas karo!", "Ek aur baar?", "Wheee!", "Banned? Never."];

function overHead(e) {
  if (!head || e.target.closest(INTERACTIVE)) return false;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(hitProxy, false).length > 0;
}

addEventListener("pointermove", (e) => {
  tiltX((e.clientX / innerWidth - 0.5) * 2);
  tiltY((e.clientY / innerHeight - 0.5) * 2);
  if (e.pointerType === "mouse") document.body.classList.toggle("over-head", overHead(e));
});

let clickSpin = 0;
addEventListener("click", (e) => {
  if (!overHead(e)) return;
  clickSpin += TAU * 2;
  gsap.to(fx, { ry: clickSpin, duration: 1.8, ease: "expo.out", overwrite: "auto" });
  gsap.fromTo(fx, { sx: 1.2, sy: 0.76 }, { sx: 1, sy: 1, duration: 1.2, ease: "elastic.out(1.1, 0.3)", overwrite: "auto" });
  // Click is a real gesture — safe to play. Unlock if this is the first one.
  if (!isUnlocked()) unlockAndPlayBoot();
  else playAny();

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  bubble.style.left = `${e.clientX}px`;
  bubble.style.top = `${e.clientY}px`;
  document.body.append(bubble);
  gsap
    .timeline({ onComplete: () => bubble.remove() })
    .fromTo(
      bubble,
      { xPercent: -50, yPercent: -100, y: 0, scale: 0.3, opacity: 0, rotate: gsap.utils.random(-14, 14) },
      { y: -36, scale: 1, opacity: 1, duration: 0.45, ease: "back.out(3)" }
    )
    .to(bubble, { y: -110, opacity: 0, duration: 0.6, ease: "power2.in" }, "+=0.7");
});

/* ---------------- load + intro ---------------- */
// Boot sound waits for a real gesture (scroll / click / speaker) — browsers block
// Audio.play() from the GSAP timeline. unlockAndPlayBoot() handles the first one.

function intoTheScene() {
  gsap
    .timeline({ defaults: { ease: "expo.out" } })
    .to("#loader", { autoAlpha: 0, duration: 0.5, ease: "power2.out" })
    .to(intro, { s: 1, duration: 1.9, ease: "elastic.out(1, 0.45)" }, 0.1)
    .to(intro, { ry: 0, duration: 2.8, ease: "power4.out" }, 0.1)
    .to(intro, { y: 0, duration: 1.6 }, 0.1)
    .from(
      ".title .ch",
      {
        yPercent: 120,
        rotate: () => gsap.utils.random(-30, 30),
        opacity: 0,
        duration: 1.3,
        stagger: { each: 0.035, from: "random" },
      },
      0.2
    )
    .from(".hero [data-reveal]", { y: 18, opacity: 0, duration: 0.9, stagger: 0.12 }, 0.8);
}

new THREE.TextureLoader().load(
  "assets/bapu.png",
  (texture) => {
    head = createHead(texture);
    spinner.add(head);
    intoTheScene();
  },
  undefined,
  () => {
    document.querySelector("#loader span").textContent = "bapu went on a walk (image failed to load)";
  }
);
