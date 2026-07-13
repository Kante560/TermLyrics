export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getValidAccessToken } from "@/lib/tokens";
import { getUserProfile } from "@/lib/spotify";

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

  try {
    const profile = await getUserProfile(accessToken);
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: "spotify_unavailable" }, { status: 502 });
  }
}
