export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUser, updateTokens } from "@/lib/db";
import { getCurrentPlayback, refreshAccessToken } from "@/lib/spotify";
import type { TrackInfo } from "@termlyrics/shared";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await getUser(session.spotifyId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  let accessToken = user.access_token;
  let expiresAtMs = user.expires_at * 1000;

  if (Date.now() >= expiresAtMs) {
    try {
      const refreshed = await refreshAccessToken(user.refresh_token);
      accessToken = refreshed.accessToken;
      expiresAtMs = Date.now() + refreshed.expiresIn * 1000;
      await updateTokens(session.spotifyId, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? undefined,
        expiresAt: new Date(expiresAtMs),
      });
    } catch {
      return NextResponse.json({ error: "token_refresh_failed" }, { status: 401 });
    }
  }

  const playback = await getCurrentPlayback(accessToken);
  if (!playback) {
    return NextResponse.json({ playing: false });
  }

  const track: TrackInfo = {
    trackName: playback.trackName,
    artist: playback.artist,
    trackId: playback.trackId,
    durationMs: playback.durationMs,
    albumArtUrl: playback.albumArtUrl,
    isPlaying: playback.isPlaying,
    progressMs: playback.progressMs,
  };

  return NextResponse.json(track);
}
