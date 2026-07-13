"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Shuffle, SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, Crown, Star } from "lucide-react";
import type { TrackInfo, LyricLine, LyricResult } from "@/lib/types";
import { findActiveLine } from "@/lib/lyrics-sync";
import SoundWaveCanvas from "@/components/SoundWaveCanvas";

const POLL_INTERVAL = 2000;
const RENDER_INTERVAL = 250;

type PlayerAction =
  | { action: "play" | "pause" | "next" | "previous" }
  | { action: "seek"; positionMs: number }
  | { action: "shuffle"; state: boolean }
  | { action: "repeat"; state: "off" | "context" | "track" }
  | { action: "volume"; percent: number };

export default function DashboardPage() {
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [lyricResult, setLyricResult] = useState<LyricResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [estimatedProgress, setEstimatedProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const lastPollRef = useRef(0);
  const trackIdRef = useRef<string | null>(null);
  const lastLyricsTrackRef = useRef<string | null>(null);
  const lyricsRetriesRef = useRef(0);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  }, []);

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
        if (t.trackId !== lastLyricsTrackRef.current) {
          lastLyricsTrackRef.current = t.trackId;
          lyricsRetriesRef.current = 0;
        }
        trackIdRef.current = t.trackId;
        fetchLyrics(t.trackName, t.artist, t.durationMs);
      }
    } catch {
      // ignore network errors
    }
  }, []);

  const fetchLyrics = useCallback(async (trackName: string, artist: string, durationMs: number) => {
    try {
      const res = await fetch(
        `/api/lyrics?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artist)}&duration=${durationMs}`
      );
      if (!res.ok) return;
      const data: LyricResult = await res.json();
      setLyricResult(data);
      setActiveIndex(-1);

      // A "not found" can be a transient network failure server-side;
      // allow the next poll to refetch this track a couple of times.
      const notFound =
        data.type === "unsynced" && data.text.startsWith("Lyrics not found");
      if (notFound && lyricsRetriesRef.current < 2) {
        lyricsRetriesRef.current += 1;
        trackIdRef.current = null;
      }
    } catch {
      // ignore
    }
  }, []);

  const sendPlayerAction = useCallback(
    async (body: PlayerAction) => {
      try {
        const res = await fetch("/api/player", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.error === "insufficient_scope") {
            // Session predates the playback scope; re-consent picks it up.
            window.location.href = "/api/auth/login";
          } else if (data?.error === "premium_required") {
            showNotice("Playback controls require Spotify Premium.");
          } else if (data?.error === "no_active_device") {
            showNotice("No active Spotify device found. Start playback in Spotify first.");
          } else if (res.status === 401) {
            // Old session without the playback scope: re-login picks it up.
            window.location.href = "/api/auth/login";
          } else {
            showNotice("Playback command failed.");
          }
          return;
        }
        // Refresh state shortly after a successful command.
        setTimeout(pollNowPlaying, 300);
      } catch {
        showNotice("Network error sending playback command.");
      }
    },
    [pollNowPlaying, showNotice]
  );

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

  const handleSeek = useCallback(
    (fraction: number) => {
      if (!track || track.durationMs <= 0) return;
      const positionMs = Math.round(fraction * track.durationMs);
      setEstimatedProgress(positionMs);
      sendPlayerAction({ action: "seek", positionMs });
    },
    [track, sendPlayerAction]
  );

  const cycleRepeat = useCallback(() => {
    const order: Array<"off" | "context" | "track"> = ["off", "context", "track"];
    const current = track?.repeatState ?? "off";
    const next = order[(order.indexOf(current) + 1) % order.length];
    sendPlayerAction({ action: "repeat", state: next });
  }, [track, sendPlayerAction]);

  return (
    <>
      <div style={backgroundStyle} aria-hidden="true" />
      <SoundWaveCanvas side="left" isPlaying={Boolean(track?.isPlaying)} />
      <SoundWaveCanvas side="right" isPlaying={Boolean(track?.isPlaying)} />

      <main style={containerStyle}>
        <TopBar />

      {notice && <div style={noticeStyle}>{notice}</div>}

      {!track ? (
        <div style={lyricsContainerStyle}>
          <p style={{ color: "var(--muted)", fontSize: "1.125rem" }}>
            No track playing. Open Spotify and play something.
          </p>
        </div>
      ) : (
        <>
          <header style={headerStyle}>
            <div style={{ minWidth: 0 }}>
              <h2 style={trackNameStyle}>{track.trackName}</h2>
              <p style={artistStyle}>
                {track.artist}
                {track.deviceName ? ` · ${track.deviceName}` : ""}
              </p>
            </div>
            {track.albumArtUrl && (
              <img
                src={track.albumArtUrl}
                alt="Album art"
                style={albumArtStyle}
              />
            )}
          </header>

          <SeekBar
            progressMs={estimatedProgress}
            durationMs={track.durationMs}
            onSeek={handleSeek}
          />

          <PlayerControls
            isPlaying={track.isPlaying}
            shuffle={track.shuffleState ?? false}
            repeat={track.repeatState ?? "off"}
            volume={track.volumePercent ?? null}
            onPlayPause={() =>
              sendPlayerAction({ action: track.isPlaying ? "pause" : "play" })
            }
            onNext={() => sendPlayerAction({ action: "next" })}
            onPrevious={() => sendPlayerAction({ action: "previous" })}
            onShuffle={() =>
              sendPlayerAction({ action: "shuffle", state: !(track.shuffleState ?? false) })
            }
            onRepeat={cycleRepeat}
            onVolume={(percent) => sendPlayerAction({ action: "volume", percent })}
          />

          <section style={lyricsContainerStyle}>
            {lyricResult?.type === "synced" ? (
              <SyncedLyrics
                lines={lyricResult.lines}
                activeIndex={activeIndex}
                progressMs={estimatedProgress}
              />
            ) : lyricResult?.type === "unsynced" ? (
              <p style={{ color: "var(--muted)", whiteSpace: "pre-wrap", textAlign: "center" }}>
                {lyricResult.text}
              </p>
            ) : (
              <p style={{ color: "var(--muted)" }}>Loading lyrics...</p>
            )}
          </section>
        </>
      )}
      </main>
    </>
  );
}

