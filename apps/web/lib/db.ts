import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

export interface UserRow {
  spotify_id: string;
  email: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  created_at: Date;
}

export async function upsertUser(user: {
  spotifyId: string;
  email: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}) {
  await sql`
    INSERT INTO users (spotify_id, email, access_token, refresh_token, expires_at)
    VALUES (${user.spotifyId}, ${user.email}, ${user.accessToken}, ${user.refreshToken}, ${Math.floor(user.expiresAt.getTime() / 1000)})
    ON CONFLICT (spotify_id) DO UPDATE SET
      email = EXCLUDED.email,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at
  `;
}

export async function getUser(
  spotifyId: string
): Promise<UserRow | undefined> {
  const [row] = await sql`SELECT * FROM users WHERE spotify_id = ${spotifyId}`;
  return row as UserRow | undefined;
}

export async function updateTokens(
  spotifyId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresAt: Date }
) {
  const expiresAtUnix = Math.floor(tokens.expiresAt.getTime() / 1000);

  if (tokens.refreshToken) {
    await sql`
      UPDATE users
      SET access_token = ${tokens.accessToken}, refresh_token = ${tokens.refreshToken}, expires_at = ${expiresAtUnix}
      WHERE spotify_id = ${spotifyId}
    `;
  } else {
    await sql`
      UPDATE users
      SET access_token = ${tokens.accessToken}, expires_at = ${expiresAtUnix}
      WHERE spotify_id = ${spotifyId}
    `;
  }
}
