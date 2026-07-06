export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/spotify";
import { createSession } from "@/lib/session";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const stateToken = await createSession({ spotifyId: state });
  const encodedState = `${state}.${stateToken}`;
  const authorizeUrl = getAuthorizationUrl(encodedState);

  return NextResponse.redirect(authorizeUrl);
}
