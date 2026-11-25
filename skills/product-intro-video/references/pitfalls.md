# Pitfalls

## Remotion on WSL: port check times out

Symptom: `render.mjs` stops after bundling, then fails with `No available ports found` (or `You specified port N ... not available` when `--port` is given).

Cause: `@remotion/renderer/dist/get-port.js` probes ports by connecting to `127.0.0.1` and `::1`. On some WSL networks a connect to a free port is neither accepted nor refused; it times out, and Remotion counts a timeout as "unavailable" for every port. `--port` does not help on its own because the chosen port goes through the same probe.

Fix: `node <skill-dir>/scripts/patch-remotion-port.mjs` (idempotent; edits only the skill's `node_modules`; re-run after every `npm install`). After the patch, `--port 3123` pins a port if you also want a predictable one. On machines without the problem, do not patch.

## Chromium

Remotion downloads its own headless shell unless given a browser. Offline or on WSL pass an existing one: `--browser ~/.cache/ms-playwright/chromium-<n>/chrome-linux/chrome` or `REMOTION_BROWSER`. `render.mjs` picks the newest Playwright Chromium automatically when neither is set.

## Fonts and glyphs

- Text renders in the page's fonts. Without Noto CJK installed, CJK text turns into boxes (豆腐). Check `fc-list | grep "Noto Sans CJK"`; install `fonts-noto-cjk` if missing.
- `lang` matters even with the font installed: the same code point has different Japanese and Chinese shapes. Use `zh` for simplified Chinese videos.
- Avoid emoji in titles and bodies: the render machine's emoji font differs from the viewer's and often shows boxes. Use words or SVG icons.

## Wan3 lip sync

- Output voice drift: some lines start 0-0.5 s late and some are stretched 3-7 %. Lips always match the audio inside the returned video, so play that audio (the template does when `face` is set) and size the scene from the face video (`durations.mjs` does). Measure with `offsets.py` to explain or to decide to regenerate a line.
- Limits: 15 s of audio per call; about 10 minutes per call. Split long narration lines.
- Cost: it is a paid API. Preview first (no `--apply`), make one line, show it, then the rest. Existing `face/sN.mp4` files are skipped on re-runs; delete a file to remake that line.
- Consent: use a real person's face only with that person's agreement, and say in the report whose face was used and that consent was confirmed. Without consent, skip the presenter (`voice` only).
- Keys: `WAN3_API_BASE_URL` and `DASHSCOPE_API_KEY` come from the environment. Load them from the project's env files in the shell (for example `set -a; . <env-file>; set +a`) rather than pasting values. Never echo them, write them into the skill, or include them in a PR.
- Do not route this through another tenant's job system (for example the news job's tenant) just because it already calls Wan3; call the provider module directly for this project's video.

## Voice

- The Ghost front TTS script (`janabiz-news-voice.mjs`) calls the local front's `/api/ai/tts`, so the dev server (port 3000) must be running. It reads in Japanese (`lang` is fixed to ja in that CLI); for other languages call its `prepareScript({ sentences, voice, lang, outDir, apply })` from a small script, or use another TTS.
- `atempo=0.85` slows speech for older viewers without lowering the pitch. Apply it before lip sync so the lips are made for the slow voice.
- Loudness: normalise the final mix once (`loudnorm=I=-16`), not each line, so scenes stay balanced.

## Subtitles

Leave subtitles out of the render. A media job can add them later per language (and translate), and burned-in text cannot be removed or corrected without re-rendering.

## Checking

A finished render is not proof. Make the contact sheet with `check-frames.mjs`, open it, and look for missing scenes, clipped text, boxes, a presenter covering important UI, and black frames. Play a few scene starts with sound to confirm the lips and voice agree.
