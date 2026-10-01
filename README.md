# The Hardest Bapu Memes

A single-page site where a dithered 3D Bapu head spins as you scroll. Memes that still won't get us banned.

**Repo:** [FirePheonix/hardest-bapu-memes](https://github.com/FirePheonix/hardest-bapu-memes)
**Live:** [hardest-bapu.vercel.app](https://hardest-bapu.vercel.app)

## Run locally

```bash
npx http-server -p 5173 -c-1 .
```

## Add memes

Edit `js/memes.js`. Drop files in `assets/` and point at them:

```js
export const MEMES = [
  { src: "assets/1.mp4", caption: "…" },
  { src: "assets/your-meme.jpg", caption: "…" },
];
```

## Sound

`assets/1.mp3`, `2.mp3`, `3.mp3` — one plays at a time, never stacked or queued. Mute with the speaker pill.
