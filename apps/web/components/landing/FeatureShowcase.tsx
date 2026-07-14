"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./showcase.module.css";

type Feature = {
  img: string;
  kicker: string;
  name: string;
  text: string;
};

const FEATURES: Feature[] = [
  {
    img: "/time-synced-lyrics.jpeg",
    kicker: "01 — sync",
    name: "Time-synced lyrics",
    text: "Lines light up in step with the track, karaoke style. Synced lyrics come from lrclib, with plain-text fallback when no timing data exists — and we say which one you're getting.",
  },
  {
    img: "/follows-any-device.jpeg",
    kicker: "02 — devices",
    name: "Follows any device",
    text: "Playing on your phone, desktop app, or a smart speaker — Kant_Sing shows what your Spotify account is playing, wherever it plays. Switch devices mid-song and the lyrics follow.",
  },
  {
    img: "/full-playback_control.jpeg",
    kicker: "03 — control",
    name: "Full playback control",
    text: "Play, pause, skip, seek, shuffle, repeat, and volume — controlled from the lyrics screen without switching apps. Seek anywhere in the track and the words stay locked on.",
  },
  {
    img: "/tier-aware.jpeg",
    kicker: "04 — profile",
    name: "Tier-aware profile",
    text: "Your account badge shows your Spotify tier at a glance — gold crown for Premium — and the app adapts to what your plan can do instead of failing silently.",
  },
];

const DUST_MS = 1100;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  r: number;
  g: number;
  b: number;
  wobble: number;
};

/* Brand green the dust converges toward. */
const GREEN = { r: 29, g: 185, b: 84 };

export default function FeatureShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const dustRaf = useRef(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const activeRef = useRef(0);

  /* Sample the visible image into pixel particles and let them drift off. */
  const spawnDust = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !img.complete || img.naturalWidth === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const imgRect = img.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    if (imgRect.width < 10) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = canvasRect.width * dpr;
    canvas.height = canvasRect.height * dpr;

    const w = Math.floor(imgRect.width);
    const h = Math.floor(imgRect.height);
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    if (!octx) return;

    let data: Uint8ClampedArray;
    try {
      octx.drawImage(img, 0, 0, w, h);
      data = octx.getImageData(0, 0, w, h).data;
    } catch {
      return; // tainted canvas — skip the effect rather than crash
    }

    const offsetX = imgRect.left - canvasRect.left;
    const offsetY = imgRect.top - canvasRect.top;
    // ~55 columns of dust regardless of image size keeps the particle
    // count bounded (~3k) so the burst never janks the scroll.
    const step = Math.max(4, Math.floor(w / 55));
    const particles: Particle[] = [];

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 40) continue;
        particles.push({
          x: offsetX + x,
          y: offsetY + y,
          vx: (Math.random() - 0.35) * 55,
          vy: -(25 + Math.random() * 85),
          life: 1,
          decay: 0.55 + Math.random() * 0.75,
          size: step * (0.45 + Math.random() * 0.5),
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
          wobble: Math.random() * Math.PI * 2,
        });
      }
    }

    particlesRef.current = particles;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let last = performance.now();
    cancelAnimationFrame(dustRaf.current);

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, canvasRect.width, canvasRect.height);

      let alive = 0;
      for (const p of particlesRef.current) {
        if (p.life <= 0) continue;
        alive++;
        p.life -= p.decay * dt;
        p.wobble += dt * 6;
        p.x += (p.vx + Math.sin(p.wobble) * 18) * dt;
        p.y += p.vy * dt;
        p.vy -= 20 * dt; // dust accelerates upward as it burns off

        const t = 1 - p.life; // 0 → original pixel, 1 → brand green
        const r = p.r + (GREEN.r - p.r) * t;
        const g = p.g + (GREEN.g - p.g) * t;
        const b = p.b + (GREEN.b - p.b) * t;
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${Math.max(p.life, 0) * 0.9})`;
        ctx.fillRect(p.x, p.y, p.size * p.life, p.size * p.life);
      }

      if (alive > 0) {
        dustRaf.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvasRect.width, canvasRect.height);
      }
    };

    dustRaf.current = requestAnimationFrame(tick);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const prev = activeRef.current;
      if (next === prev) return;
      activeRef.current = next;
      spawnDust();
      setLeaving(prev);
      setActive(next);
      clearTimeout(leaveTimer.current);
      leaveTimer.current = setTimeout(() => setLeaving(null), DUST_MS * 0.7);
    },
    [spawnDust]
  );

  /* Map scroll progress through the tall section onto the feature index. */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(Math.max(-rect.top / scrollable, 0), 0.999);
      goTo(Math.floor(progress * FEATURES.length));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(dustRaf.current);
      clearTimeout(leaveTimer.current);
    };
  }, [goTo]);

  const feature = FEATURES[active];
  const leavingFeature = leaving !== null ? FEATURES[leaving] : null;

  return (
    <section id="features" ref={sectionRef} className={s.section}>
      <div className={s.sticky}>
        <div className={s.head}>
          <p className={s.kicker}>$ kant_sing --features</p>
          <h2 className={s.title}>Built for singing, not scrolling</h2>
        </div>

        <div className={s.panel}>
          <div className={s.imageCol}>
            {leavingFeature && (
              <div className={`${s.frame} ${s.frameExit}`} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={leavingFeature.img} alt="" className={s.img} />
              </div>
            )}
            <div key={active} className={`${s.frame} ${s.frameEnter}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={feature.img}
                alt={feature.name}
                className={s.img}
                crossOrigin="anonymous"
              />
            </div>
            <canvas ref={canvasRef} className={s.dust} aria-hidden="true" />
          </div>

          <div className={s.textCol}>
            {leavingFeature && (
              <div className={`${s.writeup} ${s.textExit}`} aria-hidden="true">
                <p className={s.featKicker}>{leavingFeature.kicker}</p>
                <h3 className={s.featName}>{leavingFeature.name}</h3>
                <p className={s.featText}>{leavingFeature.text}</p>
              </div>
            )}
            <div key={active} className={`${s.writeup} ${s.textEnter}`}>
              <p className={s.featKicker}>{feature.kicker}</p>
              <h3 className={s.featName}>{feature.name}</h3>
              <p className={s.featText}>{feature.text}</p>
            </div>

            <div className={s.rail}>
              {FEATURES.map((f, i) => (
                <span
                  key={f.name}
                  className={`${s.railTick} ${i === active ? s.railTickOn : ""}`}
                />
              ))}
              <span className={s.railLabel}>
                {String(active + 1).padStart(2, "0")} / 0{FEATURES.length}
              </span>
            </div>
          </div>
        </div>

        {/* Warm the other images so the first swap never pops in blank. */}
        <div className={s.preload} aria-hidden="true">
          {FEATURES.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f.img} src={f.img} alt="" />
          ))}
        </div>
      </div>
    </section>
  );
}
