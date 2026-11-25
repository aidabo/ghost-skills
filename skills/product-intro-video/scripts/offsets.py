#!/usr/bin/env python3
"""Measure how far the voice inside each face video drifts from the voice you sent.

  python3 scripts/offsets.py --voice-dir <dir of sN.wav> --face-dir <dir of sN.mp4> [--out offsets.json]

For every sN.wav that has a matching sN.mp4, both are decoded to 16 kHz mono, reduced to a
10 ms loudness envelope, and cross-correlated over -200..+1000 ms. It reports:
  offset_ms  how late the face video's voice starts (positive = later)
  corr       correlation at that offset (low values mean the voice was also stretched)
  stretch    length ratio of the spoken part (face / original); 1.03-1.07 was seen with Wan3

This is a record, not a fix: the renderer plays the face video's own audio, which always
matches its lips. Use the numbers to explain drift or to decide to regenerate a line.
Needs ffmpeg on PATH. Standard library only.
"""
import argparse, json, math, os, re, struct, subprocess, tempfile, wave


def decode(src, dst):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", dst], check=True)
    with wave.open(dst) as w:
        n = w.getnframes()
        return [x / 32768 for x in struct.unpack("<%dh" % n, w.readframes(n))]


def envelope(x, hop=160):
    return [math.sqrt(sum(v * v for v in x[i:i + hop]) / hop) for i in range(0, len(x) - hop, hop)]


def corr(a, b, k):
    xs = [(a[i], b[i + k]) for i in range(len(a)) if 0 <= i + k < len(b)]
    if not xs:
        return 0.0
    ma = sum(x for x, _ in xs) / len(xs)
    mb = sum(y for _, y in xs) / len(xs)
    d = math.sqrt(sum((x - ma) ** 2 for x, _ in xs) * sum((y - mb) ** 2 for _, y in xs)) or 1
    return sum((x - ma) * (y - mb) for x, y in xs) / d


def spoken(env):
    peak = max(env) if env else 0
    idx = [i for i, v in enumerate(env) if v > peak * 0.05]
    return (idx[-1] - idx[0] + 1) if idx else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice-dir", required=True)
    ap.add_argument("--face-dir", required=True)
    ap.add_argument("--out", default="offsets.json")
    o = ap.parse_args()
    names = sorted((f[:-4] for f in os.listdir(o.voice_dir) if f.endswith(".wav")), key=lambda s: [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)])
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        for name in names:
            face = os.path.join(o.face_dir, name + ".mp4")
            if not os.path.exists(face):
                continue
            a = envelope(decode(os.path.join(o.voice_dir, name + ".wav"), os.path.join(tmp, "a.wav")))
            b = envelope(decode(face, os.path.join(tmp, "b.wav")))
            k, c = max(((k, corr(a, b, k)) for k in range(-20, 101)), key=lambda t: t[1])
            sa, sb = spoken(a), spoken(b)
            out[name] = {"offset_ms": k * 10, "corr": round(c, 3), "stretch": round(sb / sa, 3) if sa else None}
            print(name, out[name])
    with open(o.out, "w") as f:
        json.dump(out, f, indent=1)
    print("wrote", o.out)


if __name__ == "__main__":
    main()
