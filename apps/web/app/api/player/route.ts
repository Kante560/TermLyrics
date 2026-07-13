export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getValidAccessToken } from "@/lib/tokens";
import { player, SpotifyPlayerError } from "@/lib/spotify";

interface PlayerBody {
  action: string;
  positionMs?: number;
  state?: boolean | string;
  percent?: number;
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PlayerBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(session.spotifyId);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "auth_failed";
    return NextResponse.json({ error: reason }, { status: 401 });
  }

  try {
    switch (body.action) {
      case "play":
        await player.play(accessToken);
        break;
      case "pause":
        await player.pause(accessToken);
        break;
      case "next":
        await player.next(accessToken);
        break;
      case "previous":
        await player.previous(accessToken);
        break;
      case "seek":
        if (typeof body.positionMs !== "number") {
          return NextResponse.json({ error: "missing_positionMs" }, { status: 400 });
        }
        await player.seek(accessToken, body.positionMs);
        break;
      case "shuffle":
        await player.shuffle(accessToken, body.state === true);
        break;
      case "repeat":
        if (body.state !== "off" && body.state !== "context" && body.state !== "track") {
          return NextResponse.json({ error: "invalid_repeat_state" }, { status: 400 });
        }
        await player.repeat(accessToken, body.state);
        break;
      case "volume":
        if (typeof body.percent !== "number") {
          return NextResponse.json({ error: "missing_percent" }, { status: 400 });
        }
        await player.volume(accessToken, body.percent);
        break;
      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof SpotifyPlayerError) {
      return NextResponse.json(
        { error: err.reason, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json({ error: "player_command_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
