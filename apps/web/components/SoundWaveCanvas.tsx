"use client";

import { useEffect, useRef } from "react";

export interface SoundWaveConfig {
  /** Arc stroke color. Defaults to the app accent green. */
  waveColor: string;
  /** Distance in px between consecutive wavefronts. */
  waveSpacing: number;
  /** Core stroke width of each wavefront, in px. */
  waveThickness: number;
  /** Propagation speed in px/second. */
  waveSpeed: number;
  /** Peak opacity of a wavefront core. */
  waveOpacity: number;
  /** Glow intensity multiplier (0 = no glow). */
  waveGlow: number;
  /** Maximum number of simultaneously visible wavefronts per side. */
  waveCount: number;
  /** Px over which a wavefront fades out as it approaches the lyrics. */
  fadeDistance: number;
  /** Px of clear space kept between the wave edge and the lyrics area. */
  stopBeforeCenter: number;
  /** Global time multiplier (1 = normal). */
  animationSpeed: number;
  /** Wave origin (speaker cone) as fraction of viewport width from the outer edge. */
  originXFraction: number;
  /** Wave origin (speaker cone) as fraction of viewport height from the top. */
  originYFraction: number;
}

export const DEFAULT_WAVE_CONFIG: SoundWaveConfig = {
  waveColor: "#1db954",
  waveSpacing: 36,
  waveThickness: 1.5,
  waveSpeed: 42,
  waveOpacity: 0.5,
  waveGlow: 1,
  waveCount: 64,
  fadeDistance: 110,
  stopBeforeCenter: 56,
  animationSpeed: 1,
  originXFraction: 0.15,
  originYFraction: 0.56,
};

interface SoundWaveCanvasProps {
  side: "left" | "right";
  /** Waves propagate only while true; they freeze and dim when false. */
  isPlaying: boolean;
  /** Width in px of the central region (lyrics) that must stay clear. */
  centerClearWidth?: number;
  config?: Partial<SoundWaveConfig>;
}

const DESKTOP_QUERY = "(min-width: 1024px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * Desktop-only concentric wavefront visualization. Renders evenly spaced
 * glowing arcs propagating at constant velocity from one screen edge toward
 * the lyrics area, fading out before they reach it. Rendering is a pure
 * function of elapsed time (phase = distance % spacing), so the loop is
 * seamless with no per-frame allocations or wave bookkeeping.
 */
export default function SoundWaveCanvas({
  side,
  isPlaying,
  centerClearWidth = 640,
  config,
}: SoundWaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const cfgRef = useRef<SoundWaveConfig>({ ...DEFAULT_WAVE_CONFIG, ...config });
  cfgRef.current = { ...DEFAULT_WAVE_CONFIG, ...config };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const desktop = window.matchMedia(DESKTOP_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);

    let rafId = 0;
    let running = false;
    let lastTime = 0;
    let travelled = 0; // total propagation distance; phase source
    let energy = 0; // eases 0..1 with isPlaying; freezes + dims when paused
    let width = 0;
    let height = 0;
    let dpr = 1;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const cfg = cfgRef.current;
      const clear = centerClearWidth + cfg.stopBeforeCenter * 2;
      const available = Math.max(0, (window.innerWidth - clear) / 2);
      width = Math.floor(available);
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.floor(width * dpr));
      canvas!.height = Math.floor(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
    }

    function draw(now: number) {
      if (!running) return;
      rafId = requestAnimationFrame(draw);

      const cfg = cfgRef.current;
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
      lastTime = now;

      // Ease energy toward play state: waves freeze and dim on pause.
      const target = isPlayingRef.current ? 1 : 0;
      energy += (target - energy) * Math.min(dt * 3, 1);

      travelled += dt * cfg.waveSpeed * cfg.animationSpeed * energy;

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      if (width < 40 || energy < 0.02) return;

      // Origin sits on the speaker cone in the background image, expressed as
      // a fraction of the viewport so it tracks the cover-positioned image.
      const coneOffset = Math.min(
        window.innerWidth * cfg.originXFraction,
        width * 0.8
      );
      const originX = side === "left" ? coneOffset : width - coneOffset;
      const originY = height * cfg.originYFraction;
      // Waves die out just before the inner canvas edge (lyrics clearance).
      const maxRadius = width - coneOffset;
      const phase = travelled % cfg.waveSpacing;
      const startAngle = 0;
      const endAngle = 2 * Math.PI;
      const [r, g, b] = hexToRgb(cfg.waveColor);
      const visible = Math.min(
        cfg.waveCount,
        Math.ceil(maxRadius / cfg.waveSpacing) + 1
      );

      ctx!.globalCompositeOperation = "lighter";
      ctx!.lineCap = "round";

      for (let k = 0; k < visible; k++) {
        const radius = phase + k * cfg.waveSpacing;
        if (radius < 1 || radius > maxRadius) continue;

        // Fade in near the emitter, fade out approaching the lyrics.
        const fadeIn = smoothstep(0, cfg.waveSpacing * 1.5, radius);
        const fadeOut = 1 - smoothstep(maxRadius - cfg.fadeDistance, maxRadius, radius);
        const alpha = cfg.waveOpacity * fadeIn * fadeOut * (0.35 + 0.65 * energy);
        if (alpha <= 0.004) continue;

        // Three-layer glow: soft outer bloom, mid bloom, bright core.
        if (cfg.waveGlow > 0) {
          ctx!.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.08 * cfg.waveGlow})`;
          ctx!.lineWidth = cfg.waveThickness * 6;
          ctx!.beginPath();
          ctx!.arc(originX, originY, radius, startAngle, endAngle);
          ctx!.stroke();

          ctx!.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.22 * cfg.waveGlow})`;
          ctx!.lineWidth = cfg.waveThickness * 2.6;
          ctx!.beginPath();
          ctx!.arc(originX, originY, radius, startAngle, endAngle);
          ctx!.stroke();
        }

        ctx!.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx!.lineWidth = cfg.waveThickness;
        ctx!.beginPath();
        ctx!.arc(originX, originY, radius, startAngle, endAngle);
        ctx!.stroke();
      }
    }

    function start() {
      if (running) return;
      running = true;
      lastTime = 0;
      resize();
      rafId = requestAnimationFrame(draw);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
    }

    function evaluate() {
      const enabled =
        desktop.matches && !reducedMotion.matches && !document.hidden;
      if (enabled) start();
      else stop();
    }

    evaluate();
    desktop.addEventListener("change", evaluate);
    reducedMotion.addEventListener("change", evaluate);
    document.addEventListener("visibilitychange", evaluate);
    window.addEventListener("resize", resize);

    return () => {
      stop();
      desktop.removeEventListener("change", evaluate);
      reducedMotion.removeEventListener("change", evaluate);
      document.removeEventListener("visibilitychange", evaluate);
      window.removeEventListener("resize", resize);
    };
  }, [side, centerClearWidth]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        [side]: 0,
        height: "100vh",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