function TopBar() {
  const [product, setProduct] = useState<"premium" | "free" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.product === "premium" || data?.product === "free") {
          setProduct(data.product);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={topBarStyle}>
      <div style={brandStyle}>
        <span style={logoStyle}>Kant_Sing</span>
        {product && (
          <span
            style={product === "premium" ? premiumBadgeStyle : freeBadgeStyle}
            title={
              product === "premium"
                ? "Spotify Premium account"
                : "Spotify Free account"
            }
          >
            {product === "premium" ? (
              <Crown size={12} strokeWidth={2.5} />
            ) : (
              <Star size={12} strokeWidth={2.5} />
            )}
            {product === "premium" ? "Premium" : "Free"}
          </span>
        )}
      </div>
      <a href="/api/auth/logout" style={logoutStyle}>
        Log out
      </a>
    </div>
  );
}


function SeekBar({
  progressMs,
  durationMs,
  onSeek,
}: {
  progressMs: number;
  durationMs: number;
  onSeek: (fraction: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = durationMs > 0 ? Math.min((progressMs / durationMs) * 100, 100) : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onSeek(Math.min(Math.max(fraction, 0), 1));
  };

  return (
    <div style={progressBarContainerStyle}>
      <span style={timeStyle}>{formatTime(progressMs)}</span>
      <div
        ref={trackRef}
        onClick={handleClick}
        style={{ ...progressTrackStyle, cursor: "pointer" }}
        title="Seek"
      >
        <div style={{ ...progressFillStyle, width: `${pct}%` }} />
      </div>
      <span style={timeStyle}>{formatTime(durationMs)}</span>
    </div>
  );
}

function PlayerControls({
  isPlaying,
  shuffle,
  repeat,
  volume,
  onPlayPause,
  onNext,
  onPrevious,
  onShuffle,
  onRepeat,
  onVolume,
}: {
  isPlaying: boolean;
  shuffle: boolean;
  repeat: "off" | "context" | "track";
  volume: number | null;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onVolume: (percent: number) => void;
}) {
  const repeatTitle =
    repeat === "off"
      ? "Repeat: off (click for repeat all)"
      : repeat === "context"
        ? "Repeat: all (click for repeat one)"
        : "Repeat: one (click to turn off)";

  return (
    <div style={controlsRowStyle}>
      <button
        onClick={onShuffle}
        style={{ ...smallButtonStyle, color: shuffle ? "var(--accent)" : "var(--muted)" }}
        title={`Shuffle: ${shuffle ? "on" : "off"}`}
        aria-label="Toggle shuffle"
        aria-pressed={shuffle}
      >
        <Shuffle size={18} />
      </button>

      <button onClick={onPrevious} style={controlButtonStyle} title="Previous" aria-label="Previous track">
        <SkipBack size={24} fill="currentColor" />
      </button>
      <button onClick={onPlayPause} style={playButtonStyle} title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <button onClick={onNext} style={controlButtonStyle} title="Next" aria-label="Next track">
        <SkipForward size={24} fill="currentColor" />
      </button>

      <button
        onClick={onRepeat}
        style={{
          ...smallButtonStyle,
          color: repeat !== "off" ? "var(--accent)" : "var(--muted)",
        }}
        title={repeatTitle}
        aria-label={repeatTitle}
      >
        {repeat === "track" ? <Repeat1 size={18} /> : <Repeat size={18} />}
      </button>

      {volume !== null && (
        <input
          type="range"
          min={0}
          max={100}
          defaultValue={volume}
          onMouseUp={(e) => onVolume(Number((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => onVolume(Number((e.target as HTMLInputElement).value))}
          style={volumeStyle}
          title="Volume"
          aria-label="Volume"
        />
      )}
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
  padding: "1rem 1rem 2rem",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  position: "relative",
  zIndex: 2,
};

const backgroundStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(10,10,10,0.45), rgba(10,10,10,0.45)), url('/speakers-bg.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  zIndex: 0,
  pointerEvents: "none",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: "0.5rem",
  borderBottom: "1px solid var(--surface)",
};

const logoStyle: React.CSSProperties = {
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "var(--accent)",
};

const brandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const tierBadgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.125rem 0.5rem",
  borderRadius: 999,
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  lineHeight: 1.6,
};

const premiumBadgeStyle: React.CSSProperties = {
  ...tierBadgeBase,
  color: "#1a1200",
  background: "linear-gradient(135deg, #f5d76e, #d4a017, #f5d76e)",
  boxShadow: "0 0 8px rgba(212, 160, 23, 0.45)",
};

const freeBadgeStyle: React.CSSProperties = {
  ...tierBadgeBase,
  color: "var(--muted)",
  background: "var(--surface)",
  border: "1px solid var(--muted)",
};

const logoutStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: "0.875rem",
  textDecoration: "none",
  padding: "0.375rem 0.75rem",
  border: "1px solid var(--surface)",
  borderRadius: 6,
};

const noticeStyle: React.CSSProperties = {
  background: "var(--surface)",
  color: "var(--fg)",
  padding: "0.625rem 1rem",
  borderRadius: 8,
  fontSize: "0.875rem",
  textAlign: "center",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
};

const albumArtStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 6,
  objectFit: "cover",
  flexShrink: 0,
};

const trackNameStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const artistStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--muted)",
  marginTop: "0.25rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
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
  height: 6,
  background: "var(--surface)",
  borderRadius: 3,
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  background: "var(--accent)",
  borderRadius: 3,
  transition: "width 0.25s linear",
};

const controlsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
};

const controlButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--fg)",
  cursor: "pointer",
  padding: "0.375rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const playButtonStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "none",
  color: "var(--fg)",
  fontSize: "1.5rem",
  cursor: "pointer",
  width: 56,
  height: 56,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

const smallButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0.375rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const volumeStyle: React.CSSProperties = {
  width: 90,
  accentColor: "var(--accent)",
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
