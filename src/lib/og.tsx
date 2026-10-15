import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PAGES, type PageKey } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };

const font = (weight: number) => readFile(join(process.cwd(), `assets/fonts/geist-latin-${weight}-normal.woff`));
const mono = () => readFile(join(process.cwd(), "assets/fonts/geist-mono-latin-400-normal.woff"));

function Grid() {
  const lines = [];
  for (let x = 0; x <= 1120; x += 24) {
    lines.push(<div key={`x${x}`} style={{ position: "absolute", left: x, top: 0, width: 1, height: 550, background: "rgba(255,0,244,0.12)" }} />);
  }
  for (let y = 0; y <= 550; y += 24) {
    lines.push(<div key={`y${y}`} style={{ position: "absolute", top: y, left: 0, height: 1, width: 1120, background: "rgba(255,0,244,0.12)" }} />);
  }
  return <>{lines}</>;
}

export async function renderOg(key: PageKey) {
  const page = PAGES[key];
  const [regular, semibold, monoFont] = await Promise.all([font(400), font(600), mono()]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#F1F0EE", padding: 40, fontFamily: "Geist" }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            borderRadius: 24,
            border: "1px solid rgba(27,25,25,0.1)",
            background: "#FFDFFF",
            overflow: "hidden",
          }}
        >
          <Grid />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="44" height="44" viewBox="0 0 48 48">
              <rect width="48" height="48" rx="12" fill="#ff9fff" />
              <circle cx="24" cy="24" r="9.25" fill="none" stroke="#101010" strokeWidth="2.5" />
              <path d="M15.4 26.6A9.25 9.25 0 0 0 30.5 30.6" fill="none" stroke="#101010" strokeWidth="5" strokeLinecap="round" />
              <circle cx="24" cy="22" r="3" fill="#101010" />
            </svg>
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em", color: "#101010" }}>opentopost</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <span style={{ fontFamily: "Geist Mono", fontSize: 22, color: "#FF00F4", textTransform: "uppercase" }}>
              {page.eyebrow}
            </span>
            <span style={{ fontSize: 68, lineHeight: 1.08, letterSpacing: "-0.035em", color: "#101010", maxWidth: 960 }}>
              {page.heading.replaceAll("\u2011", "-")}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: "#343434" }}>
            <span>{"Posts from real work, in your team's voice."}</span>
            <span style={{ background: "#FF00F4", color: "#fff", padding: "10px 20px", borderRadius: 8, fontWeight: 600 }}>
              Start free
            </span>
          </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist Mono", data: monoFont, weight: 400, style: "normal" },
      ],
    },
  );
}
