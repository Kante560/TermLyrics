const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
];

function getClientCredentials(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Spotify credentials in env");
  }
  return { clientId, clientSecret, redirectUri };
}

export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret, redirectUri } = getClientCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}> {
  const { clientId, clientSecret } = getClientCredentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in,
  };
}

export class SpotifyPlayerError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason: string
  ) {
    super(message);
  }
}

/**
 * Sends a player command. Spotify returns 204 on success, 403 for
 * non-Premium accounts, 404 when there is no active device, and 429
 * with a Retry-After header when rate limited.
 */
async function playerCommand(
  accessToken: string,
  method: "PUT" | "POST",
  path: string
): Promise<void> {
  const res = await fetch(`${SPOTIFY_API_BASE}/me/player${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.ok) return;

  let reason = "unknown";
  if (res.status === 403) reason = "premium_required";
  else if (res.status === 404) reason = "no_active_device";
  else if (res.status === 429) reason = "rate_limited";

  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? "";
    if (body?.error?.reason) reason = String(body.error.reason).toLowerCase();
  } catch {
    // no JSON body
  }

  // A token issued before user-modify-playback-state was added also 403s;
  // that needs a re-login, not a Premium upsell.
  if (res.status === 403 && detail.toLowerCase().includes("scope")) {
    reason = "insufficient_scope";
  }

  throw new SpotifyPlayerError(
    detail || `Player command failed: ${res.status}`,
    res.status,
    reason
  );
}

export const player = {
  play: (token: string) => playerCommand(token, "PUT", "/play"),
  pause: (token: string) => playerCommand(token, "PUT", "/pause"),
  next: (token: string) => playerCommand(token, "POST", "/next"),
  previous: (token: string) => playerCommand(token, "POST", "/previous"),
  seek: (token: string, positionMs: number) =>
    playerCommand(token, "PUT", `/seek?position_ms=${Math.max(0, Math.round(positionMs))}`),
  shuffle: (token: string, state: boolean) =>
    playerCommand(token, "PUT", `/shuffle?state=${state}`),
  repeat: (token: string, state: "off" | "context" | "track") =>
    playerCommand(token, "PUT", `/repeat?state=${state}`),
  volume: (token: string, percent: number) =>
    playerCommand(
      token,
      "PUT",
      `/volume?volume_percent=${Math.min(100, Math.max(0, Math.round(percent)))}`
    ),
};

export async function getCurrentPlayback(accessToken: string): Promise<{
  trackName: string;
  artist: string;
  trackId: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  albumArtUrl: string | null;
  shuffleState: boolean;
  repeatState: "off" | "context" | "track";
  volumePercent: number | null;
  deviceName: string | null;
} | null> {
  // /me/player (playback state) rather than /currently-playing: same track
  // info plus shuffle/repeat/device/volume needed for the player controls.
  const res = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (res.status === 204) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status}`);
  }

  const data = await res.json();
  if (!data || !data.item) return null;

  const item = data.item;
  return {
    trackName: item.name,
    artist: item.artists.map((a: { name: string }) => a.name).join(", "),
    trackId: item.id,
    durationMs: item.duration_ms,
    progressMs: data.progress_ms,
    isPlaying: data.is_playing,
    albumArtUrl: item.album?.images?.[0]?.url ?? null,
    shuffleState: Boolean(data.shuffle_state),
    repeatState: (data.repeat_state ?? "off") as "off" | "context" | "track",
    volumePercent: data.device?.volume_percent ?? null,
    deviceName: data.device?.name ?? null,
  };
}
