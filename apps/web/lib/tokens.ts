import { getUser, updateTokens } from "@/lib/db";
import { refreshAccessToken } from "@/lib/spotify";

/**
 * Returns a valid access token for the user, refreshing it if expired.
 * Throws "user_not_found" or "token_refresh_failed".
 */
export async function getValidAccessToken(spotifyId: string): Promise<string> {
  const user = await getUser(spotifyId);
  if (!user) {
    throw new Error("user_not_found");
  }

  const expiresAtMs = user.expires_at * 1000;
  if (Date.now() < expiresAtMs) {
    return user.access_token;
  }

  try {
    const refreshed = await refreshAccessToken(user.refresh_token);
    await updateTokens(spotifyId, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? undefined,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
    });
    return refreshed.accessToken;
  } catch {
    throw new Error("token_refresh_failed");
  }
}
