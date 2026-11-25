# Scenes JSON

One file drives the render. All media paths are relative to the `--public` directory given to `render.mjs` and `durations.mjs`.

```jsonc
{
  "fps": 30,
  "width": 1080,            // 1080x1920 vertical (phone); 1920x1080 switches to a side-by-side layout
  "height": 1920,
  "lang": "ja",             // ja | zh | zh-TW | ko | en - picks Noto CJK fonts and sets lang= on the page
  "fontFamily": null,       // optional override, CSS font-family
  "serifFamily": null,      // optional override for titles
  "theme": { "paper": "#f7efe2", "paper2": "#f3ead9", "ink": "#3d3229", "accent": "#a8502f", "muted": "#7a6a5a" },
  "screenshot": { "width": 1170, "height": 2532 },   // pixel size of the captures (phone frame aspect, panning)
  "presenter": { "still": "face.jpg", "leadFrames": 10 }, // optional; still face shown around the talking video
  "numbered": true,         // "01", "02"... before each shot's kicker
  "scenes": [
    { "type": "title", "title": "家族の思い出を\nあたたかく残す場所", "body": "マイホームのご紹介",
      "narration": "家族の思い出を、あたたかく残す場所。…", "face": "face/s1.mp4", "frames": 249 },
    { "img": "s01.png", "kicker": "マイホーム", "title": "ログインすると、家族の場所",
      "body": "家族の顔と、今月の思い出の数が\nいちばん上に見えます。", "pan": 0.15,
      "narration": "ログインすると、まずマイホーム。…", "voice": "voice/s2.wav", "face": "face/s2.mp4", "frames": 279 },
    { "type": "title", "title": "話して、書いて、\n家族と残す", "body": "携帯ひとつで", "face": "face/s13.mp4", "frames": 279 }
  ]
}
```

Scene fields:

| field | meaning |
| --- | --- |
| `type` | `"title"` for cover/ending cards; anything else is a screenshot scene |
| `img` | screenshot (shot scenes) |
| `kicker`, `title`, `body` | small heading, main heading, explanation; `\n` breaks lines |
| `pan` | 0..1 share of the screenshot's hidden height to scroll through (default 0.08) |
| `narration` | the spoken text; not rendered, kept so the script and scenes stay together |
| `voice` | narration audio; played only when there is no `face` |
| `face` | talking-head video; its own audio is played (see pitfalls: Wan3 drift) |
| `frames` | scene length; `durations.mjs` fills it from `face` or `voice` |

File names follow scene numbers: scene N uses `voice/sN.wav` and `face/sN.mp4` (the TTS script writes line N as `sN.wav`, and `wan3-lipsync.mjs` turns `sN.wav` into `sN.mp4`). Give every scene a narration line so the numbers cannot shift; a scene that should stay silent simply has no `voice`/`face`, and its generated file is not used.

To produce the narration file for TTS (fails if a scene has no narration, instead of reading "undefined"):

```sh
node -e 'const d = require(require("path").resolve(process.argv[1]));
d.scenes.forEach((s, i) => { if (!s.narration) throw new Error(`scene ${i + 1} has no narration`); console.log(s.narration.replace(/\n/g, " ")); });' scenes.json > narration.txt
```

Language versions: copy the JSON, change `lang`, the texts, the captures (shot in that UI language) and the media paths; render each separately.
