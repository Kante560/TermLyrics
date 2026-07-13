export interface TrackInfo {
  trackName: string;
  artist: string;
  trackId: string;
  durationMs: number;
  albumArtUrl: string | null;
  isPlaying: boolean;
  progressMs: number;
  shuffleState?: boolean;
  repeatState?: "off" | "context" | "track";
  volumePercent?: number | null;
  deviceName?: string | null;
}

export interface LyricLine {
  timestampMs: number;
  text: string;
}

export type LyricResult =
  | { type: "synced"; lines: LyricLine[] }
  | { type: "unsynced"; text: string };

export interface User {
  spotifyId: string;
  email: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}
