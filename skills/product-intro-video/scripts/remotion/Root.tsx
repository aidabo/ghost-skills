import React from "react";
import { Composition } from "remotion";
import { Intro, IntroProps, totalFrames } from "./Intro";

const fallback: IntroProps = {
  fps: 30,
  width: 1080,
  height: 1920,
  lang: "ja",
  scenes: [{ type: "title", title: "scenes.json を渡してください", body: "render.mjs --scenes <file>", frames: 60 }],
};

export const Root: React.FC = () => (
  <Composition
    id="Intro"
    component={Intro as unknown as React.FC<Record<string, unknown>>}
    defaultProps={fallback as unknown as Record<string, unknown>}
    durationInFrames={60}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({ props }) => {
      const p = props as unknown as IntroProps;
      return { durationInFrames: totalFrames(p), fps: p.fps, width: p.width, height: p.height };
    }}
  />
);
