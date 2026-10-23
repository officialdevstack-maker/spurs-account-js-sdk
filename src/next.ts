/**
 * Next.js helpers (App Router). Import from `@spurs-cloud/accounts/next`.
 * Server-only — these read cookies and must not run in a client component.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { spursFromEnv, SpursClient } from "./session.js";
import { readEnv } from "./constants.js";
import type { SpursUser } from "./types.js";

let cached: SpursClient | undefined;

/** The env-configured client (`SPURS_ISSUER`, `SPURS_SESSION_SECRET`). */
export function spurs(): SpursClient {
  cached ??= spursFromEnv();
  return cached;
}

/** Current Spurs user in a server component / route handler, or null. */
export async function getSpursUser(client: SpursClient = spurs()): Promise<SpursUser | null> {
  const store = await cookies();
  return client.verify(store.get(client.cookieName)?.value);
}

/**
 * Require a signed-in user. Redirects to Spurs Accounts when signed out.
 * @param returnTo absolute URL to come back to (defaults to `APP_URL`).
 */
export async function requireSpursUser(
  returnTo: string = process.env.APP_URL ?? "/",
  client: SpursClient = spurs(),
): Promise<SpursUser> {
  const user = await getSpursUser(client);
  if (!user) redirect(client.loginUrl(returnTo));
  return user;
}

/**
 * Build a Next 16 `proxy` (formerly middleware) that gates paths behind Spurs.
 *
 * ```ts
 * // proxy.ts
 * import { createSpursProxy } from "@spurs-cloud/accounts/next";
 * export const proxy = createSpursProxy({ publicPaths: ["/", "/api/v1"] });
 * export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
 * ```
 */
export function createSpursProxy(
  options: {
    publicPaths?: string[];
    client?: SpursClient;
    /**
     * Public origin of this app, e.g. `https://wallet.spurs.com.ng`. Used to
     * build the `return_to` URL.
     *
     * Set this. Next's `request.url` reports the server's internal origin
     * (often `localhost`), and because the shared cookie is host-scoped,
     * returning to a different host than the one Accounts set it on causes a
     * redirect loop. Defaults to `APP_URL`, then `request.url`.
     */
    appUrl?: string;
  } = {},
) {
  const { publicPaths = [], client = spurs(), appUrl = readEnv().APP_URL } = options;

  return async function spursProxy(request: {
    nextUrl: { pathname: string; search?: string };
    url: string;
    cookies: { get(name: string): { value: string } | undefined };
  }) {
    const { NextResponse } = await import("next/server");
    const { pathname } = request.nextUrl;

    const isPublic = publicPaths.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));
    if (isPublic) return NextResponse.next();

    const user = await client.verify(request.cookies.get(client.cookieName)?.value);
    if (!user) {
      const returnTo = appUrl
        ? `${appUrl.replace(/\/$/, "")}${pathname}${request.nextUrl.search ?? ""}`
        : request.url;
      return NextResponse.redirect(client.loginUrl(returnTo));
    }
    return NextResponse.next();
  };
}
