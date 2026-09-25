import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { recordPlatformRequest } from "@/lib/platform-telemetry";

export function proxy(_request: NextRequest, event: NextFetchEvent) {
  event.waitUntil(recordPlatformRequest().catch(() => undefined));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
