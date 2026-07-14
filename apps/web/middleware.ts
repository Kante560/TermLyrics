import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/session";

const publicRoutes = ["/login", "/api/auth/login", "/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The landing page is the root and is public for everyone —
  // logged-in or not, arrivals see it first.
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Old bookmarks from when the landing lived at /landing.
  if (pathname === "/landing") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const session = await getSession(request);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|svg|gif|webp|ico)$).*)",
  ],
};
