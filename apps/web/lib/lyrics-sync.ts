import type { LyricLine, LyricResult, TrackInfo } from "@/lib/types";

const LRC_LINE_RE = /\[(\d+):(\d+)(?:\.(\d+))?\](.*)/;

const lyricsCache = new Map<string, string>();

export function parseLrc(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const line of lrcText.split("\n")) {
    const match = LRC_LINE_RE.exec(line.trim());
    if (!match) continue;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    let fracStr = match[3] ?? "";
    const text = match[4].trim();

    if (!text) continue;

    let fracMs: number;
    if (fracStr.length === 2) {
      fracMs = parseInt(fracStr, 10) * 10;
    } else {
      fracMs = parseInt(fracStr.padEnd(3, "0"), 10);
    }

    const timestampMs = minutes * 60000 + seconds * 1000 + fracMs;
    lines.push({ timestampMs, text });
  }

  lines.sort((a, b) => a.timestampMs - b.timestampMs);
  return lines;
}

export function findActiveLine(
  progressMs: number,
  lyrics: LyricLine[]
): number {
  let lo = 0;
  let hi = lyrics.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lyrics[mid].timestampMs <= progressMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}

export function interpolateProgress(
  progressMs: number,
  lastPollTime: number,
  isPlaying: boolean,
  durationMs: number
): number {
  if (!isPlaying) return progressMs;

  const elapsed = Date.now() - lastPollTime;
  const estimated = progressMs + elapsed;

  if (durationMs > 0) {
    return Math.min(estimated, durationMs);
  }

  return estimated;
}

async function tryLrclib(track: TrackInfo): Promise<string | null> {
  const cacheKey = `${track.artist}-${track.trackName}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const params = new URLSearchParams({
      artist_name: track.artist,
      track_name: track.trackName,
      duration: String(Math.round(track.durationMs / 1000)),
    });

    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      signal: controller.signal,
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null) return null;

    const body = data as Record<string, unknown>;

    if (typeof body.syncedLyrics === "string" && body.syncedLyrics.length > 0) {
      lyricsCache.set(cacheKey, body.syncedLyrics);
      return body.syncedLyrics;
    }

    if (typeof body.plainLyrics === "string" && body.plainLyrics.length > 0) {
      console.warn(
        `No synced lyrics for "${track.trackName}" by ${track.artist}, falling back to plain lyrics`
      );
      lyricsCache.set(cacheKey, body.plainLyrics);
      return body.plainLyrics;
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchLyrics(
  trackName: string,
  artist: string,
  accessToken: string
): Promise<LyricResult> {
  const track: TrackInfo = {
    trackName,
    artist,
    trackId: "",
    durationMs: 0,
    albumArtUrl: null,
    isPlaying: false,
    progressMs: 0,
  };

  const lrclibResult = await tryLrclib(track);
  if (lrclibResult) {
    const lines = parseLrc(lrclibResult);
    if (lines.length > 0) {
      return { type: "synced", lines };
    }
    return { type: "unsynced", text: lrclibResult };
  }

  const searchTerm = `${artist} ${trackName}`;

  const spotifyResult = await trySpotifyLyrics(searchTerm, accessToken);
  if (spotifyResult) return spotifyResult;

  const musixmatchResult = await tryMusixmatch(searchTerm);
  if (musixmatchResult) return musixmatchResult;

  return { type: "unsynced", text: `Lyrics not found for "${trackName}" by ${artist}` };
}

async function trySpotifyLyrics(
  _searchTerm: string,
  _accessToken: string
): Promise<LyricResult | null> {
  return null;
}

async function tryMusixmatch(
  _searchTerm: string
): Promise<LyricResult | null> {
  return null;
}
