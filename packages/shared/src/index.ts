export interface TrackInfo {
  trackName: string;
  artist: string;
  trackId: string;
  durationMs: number;
  albumArtUrl: string | null;
  isPlaying: boolean;
  progressMs: number;
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
