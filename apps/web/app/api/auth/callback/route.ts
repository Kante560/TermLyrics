export const dynamic = "force-dynamic";

import { exchangeCode } from "@/lib/spotify";
import { verifySession, createSession, COOKIE_NAME, MAX_AGE } from "@/lib/session";
import { upsertUser } from "@/lib/db";

function redirect(url: string, status = 302) {
  return new Response(null, { status, headers: { location: url } });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawState = searchParams.get("state") ?? "";
  const error = searchParams.get("error");

  if (error) {
    return redirect("/login?error=spotify_denied");
  }

  const dotIdx = rawState.indexOf(".");
  const state = dotIdx >= 0 ? rawState.slice(0, dotIdx) : "";
  const stateToken = dotIdx >= 0 ? rawState.slice(dotIdx + 1) : "";

  if (!code || !state || !stateToken) {
    return redirect("/login?error=missing_params");
  }

  const storedState = await verifySession(stateToken);

  if (!storedState || storedState.spotifyId !== state) {
    return redirect("/login?error=state_mismatch");
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch {
    return redirect("/login?error=exchange_failed");
  }

  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  let spotifyId: string;
  let email: string | null = null;

  if (meRes.ok) {
    const me = await meRes.json();
    spotifyId = me.id;
    email = me.email ?? null;
  } else {
    return redirect("/login?error=userinfo_failed");
  }

  await upsertUser({
    spotifyId,
    email,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
  });

  const sessionToken = await createSession({ spotifyId });
  const redirectUrl = new URL("/", request.url).toString();

  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head><body><script>location.href=${JSON.stringify(redirectUrl)}</script></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html",
      "set-cookie": `${COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`,
    },
  });
}
