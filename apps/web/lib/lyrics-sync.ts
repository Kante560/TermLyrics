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

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractLyrics(body: Record<string, unknown>, track: TrackInfo): string | null {
  if (typeof body.syncedLyrics === "string" && body.syncedLyrics.length > 0) {
    return body.syncedLyrics;
  }
  if (typeof body.plainLyrics === "string" && body.plainLyrics.length > 0) {
    console.warn(
      `No synced lyrics for "${track.trackName}" by ${track.artist}, falling back to plain lyrics`
    );
    return body.plainLyrics;
  }
  return null;
}

async function tryLrclib(track: TrackInfo): Promise<string | null> {
  const cacheKey = `${track.artist}-${track.trackName}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached) return cached;

  const getParams = new URLSearchParams({
    artist_name: track.artist,
    track_name: track.trackName,
  });
  // lrclib rejects duration=0 with a 400; only send it when we know it
  if (track.durationMs > 0) {
    getParams.set("duration", String(Math.round(track.durationMs / 1000)));
  }

  // Two attempts against /api/get (network here can be slow/flaky), then /api/search.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetchWithTimeout(`https://lrclib.net/api/get?${getParams}`, 10000);
      if (res.status === 404) break; // definitive miss; go to search
      if (!res.ok) {
        console.warn(`[lyrics] lrclib /get returned ${res.status} for "${track.trackName}"`);
        continue;
      }
      const body = (await res.json()) as Record<string, unknown>;
      const lyrics = extractLyrics(body, track);
      if (lyrics) {
        lyricsCache.set(cacheKey, lyrics);
        return lyrics;
      }
      break;
    } catch (err) {
      console.warn(`[lyrics] lrclib /get attempt ${attempt} failed for "${track.trackName}":`, err);
    }
  }

  try {
    const searchParams = new URLSearchParams({
      artist_name: track.artist,
      track_name: track.trackName,
    });
    const res = await fetchWithTimeout(`https://lrclib.net/api/search?${searchParams}`, 10000);
    if (!res.ok) {
      console.warn(`[lyrics] lrclib /search returned ${res.status} for "${track.trackName}"`);
      return null;
    }
    const results = (await res.json()) as Array<Record<string, unknown>>;
    for (const body of results) {
      const lyrics = extractLyrics(body, track);
      if (lyrics) {
        lyricsCache.set(cacheKey, lyrics);
        return lyrics;
      }
    }
    return null;
  } catch (err) {
    console.warn(`[lyrics] lrclib /search failed for "${track.trackName}":`, err);
    return null;
  }
}

export async function fetchLyrics(
  trackName: string,
  artist: string,
  accessToken: string,
  durationMs = 0
): Promise<LyricResult> {
  const track: TrackInfo = {
    trackName,
    artist,
    trackId: "",
    durationMs,
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
