export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getValidAccessToken } from "@/lib/tokens";
import { fetchLyrics } from "@/lib/lyrics-sync";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trackName = searchParams.get("track");
  const artist = searchParams.get("artist");
  const durationMs = Number(searchParams.get("duration")) || 0;

  if (!trackName || !artist) {
    return NextResponse.json(
      { error: "missing track and artist params" },
      { status: 400 }
    );
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(session.spotifyId);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "auth_failed";
    return NextResponse.json({ error: reason }, { status: 401 });
  }

  const lyrics = await fetchLyrics(trackName, artist, accessToken, durationMs);
  return NextResponse.json(lyrics);
}
