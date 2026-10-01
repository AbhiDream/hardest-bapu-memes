import { MEMES } from "./memes.js";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

function youtubeId(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? m[1] : null;
}

function kindOf(item) {
  if (item.type) return item.type;
  if (youtubeId(item.src)) return "youtube";
  if (VIDEO_EXT.test(item.src)) return "video";
  return "image";
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "text") node.textContent = v;
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function mediaFor(item, kind, { full = false } = {}) {
  if (kind === "youtube") {
    const id = youtubeId(item.src);
    const params = full ? "autoplay=1&rel=0" : "rel=0";
    return el("div", { class: "frame" }, [
      el("iframe", {
        src: `https://www.youtube-nocookie.com/embed/${id}?${params}`,
        title: item.caption || "YouTube video",
        loading: "lazy",
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
        allowfullscreen: true,
      }),
    ]);
  }
  if (kind === "video") {
    const video = el("video", {
      src: item.src,
      poster: item.poster,
      muted: !full,
      loop: true,
      playsinline: true,
      controls: full,
      autoplay: full,
      preload: full ? "auto" : "metadata",
    });
    // Autoplay policies check the property, not just the attribute.
    video.muted = !full;
    return video;
  }
  return el("img", { src: item.src, alt: item.caption || "Bapu meme", loading: full ? "eager" : "lazy", decoding: "async" });
}

function renderEmpty(grid) {
  grid.append(
    el("div", { class: "empty" }, [
      el("h3", { text: "No memes yet" }),
      el("p", { text: "Bapu is waiting. Add image or video URLs to js/memes.js and they show up here." }),
      el("code", {
        text: `export const MEMES = [\n  { src: "https://…/bapu.jpg", caption: "Ahimsa but make it 3D" },\n  { src: "assets/memes/clip.mp4", caption: "Bapu after one chai" },\n  { src: "https://youtu.be/XXXXXXXXXXX" },\n];`,
      }),
    ])
  );
}

function openLightbox(item, kind) {
  const box = document.getElementById("lightbox");
  const body = document.getElementById("lbBody");
  body.replaceChildren(mediaFor(item, kind, { full: true }));
  box.hidden = false;
  document.documentElement.style.overflow = "hidden";
}

function closeLightbox() {
  const box = document.getElementById("lightbox");
  box.hidden = true;
  document.getElementById("lbBody").replaceChildren();
  document.documentElement.style.overflow = "";
}

export function buildWall() {
  const grid = document.getElementById("grid");
  const items = MEMES.filter((m) => m && m.src);
  if (!items.length) {
    renderEmpty(grid);
    return [];
  }

  const videoObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      }
    },
    { rootMargin: "100px" }
  );

  const cards = items.map((item) => {
    const kind = kindOf(item);
    const media = mediaFor(item, kind);
    media.classList.add("media");
    const card = el("article", { class: "card" + (item.caption || item.credit ? "" : " no-cap") }, [media]);
    if (kind !== "image") card.append(el("span", { class: "tag", text: kind === "youtube" ? "YouTube" : "Video" }));
    if (item.caption || item.credit) {
      const cap = el("div", { class: "cap", text: item.caption || "" });
      if (item.credit) cap.append(el("small", { text: item.credit }));
      card.append(cap);
    }
    if (kind === "video") videoObserver.observe(media);
    if (kind !== "youtube") card.addEventListener("click", () => openLightbox(item, kind));
    grid.append(card);
    return card;
  });

  const box = document.getElementById("lightbox");
  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.closest(".lb-close")) closeLightbox();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !box.hidden) closeLightbox();
  });

  return cards;
}
