import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// The whole video is described by one JSON document (see references/scenes-json.md).
// Every path inside it is relative to the public directory passed to render.mjs.

export type Theme = { paper: string; paper2: string; ink: string; accent: string; muted: string };

export type Scene = {
  /** "title" = cover/ending card, "shot" = a screenshot inside a phone frame (default). */
  type?: "title" | "shot";
  img?: string;
  kicker?: string;
  title: string;
  body?: string;
  /** 0..1 share of the screenshot's extra height to scroll through during the scene. */
  pan?: number;
  /** Narration audio. Ignored for playback when `face` is set (the face video carries its own voice). */
  voice?: string;
  /** Talking-head video (e.g. Wan3). Its audio track is what plays. */
  face?: string;
  /** Scene length in frames (written by durations.mjs). */
  frames: number;
};

export type IntroProps = {
  fps: number;
  width: number;
  height: number;
  /** BCP 47 tag; picks default CJK fonts and sets lang= so glyphs come from the right font. */
  lang?: string;
  fontFamily?: string;
  serifFamily?: string;
  theme?: Partial<Theme>;
  /** Pixel size of the screenshots, used for the phone frame aspect and panning. */
  screenshot?: { width: number; height: number };
  /** Still face shown while the narrator is not speaking, and lead-in before the face video starts. */
  presenter?: { still?: string; leadFrames?: number };
  /** Number shots as "01", "02"... before the kicker. */
  numbered?: boolean;
  scenes: Scene[];
};

const DEFAULT_THEME: Theme = { paper: "#f7efe2", paper2: "#f3ead9", ink: "#3d3229", accent: "#a8502f", muted: "#7a6a5a" };

const FONTS: Record<string, [string, string]> = {
  ja: ["'Noto Sans CJK JP', 'Noto Sans JP', sans-serif", "'Noto Serif CJK JP', 'Noto Serif JP', serif"],
  zh: ["'Noto Sans CJK SC', 'Noto Sans SC', sans-serif", "'Noto Serif CJK SC', 'Noto Serif SC', serif"],
  "zh-TW": ["'Noto Sans CJK TC', 'Noto Sans TC', sans-serif", "'Noto Serif CJK TC', 'Noto Serif TC', serif"],
  ko: ["'Noto Sans CJK KR', 'Noto Sans KR', sans-serif", "'Noto Serif CJK KR', 'Noto Serif KR', serif"],
  en: ["'Noto Sans', 'Noto Sans CJK JP', sans-serif", "'Noto Serif', 'Noto Serif CJK JP', serif"],
};

const fontsFor = (lang = "ja") => FONTS[lang] ?? FONTS[lang.split("-")[0]] ?? FONTS.en;
const isCjk = (lang = "ja") => /^(ja|zh|ko)/.test(lang);

export const totalFrames = (p: IntroProps) => p.scenes.reduce((a, s) => a + Math.max(1, Math.round(s.frames || 0)), 0);

type Ctx = { p: IntroProps; t: Theme; sans: string; serif: string; portrait: boolean; k: number };

const Presenter: React.FC<{ c: Ctx; s: Scene; size: number; style: React.CSSProperties }> = ({ c, s, size, style }) => {
  const lead = c.p.presenter?.leadFrames ?? 10;
  const still = c.p.presenter?.still;
  if (!s.face) {
    return s.voice ? (
      <Sequence from={lead}>
        <Audio src={staticFile(s.voice)} />
      </Sequence>
    ) : null;
  }
  const fill: React.CSSProperties = { position: "absolute", width: size, height: size, objectFit: "cover" };
  return (
    <div
      style={{
        position: "absolute", width: size, height: size, borderRadius: "50%", overflow: "hidden",
        border: `${Math.round(8 * c.k)}px solid white`, boxShadow: "0 18px 50px rgba(80,50,20,.35)", background: "#ddd", ...style,
      }}
    >
      {still ? <Img src={staticFile(still)} style={fill} /> : null}
      <Sequence from={lead}>
        {/* The voice plays from the face video: Wan3 may delay or stretch it, so a separate wav would drift. */}
        <OffthreadVideo src={staticFile(s.face)} style={fill} />
      </Sequence>
    </div>
  );
};

