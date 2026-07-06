import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const getSecret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export const COOKIE_NAME = "session";
export const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload extends JWTPayload {
  spotifyId: string;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(
  request?: NextRequest
): Promise<SessionPayload | null> {
  if (request) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
  }

  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
