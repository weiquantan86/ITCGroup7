import { NextRequest, NextResponse } from "next/server";

const MOBILE_UA_REGEX =
  /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS/i;
const MOBILE_BLOCKED_PATH = "/mobile-blocked";

function isMobileRequest(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  const chUaMobile = request.headers.get("sec-ch-ua-mobile");
  return chUaMobile === "?1" || MOBILE_UA_REGEX.test(ua);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === MOBILE_BLOCKED_PATH) {
    return NextResponse.next();
  }

  if (!isMobileRequest(request)) {
    return NextResponse.next();
  }

  const blockedUrl = request.nextUrl.clone();
  blockedUrl.pathname = MOBILE_BLOCKED_PATH;
  blockedUrl.search = "";

  return NextResponse.redirect(blockedUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
