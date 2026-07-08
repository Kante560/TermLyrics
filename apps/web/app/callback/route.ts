export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/spotify";
import { verifySession, createSession, COOKIE_NAME, MAX_AGE } from "@/lib/session";
import { upsertUser } from "@/lib/db";

function makeRedirect(url: string) {
  return NextResponse.redirect(new URL(url, "http://127.0.0.1:8888").toString());
}

export async function GET(request: Request) {
  console.log("[CALLBACK] HIT", request.url);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state") ?? "";
  const error = searchParams.get("error");

  if (error) {
    console.log("[CALLBACK] Spotify denied:", error);
    return makeRedirect("/login?error=spotify_denied");
  }

  const dotIdx = rawState.indexOf(".");
  const state = dotIdx >= 0 ? rawState.slice(0, dotIdx) : "";
  const stateToken = dotIdx >= 0 ? rawState.slice(dotIdx + 1) : "";

  if (!code || !state || !stateToken) {
    console.log("[CALLBACK] Missing params", { code: !!code, state: !!state, stateToken: !!stateToken });
    return makeRedirect("/login?error=missing_params");
  }

  console.log("[CALLBACK] Verifying state token");
  let storedState;
  try {
    storedState = await verifySession(stateToken);
  } catch (err) {
    console.log("[CALLBACK] State verification threw:", err);
    return makeRedirect("/login?error=state_mismatch");
  }

  if (!storedState || storedState.spotifyId !== state) {
    console.log("[CALLBACK] State mismatch", { stored: storedState?.spotifyId, expected: state });
    return makeRedirect("/login?error=state_mismatch");
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
    console.log("[CALLBACK] Token exchange succeeded");
  } catch (err) {
    console.log("[CALLBACK] Token exchange failed:", err);
    return makeRedirect("/login?error=exchange_failed");
  }

  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  console.log("[CALLBACK] Fetching Spotify user info");
  let meRes: Response;
  try {
    meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
  } catch (err) {
    console.log("[CALLBACK] /me fetch threw:", err);
    return makeRedirect("/login?error=userinfo_failed");
  }

  let spotifyId: string;
  let email: string | null = null;

  if (meRes.ok) {
    try {
      const me = await meRes.json();
      spotifyId = me.id;
      email = me.email ?? null;
      console.log("[CALLBACK] Spotify user:", spotifyId);
    } catch (err) {
      console.log("[CALLBACK] Failed to parse /me response:", err);
      return makeRedirect("/login?error=userinfo_failed");
    }
  } else {
    const text = await meRes.text();
    console.log("[CALLBACK] /me failed:", meRes.status, text);
    return makeRedirect("/login?error=userinfo_failed");
  }

  console.log("[CALLBACK] Upserting user in DB");
  try {
    await upsertUser({
      spotifyId,
      email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
    });
    console.log("[CALLBACK] DB upsert succeeded");
  } catch (err) {
    console.log("[CALLBACK] DB upsert failed:", err);
    return makeRedirect("/login?error=exchange_failed");
  }

  console.log("[CALLBACK] Creating session JWT");
  let sessionToken: string;
  try {
    sessionToken = await createSession({ spotifyId });
  } catch (err) {
    console.log("[CALLBACK] Failed to create session JWT:", err);
    return makeRedirect("/login?error=exchange_failed");
  }

  console.log("[CALLBACK] Redirecting to / with session cookie set");

  const response = NextResponse.redirect(new URL("/", "http://127.0.0.1:8888"));
  response.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return response;
}
