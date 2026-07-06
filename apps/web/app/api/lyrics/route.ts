export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUser, updateTokens } from "@/lib/db";
import { refreshAccessToken } from "@/lib/spotify";
import { fetchLyrics } from "@/lib/lyrics-sync";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await getUser(session.spotifyId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trackName = searchParams.get("track");
  const artist = searchParams.get("artist");

  if (!trackName || !artist) {
    return NextResponse.json(
      { error: "missing track and artist params" },
      { status: 400 }
    );
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

  const lyrics = await fetchLyrics(trackName, artist, accessToken);
  return NextResponse.json(lyrics);
}
