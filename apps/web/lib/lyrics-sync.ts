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

/**
 * Spotify reports every credited artist ("taves, BNXN") and keeps feature
 * tags in the title ("CWT (feat. BNXN)"). lrclib indexes tracks
 * inconsistently: some under the joined artists, some under the primary
 * only; some with the feature tag in the title, some without. No single
 * spelling matches everything, so try the plausible ones.
 */
function artistCandidates(artist: string): string[] {
  const primary = artist.split(",")[0].trim();
  return primary && primary !== artist ? [artist, primary] : [artist];
}

function titleCandidates(trackName: string): string[] {
  const stripped = trackName
    .replace(/\s*[([](?:feat|ft|with)\.?\s[^)\]]*[)\]]/gi, "")
    .replace(/\s+-\s+(?:remaster(?:ed)?|radio edit|single version|live).*$/i, "")
    .trim();
  return stripped && stripped !== trackName ? [trackName, stripped] : [trackName];
}

async function lrclibGet(
  artist: string,
  title: string,
  track: TrackInfo,
  withDuration: boolean
): Promise<string | null> {
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  // lrclib rejects duration=0 with a 400, and matches it strictly when sent,
  // so it is worth one attempt with and one without.
  if (withDuration && track.durationMs > 0) {
    params.set("duration", String(Math.round(track.durationMs / 1000)));
  } else if (withDuration) {
    return null;
  }

  try {
    const res = await fetchWithTimeout(`https://lrclib.net/api/get?${params}`, 8000);
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[lyrics] lrclib /get returned ${res.status} for "${title}" by ${artist}`);
      return null;
    }
    return extractLyrics((await res.json()) as Record<string, unknown>, track);
  } catch (err) {
    console.warn(`[lyrics] lrclib /get failed for "${title}" by ${artist}:`, err);
    return null;
  }
}

async function lrclibSearch(
  artist: string,
  title: string,
  track: TrackInfo
): Promise<string | null> {
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  try {
    const res = await fetchWithTimeout(`https://lrclib.net/api/search?${params}`, 8000);
    if (!res.ok) {
      console.warn(`[lyrics] lrclib /search returned ${res.status} for "${title}" by ${artist}`);
      return null;
    }
    const results = (await res.json()) as Array<Record<string, unknown>>;
    // Prefer any result that carries synced lyrics over the first plain one.
    for (const body of results) {
      if (typeof body.syncedLyrics === "string" && body.syncedLyrics.length > 0) {
        return body.syncedLyrics;
      }
    }
    for (const body of results) {
      const lyrics = extractLyrics(body, track);
      if (lyrics) return lyrics;
    }
    return null;
  } catch (err) {
    console.warn(`[lyrics] lrclib /search failed for "${title}" by ${artist}:`, err);
    return null;
  }
}

async function tryLrclib(track: TrackInfo): Promise<string | null> {
  const cacheKey = `${track.artist}-${track.trackName}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached) return cached;

  const artists = artistCandidates(track.artist);
  const titles = titleCandidates(track.trackName);

  // /get is an exact match and returns the best-quality result, so exhaust
  // every spelling there before falling back to the fuzzier /search.
  for (const withDuration of [true, false]) {
    for (const artist of artists) {
      for (const title of titles) {
        const lyrics = await lrclibGet(artist, title, track, withDuration);
        if (lyrics) {
          lyricsCache.set(cacheKey, lyrics);
          return lyrics;
        }
      }
    }
  }

  for (const artist of artists) {
    for (const title of titles) {
      const lyrics = await lrclibSearch(artist, title, track);
      if (lyrics) {
        lyricsCache.set(cacheKey, lyrics);
        return lyrics;
      }
    }
  }

  console.warn(
    `[lyrics] no lrclib match for "${track.trackName}" by ${track.artist} ` +
      `(tried artists=${JSON.stringify(artists)} titles=${JSON.stringify(titles)})`
  );
  return null;
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
