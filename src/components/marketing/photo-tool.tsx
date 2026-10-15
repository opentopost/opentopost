"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass, inputClass } from "@/components/ui";

type Frame = "none" | "ring" | "tag";
type Settings = {
  zoom: number;
  panX: number;
  panY: number;
  brightness: number;
  contrast: number;
  saturation: number;
  frame: Frame;
  color: string;
  tag: string;
  background: string;
};

const DEFAULTS: Settings = {
  zoom: 1,
  panX: 0,
  panY: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  frame: "tag",
  color: "#ff00f4",
  tag: "opentopost",
  background: "#f1f0ee",
};

const COLORS = ["#ff00f4", "#101010", "#0a7ea4", "#3b4a0b", "#c4320a", "#ffffff"];
const BACKGROUNDS = ["#f1f0ee", "#ffdfff", "#ccf5ff", "#e4f7b4", "#fff5cb", "#101010"];

/** Draws the finished picture, square, at any size. LinkedIn shows it inside a circle. */
function render(canvas: HTMLCanvasElement | null, size: number, image: HTMLImageElement | null, s: Settings) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = s.background;
  ctx.fillRect(0, 0, size, size);
  if (image) {
    const base = Math.max(size / image.naturalWidth, size / image.naturalHeight) * s.zoom;
    const w = image.naturalWidth * base;
    const h = image.naturalHeight * base;
    const x = Math.min(0, Math.max(size - w, (size - w) / 2 + s.panX * size));
    const y = Math.min(0, Math.max(size - h, (size - h) / 2 + s.panY * size));
    ctx.save();
    if ("filter" in ctx) ctx.filter = `brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%)`;
    ctx.drawImage(image, x, y, w, h);
    ctx.restore();
  }
  if (s.frame === "none") return;
  // The same shape as LinkedIn's #OpenToWork ring: a thick arc around the bottom and left,
  // solid in the middle and fading out at both ends, open at the top right.
  const band = size * 0.115;
  const radius = size / 2 - band / 2;
  const rgb = [1, 3, 5].map((i) => parseInt(s.color.slice(i, i + 2), 16));
  const tone = (alpha: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  const deg = (n: number) => (n * Math.PI) / 180;
  ctx.save();
  ctx.lineWidth = band;
  ctx.lineCap = "butt";
  if (typeof ctx.createConicGradient === "function") {
    const gradient = ctx.createConicGradient(0, size / 2, size / 2);
    for (const [angle, alpha] of [[0, 0], [8, 0], [55, 1], [190, 1], [250, 0], [360, 0]] as const) gradient.addColorStop(angle / 360, tone(alpha));
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = s.color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, deg(30), deg(235));
    ctx.stroke();
  }
  if (s.frame === "tag" && s.tag.trim()) {
    const text = `#${s.tag.trim().replace(/^#/, "")}`.toUpperCase().slice(0, 16);
    const fontSize = band * 0.5;
    const spacing = fontSize * 0.14;
    ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = s.color.toLowerCase() === "#ffffff" ? "#101010" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // The text starts on the left and runs down and around the bottom, with the tops of the letters toward the middle.
    let angle = deg(172);
    ctx.translate(size / 2, size / 2);
    for (const char of text) {
      const width = ctx.measureText(char).width;
      const center = angle - width / 2 / radius;
      ctx.save();
      ctx.translate(Math.cos(center) * radius, Math.sin(center) * radius);
      ctx.rotate(center - Math.PI / 2);
      ctx.fillText(char, 0, 0);
      ctx.restore();
      angle -= (width + spacing) / radius;
    }
  }
  ctx.restore();
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] text-muted">
      <span className="flex justify-between">
        {label}
        <span className="tabular-nums">
          {value}
          {suffix}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[#d600cd]" />
    </label>
  );
}

