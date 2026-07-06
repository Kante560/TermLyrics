"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TrackInfo, LyricLine, LyricResult } from "@/lib/types";
import { findActiveLine, interpolateProgress } from "@/lib/lyrics-sync";

const POLL_INTERVAL = 2000;
const RENDER_INTERVAL = 250;

export default function DashboardPage() {
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [lyricResult, setLyricResult] = useState<LyricResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [estimatedProgress, setEstimatedProgress] = useState(0);
  const lastPollRef = useRef(0);
  const trackIdRef = useRef<string | null>(null);

  const pollNowPlaying = useCallback(async () => {
    try {
      const res = await fetch("/api/now-playing");
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        return;
      }
      const data: TrackInfo | { playing: false } = await res.json();
      if ("playing" in data && !data.playing) {
        setTrack(null);
        setLyricResult(null);
        setActiveIndex(-1);
        return;
      }
      const t = data as TrackInfo;
      setTrack(t);
      lastPollRef.current = Date.now();
      setEstimatedProgress(t.progressMs);

      if (t.trackId !== trackIdRef.current) {
        trackIdRef.current = t.trackId;
        fetchLyrics(t.trackName, t.artist);
      }
    } catch {
      // ignore network errors
    }
  }, []);

  const fetchLyrics = useCallback(async (trackName: string, artist: string) => {
    try {
      const res = await fetch(
        `/api/lyrics?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artist)}`
      );
      if (!res.ok) return;
      const data: LyricResult = await res.json();
      setLyricResult(data);
      setActiveIndex(-1);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    pollNowPlaying();
    const pollTimer = setInterval(pollNowPlaying, POLL_INTERVAL);
    return () => clearInterval(pollTimer);
  }, [pollNowPlaying]);

  useEffect(() => {
    const renderTimer = setInterval(() => {
      setEstimatedProgress((prev) => {
        if (!track?.isPlaying) return prev;
        const elapsed = Date.now() - lastPollRef.current;
        const estimated = track.progressMs + elapsed;
        return track.durationMs > 0 ? Math.min(estimated, track.durationMs) : estimated;
      });
    }, RENDER_INTERVAL);
    return () => clearInterval(renderTimer);
  }, [track]);

  useEffect(() => {
    if (lyricResult?.type !== "synced") return;
    const idx = findActiveLine(estimatedProgress, lyricResult.lines);
    if (idx >= 0) {
      setActiveIndex(idx);
    }
  }, [estimatedProgress, lyricResult]);

  if (!track) {
    return (
      <main style={containerStyle}>
        <p style={{ color: "var(--muted)", fontSize: "1.125rem" }}>
          No track playing. Open Spotify and play something.
        </p>
      </main>
    );
  }

  

  const lines = lyricResult?.type === "synced" ? lyricResult.lines : null;
  const unsyncedText = lyricResult?.type === "unsynced" ? lyricResult.text : null;

  return (
    <main style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <h2 style={trackNameStyle}>{track.trackName}</h2>
          <p style={artistStyle}>{track.artist}</p>
        </div>
        {track.albumArtUrl && (
          <img
            src={track.albumArtUrl}
            alt="Album art"
            style={{ width: 56, height: 56, borderRadius: 4, objectFit: "cover" }}
          />
        )}
      </header>

      <ProgressBar
        progressMs={estimatedProgress}
        durationMs={track.durationMs}
      />

      <section style={lyricsContainerStyle}>
        {lines ? (
          <SyncedLyrics lines={lines} activeIndex={activeIndex} progressMs={estimatedProgress} />
        ) : unsyncedText ? (
          <p style={{ color: "var(--muted)", whiteSpace: "pre-wrap" }}>{unsyncedText}</p>
        ) : (
          <p style={{ color: "var(--muted)" }}>Loading lyrics...</p>
        )}
      </section>
    </main>
  );
}

function ProgressBar({
  progressMs,
  durationMs,
}: {
  progressMs: number;
  durationMs: number;
}) {
  const pct = durationMs > 0 ? Math.min((progressMs / durationMs) * 100, 100) : 0;
  const current = formatTime(progressMs);
  const total = formatTime(durationMs);

  return (
    <div style={progressBarContainerStyle}>
      <span style={timeStyle}>{current}</span>
      <div style={progressTrackStyle}>
        <div style={{ ...progressFillStyle, width: `${pct}%` }} />
      </div>
      <span style={timeStyle}>{total}</span>
    </div>
  );
}

function SyncedLyrics({
  lines,
  activeIndex,
  progressMs,
}: {
  lines: LyricLine[];
  activeIndex: number;
  progressMs: number;
}) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  const startIdx = Math.max(0, activeIndex - 2);
  const endIdx = Math.min(lines.length, activeIndex + 3);
  const visible = lines.slice(startIdx, endIdx);

  return (
    <div style={lyricsScrollStyle}>
      {visible.map((line, i) => {
        const realIdx = startIdx + i;
        const isActive = realIdx === activeIndex;
        const nextLine = lines[realIdx + 1];
        const lineProgress =
          isActive && nextLine
            ? (progressMs - line.timestampMs) /
              (nextLine.timestampMs - line.timestampMs)
            : 0;

        return (
          <div
            key={realIdx}
            ref={isActive ? activeRef : null}
            style={{
              ...lyricLineStyle,
              color: isActive ? "var(--accent)" : "var(--muted)",
              fontWeight: isActive ? 700 : 400,
            }}
          >
            {isActive ? (
              <KaraokeLine text={line.text} progress={lineProgress} />
            ) : (
              line.text
            )}
          </div>
        );
      })}
    </div>
  );
}

function KaraokeLine({
  text,
  progress,
}: {
  text: string;
  progress: number;
}) {
  const chars = text.length;
  const filled = Math.floor(chars * Math.min(Math.max(progress, 0), 1));

  return (
    <span>
      <span style={{ color: "var(--accent)" }}>{text.slice(0, filled)}</span>
      <span style={{ color: "var(--fg)" }}>{text.slice(filled)}</span>
    </span>
  );
}

function formatTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const containerStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  padding: "2rem 1rem",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const trackNameStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
};

const artistStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--muted)",
  marginTop: "0.25rem",
};

const progressBarContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const timeStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--muted)",
  fontVariantNumeric: "tabular-nums",
  minWidth: "3.5ch",
};

const progressTrackStyle: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: "var(--surface)",
  borderRadius: 2,
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  background: "var(--accent)",
  borderRadius: 2,
  transition: "width 0.25s linear",
};

const lyricsContainerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const lyricsScrollStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  fontSize: "1.375rem",
  lineHeight: 1.5,
  textAlign: "center",
};

const lyricLineStyle: React.CSSProperties = {
  transition: "color 0.15s",
};