const TitleCard: React.FC<{ c: Ctx; s: Scene }> = ({ c, s }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { t, k } = c;
  const e = spring({ frame: f, fps, config: { damping: 200 } });
  const fade = interpolate(f, [s.frames - 12, s.frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const faceSize = Math.round((c.portrait ? 380 : 300) * k);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <AbsoluteFill
        style={{ background: `linear-gradient(180deg, #faf6ef, ${t.paper2})`, justifyContent: "center", alignItems: "center", fontFamily: c.sans, paddingBottom: s.face ? faceSize * 0.9 : 0 }}
      >
        <div style={{ width: 150 * k, height: 150 * k, borderRadius: "50%", background: t.accent, display: "grid", placeItems: "center", marginBottom: 60 * k, transform: `scale(${e})` }}>
          <svg width={84 * k} height={84 * k} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" />
            <path d="M12 6.5v13" />
          </svg>
        </div>
        <div style={{ fontFamily: c.serif, fontSize: 84 * k, color: t.ink, letterSpacing: 6 * k, opacity: e, transform: `translateY(${(1 - e) * 40 * k}px)`, textAlign: "center", lineHeight: 1.4, whiteSpace: "pre-line", padding: `0 ${60 * k}px` }}>
          {s.title}
        </div>
        {s.body ? (
          <div style={{ fontSize: 44 * k, color: t.muted, marginTop: 40 * k, opacity: interpolate(f, [15, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.6 }}>
            {s.body}
          </div>
        ) : null}
      </AbsoluteFill>
      <Presenter c={c} s={s} size={faceSize} style={c.portrait ? { left: (c.p.width - faceSize) / 2, bottom: 140 * k } : { right: 80 * k, bottom: 60 * k }} />
    </AbsoluteFill>
  );
};

const Shot: React.FC<{ c: Ctx; s: Scene; n: number }> = ({ c, s, n }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { p, t, k, portrait } = c;
  const per = s.frames;
  const enter = spring({ frame: f, fps, config: { damping: 200 } });
  // Fade to the page colour, not black, so cuts feel soft.
  const fade = interpolate(f, [per - 12, per], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shot = p.screenshot ?? { width: 1170, height: 2532 };
  const viewH = (portrait ? 1100 : 900) * k;
  const phoneW = portrait ? 620 * k : Math.min(520 * k, viewH * (shot.width / shot.height) * 1.05);
  const imgH = phoneW * (shot.height / shot.width);
  const pan = Math.max(0, (s.pan ?? 0.08) * (imgH - viewH));
  const y = interpolate(f, [20, Math.max(21, per - 15)], [0, -pan], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const pad = 14 * k;
  const frameBox: React.CSSProperties = portrait
    ? { left: (p.width - phoneW - 2 * pad) / 2, top: 640 * k }
    : { right: 140 * k, top: (p.height - viewH - 2 * pad) / 2 };
  const textBox: React.CSSProperties = portrait
    ? { top: 110 * k, left: 80 * k, right: 80 * k }
    : { top: 170 * k, left: 120 * k, width: p.width - phoneW - 2 * pad - 140 * k - 120 * k - 100 * k };
  const faceSize = Math.round((portrait ? 300 : 240) * k);
  const sep = isCjk(p.lang) ? "　" : "  ";
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #faf6ef, ${t.paper2})`, fontFamily: c.sans, opacity: fade }}>
      <div style={{ position: "absolute", ...textBox, opacity: enter, transform: `translateY(${(1 - enter) * 30 * k}px)` }}>
        <div style={{ color: t.accent, fontSize: 40 * k, fontWeight: 700, letterSpacing: 4 * k }}>
          {p.numbered === false ? "" : `${String(n).padStart(2, "0")}${sep}`}
          {s.kicker ?? ""}
        </div>
        <div style={{ fontFamily: c.serif, color: t.ink, fontSize: 66 * k, marginTop: 18 * k, lineHeight: 1.35 }}>{s.title}</div>
        {s.body ? <div style={{ color: t.muted, fontSize: 38 * k, marginTop: 22 * k, whiteSpace: "pre-line", lineHeight: 1.6 }}>{s.body}</div> : null}
      </div>
      <div
        style={{
          position: "absolute", ...frameBox, width: phoneW + 2 * pad, height: viewH + 2 * pad, borderRadius: 64 * k, background: "#2b241e", padding: pad,
          boxShadow: "0 30px 80px rgba(80,50,20,.28)", transform: `translateY(${(1 - enter) * 120 * k}px)`, boxSizing: "border-box",
        }}
      >
        <div style={{ width: phoneW, height: viewH, borderRadius: 52 * k, overflow: "hidden", background: "white" }}>
          {s.img ? <Img src={staticFile(s.img)} style={{ width: phoneW, transform: `translateY(${y}px)` }} /> : null}
        </div>
      </div>
      <Presenter c={c} s={s} size={faceSize} style={portrait ? { left: 28 * k, top: p.height - faceSize - 60 * k } : { left: 120 * k, bottom: 70 * k }} />
    </AbsoluteFill>
  );
};

export const Intro: React.FC<IntroProps> = (p) => {
  const t = { ...DEFAULT_THEME, ...(p.theme ?? {}) };
  const [sans0, serif0] = fontsFor(p.lang);
  const portrait = p.height >= p.width;
  const k = portrait ? p.width / 1080 : p.height / 1080;
  const c: Ctx = { p, t, sans: p.fontFamily ?? sans0, serif: p.serifFamily ?? serif0, portrait, k };
  let from = 0;
  let shotNo = 0;
  return (
    // Background matches the cards so a scene change never flashes black.
    <AbsoluteFill lang={p.lang ?? "ja"} style={{ background: t.paper }}>
      {p.scenes.map((s0, i) => {
        const s = { ...s0, frames: Math.max(1, Math.round(s0.frames || 0)) };
        const start = from;
        from += s.frames;
        const isTitle = s.type === "title";
        if (!isTitle) shotNo += 1;
        return (
          <Sequence key={i} from={start} durationInFrames={s.frames}>
            {isTitle ? <TitleCard c={c} s={s} /> : <Shot c={c} s={s} n={shotNo} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
