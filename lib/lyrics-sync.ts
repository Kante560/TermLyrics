import type { LyricLine, LyricResult } from "@/lib/types";

const LRC_LINE_RE = /\[(\d+):(\d+)(?:\.(\d+))?\](.*)/;

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

export async function fetchLyrics(
  trackName: string,
  artist: string,
  accessToken: string
): Promise<LyricResult> {
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