function Swatches({ options, value, onChange, label }: { options: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 text-[13px] text-muted">
      {label}
      <div className="flex gap-2">
        {options.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => onChange(color)}
            style={{ background: color }}
            className={`h-7 w-7 rounded-full border ${value === color ? "border-ink ring-2 ring-ink/30" : "border-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

type Check = { ok: boolean; text: string };

function checksFor(image: HTMLImageElement, file: File): Check[] {
  const short = Math.min(image.naturalWidth, image.naturalHeight);
  const out: Check[] = [
    { ok: short >= 400, text: short >= 400 ? `Sharp enough: ${image.naturalWidth} by ${image.naturalHeight} pixels.` : `Small: ${image.naturalWidth} by ${image.naturalHeight} pixels. LinkedIn wants at least 400 by 400.` },
    { ok: file.size <= 8 * 1024 * 1024, text: file.size <= 8 * 1024 * 1024 ? `File size is fine: ${file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}.` : "The file is over 8 MB, which LinkedIn will not take. The download here is smaller." },
  ];
  const probe = document.createElement("canvas");
  probe.width = 32;
  probe.height = 32;
  const ctx = probe.getContext("2d");
  if (ctx) {
    ctx.drawImage(image, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const light = sum / (data.length / 4);
    out.push({ ok: light >= 70 && light <= 200, text: light < 70 ? "Dark photo. Raise the brightness, or use a window for light." : light > 200 ? "Very bright photo. Lower the brightness a little." : "The light looks balanced." });
  }
  if (Math.abs(image.naturalWidth - image.naturalHeight) > short * 0.5) out.push({ ok: true, text: "Not a square photo. Drag it to place your face in the middle." });
  return out;
}

const TIPS = [
  "Your face should fill about 60% of the circle, with your eyes in the upper third.",
  "Use a plain background and soft light from the front or from a window.",
  "Look at the camera and smile a little. People trust a face that looks friendly.",
  "Use a photo from the last two years, taken alone.",
];

export function PhotoTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [name, setName] = useState("Your name");
  const [headline, setHeadline] = useState("What you do, and who it helps");
  const [place, setPlace] = useState("Lagos, Nigeria");
  const [error, setError] = useState<string | null>(null);
  const main = useRef<HTMLCanvasElement>(null);
  const profile = useRef<HTMLCanvasElement>(null);
  const post = useRef<HTMLCanvasElement>(null);
  const comment = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    render(main.current, 520, image, s);
    render(profile.current, 240, image, s);
    render(post.current, 96, image, s);
    render(comment.current, 64, image, s);
  }, [image, s]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const patch = (next: Partial<Settings>) => setS((current) => ({ ...current, ...next }));

  const load = useCallback((file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo: a JPG, PNG or WebP file.");
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setChecks(checksFor(img, file));
      setS((current) => ({ ...current, zoom: 1, panX: 0, panY: 0 }));
    };
    img.onerror = () => setError("That file could not be opened. Try a JPG or PNG.");
    img.src = url;
  }, []);

  function download(type: "image/png" | "image/jpeg") {
    const out = document.createElement("canvas");
    render(out, 800, image, s);
    out.toBlob(
      (blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `linkedin-photo.${type === "image/png" ? "png" : "jpg"}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      },
      type,
      0.92,
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,520px)_1fr]">
      <div className="flex flex-col gap-4">
        <div
          className="relative aspect-square w-full touch-none overflow-hidden rounded-card border border-line bg-fill"
          onPointerDown={(e) => {
            if (!image) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, panX: s.panX, panY: s.panY };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const box = e.currentTarget.getBoundingClientRect();
            patch({ panX: drag.current.panX + (e.clientX - drag.current.x) / box.width, panY: drag.current.panY + (e.clientY - drag.current.y) / box.height });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <canvas ref={main} className={`h-full w-full ${image ? "cursor-grab active:cursor-grabbing" : ""}`} />
          {!image && (
            <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 bg-canvas/80 p-6 text-center">
              <span className={buttonClass("primary", "md")}>Choose a photo</span>
              <span className="text-[13px] text-muted">or drop one here. It stays on your device.</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
            </label>
          )}
          {image && <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at center, transparent 69.5%, rgb(16 16 16 / 0.45) 70%)" }} />}
        </div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        {image && (
          <div className="flex flex-wrap gap-2">
            <label className={`${buttonClass("secondary", "sm")} cursor-pointer`}>
              Change photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
            </label>
            <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setS(DEFAULTS)}>
              Reset
            </button>
          </div>
        )}
        <p className="text-[13px] text-muted">Drag the photo to move it. LinkedIn shows only the circle, so keep your face inside it.</p>

        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <Slider label="Zoom" value={Math.round(s.zoom * 100)} min={100} max={300} suffix="%" onChange={(n) => patch({ zoom: n / 100 })} />
          <Slider label="Brightness" value={s.brightness} min={60} max={140} suffix="%" onChange={(n) => patch({ brightness: n })} />
          <Slider label="Contrast" value={s.contrast} min={70} max={140} suffix="%" onChange={(n) => patch({ contrast: n })} />
          <Slider label="Color" value={s.saturation} min={0} max={160} suffix="%" onChange={(n) => patch({ saturation: n })} />
        </div>

        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <div className="flex flex-col gap-1.5 text-[13px] text-muted">
            Frame
            <div className="flex gap-2">
              {([["tag", "Ring with tag"], ["ring", "Ring only"], ["none", "No frame"]] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => patch({ frame: value })} className={buttonClass(s.frame === value ? "dark" : "secondary", "sm")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {s.frame === "tag" && (
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">
              Tag on the ring
              <input className={inputClass} value={s.tag} maxLength={22} onChange={(e) => patch({ tag: e.target.value })} />
            </label>
          )}
          {s.frame !== "none" && <Swatches label="Ring color" options={COLORS} value={s.color} onChange={(color) => patch({ color })} />}
          <Swatches label="Background behind you" options={BACKGROUNDS} value={s.background} onChange={(background) => patch({ background })} />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="h-[110px] bg-gradient-to-r from-accent-soft via-sky to-lime" />
          <div className="relative px-6 pb-6">
            <canvas ref={profile} className="-mt-[60px] h-[120px] w-[120px] rounded-full border-4 border-white bg-white" />
            <div className="mt-3 flex flex-col gap-2">
              <input className="w-full bg-transparent text-[22px] font-semibold tracking-[-0.01em] outline-none" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
              <input className="w-full bg-transparent text-[15px] text-body outline-none" value={headline} onChange={(e) => setHeadline(e.target.value)} aria-label="Your headline" />
              <input className="w-full bg-transparent text-[13px] text-muted outline-none" value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Your location" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">In the feed and in comments</p>
          <div className="flex items-center gap-3">
            <canvas ref={post} className="h-12 w-12 rounded-full" />
            <div className="min-w-0 text-[14px] leading-tight">
              <p className="truncate font-semibold">{name || "Your name"}</p>
              <p className="truncate text-[12px] text-muted">{headline}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <canvas ref={comment} className="h-8 w-8 rounded-full" />
            <div className="rounded-item bg-fill px-3 py-2 text-[13px]">
              <p className="font-semibold">{name || "Your name"}</p>
              <p className="text-body">Thanks for sharing this.</p>
            </div>
          </div>
        </div>

        {image && (
          <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-6">
            <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">Photo check</p>
            {checks.map((check) => (
              <p key={check.text} className={`flex gap-2 text-[14px] ${check.ok ? "text-ink" : "text-danger"}`}>
                <span aria-hidden>{check.ok ? "✓" : "!"}</span>
                {check.text}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-6">
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">A good LinkedIn photo</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] text-body">
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!image} className={buttonClass("primary", "md")} onClick={() => download("image/png")}>
            Download PNG
          </button>
          <button type="button" disabled={!image} className={buttonClass("secondary", "md")} onClick={() => download("image/jpeg")}>
            Download JPG
          </button>
        </div>
        <p className="text-[13px] text-muted">The photo never leaves this page. Nothing is uploaded, and nothing is stored.</p>
      </div>
    </div>
  );
}
