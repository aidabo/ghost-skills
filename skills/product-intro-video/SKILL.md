---
name: product-intro-video
description: Make a narrated product or screen introduction video (紹介動画・画面の紹介動画・使い方の動画) from real app screenshots - Playwright captures, one scenes JSON, TTS narration, optional Wan3 talking-head presenter, Remotion render, loudness normalisation and a frame check. Use when asked to turn an app's screens into a walkthrough, promo, onboarding or "how to use" video, to add narration or a speaking presenter to such a video, to make a language version (ja/zh/en) of one, or to re-render one after the screens or script changed.
---

# Product intro video

Build a short vertical (or landscape) video that walks through real screens: cover card, one scene per screen (kicker, title, body, screenshot in a phone frame that scrolls slowly), ending card, narration per scene, and optionally a presenter whose lips move with the voice. Everything after capture is driven by one JSON file, so changing the script or the screens means re-running steps, not editing code.

Locate this skill's directory from the loaded `SKILL.md`. Install its dependencies once with `npm install --prefix <skill-dir>` (they stay inside the skill, not the target project). Work in a scratch directory; never commit renders, screenshots, voices or face videos.

## Steps

1. **Capture screens with Playwright.** Log in, set the UI language, use a phone viewport (390x844 at device scale 3 gives 1170x2532 images), scroll and click to reach each state, and screenshot. Read credentials from a file or environment and never print them or put them in the conversation. Patterns and the click-before-shot helpers: `references/capture.md`.
2. **Write the scenes JSON.** One document holds size, language, theme and the scene list (image, kicker, title, body, narration, voice/face paths, pan). Schema and a full example: `references/scenes-json.md`, `examples/scenes.sample.json`. Keep the narration one line per scene, in scene order, with the cover first and the ending last.
3. **Narration to voice.** Use the project's TTS tool, which caches by sentence so re-runs only pay for changed lines (for Ghost front: `tools/news-worker/scripts/janabiz-news-voice.mjs --script narration.txt --voice "<voice>" --out <dir>`; preview first, then `--apply`). For older viewers slow it slightly without changing pitch: `ffmpeg -i sN.wav -filter:a atempo=0.85 slow/sN.wav`.
4. **Optional presenter (lip sync).** Only with the pictured person's consent - ask, do not assume. Crop the face to a square (720x720) and run `node <skill-dir>/scripts/wan3-lipsync.mjs --image face.jpg --voice-dir slow --out-dir face` (preview; add `--apply` to pay). It is paid and slow (about 10 min per line, 15 s audio max per line): first make one line with `--only s1 --apply`, show it to the user, and continue only after they approve.
5. **Play the voice that is inside the face video.** Wan3 may start the voice up to 0.5 s late and stretch it 3-7 %, so a separate wav drifts from the lips. When a scene has `face`, the template plays that video's audio and ignores `voice`. Record the drift with `python3 <skill-dir>/scripts/offsets.py --voice-dir slow --face-dir face` and keep the JSON with the outputs.
6. **Set durations and render.** `node <skill-dir>/scripts/durations.mjs --scenes scenes.json --public <dir>` sets each scene to lead-in + face/voice length + tail. Then `node <skill-dir>/scripts/render.mjs --scenes scenes.json --public <dir> --out out/intro.mp4`. Scene changes fade to the page colour, fonts are chosen from `lang` so CJK text does not turn into boxes, and the template uses no emoji. If rendering stalls on a port check or cannot find Chrome, see `references/pitfalls.md`.
7. **Normalise loudness.** `ffmpeg -i out/intro.mp4 -c:v copy -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 192k out/intro-final.mp4`.
8. **Check before handing over.** `node <skill-dir>/scripts/check-frames.mjs --video out/intro-final.mp4 --scenes scenes.json --out out/sheet.png`, then open the sheet image and look: every scene present, text not clipped, no boxes (豆腐) or missing glyphs, presenter visible. Spot-check audio sync at a few scene starts. Report the file, length, and what was checked.

## Notes

- Subtitles: do not burn them in by default. A media job can add them later per language, and burned text cannot be removed.
- For quick iterations render a range: `--frames 0-299`.
- Costs, consent, tenant boundaries and environment pitfalls: `references/pitfalls.md`. Read it before step 3 the first time.
