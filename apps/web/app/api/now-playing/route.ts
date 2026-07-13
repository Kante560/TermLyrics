export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getValidAccessToken } from "@/lib/tokens";
import { getCurrentPlayback } from "@/lib/spotify";
import type { TrackInfo } from "@/lib/types";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(session.spotifyId);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "auth_failed";
    return NextResponse.json({ error: reason }, { status: 401 });
  }

  let playback;
  try {
    playback = await getCurrentPlayback(accessToken);
  } catch {
    return NextResponse.json({ error: "spotify_unavailable" }, { status: 502 });
  }

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
    shuffleState: playback.shuffleState,
    repeatState: playback.repeatState,
    volumePercent: playback.volumePercent,
    deviceName: playback.deviceName,
  };

  return NextResponse.json(track);
}
