import { jwtVerify, SignJWT } from "jose";
import type { SpursConfig, SpursUser } from "./types.js";
import { SPURS_SESSION_COOKIE, readEnv, resolveIssuer } from "./constants.js";

export { SPURS_SESSION_COOKIE };

/** Read one cookie out of a raw `Cookie:` header. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * A first-party Spurs client. Verifies the shared session cookie and builds the
 * sign-in / sign-out URLs — no OAuth round-trip, no consent screen.
 */
export class SpursClient {
  readonly issuer: string;
  readonly cookieName: string;
  private readonly secret: Uint8Array;

  constructor(config: SpursConfig = {}) {
    const env = readEnv();
    const secret = config.sessionSecret || env.SPURS_SESSION_SECRET;
    if (!secret) {
      throw new Error("[spurs] a session secret is required — pass `sessionSecret` or set SPURS_SESSION_SECRET");
    }
    // Issuer is built into the SDK; apps only override it for dev/staging.
    this.issuer = resolveIssuer(config.issuer, env);
    this.cookieName = config.cookieName ?? env.SPURS_COOKIE_NAME ?? SPURS_SESSION_COOKIE;
    this.secret = secretKey(secret);
  }

  /** Verify a raw session token. Returns the user, or null when absent/invalid/expired. */
  async verify(token: string | undefined | null): Promise<SpursUser | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
      if (!payload.sub) return null;
      return {
        sub: payload.sub,
        name: payload.name as string | undefined,
        username: payload.username as string | undefined,
        email: payload.email as string | undefined,
        email_verified: payload.email_verified as boolean | undefined,
        kyc_level: (payload.kyc_level ?? payload.kyc) as number | undefined,
        kyc_status: payload.kyc_status as SpursUser["kyc_status"],
        picture: payload.picture as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /** Verify straight from a raw `Cookie:` header (Express, Hono, plain Node…). */
  async userFromCookieHeader(header: string | null | undefined): Promise<SpursUser | null> {
    return this.verify(readCookie(header, this.cookieName));
  }

  /** Verify straight from a Fetch API `Request`. */
  async userFromRequest(request: { headers: { get(name: string): string | null } }): Promise<SpursUser | null> {
    return this.userFromCookieHeader(request.headers.get("cookie"));
  }

  /** Where to send a signed-out visitor. Accounts bounces them back to `returnTo`. */
  loginUrl(returnTo: string): string {
    return `${this.issuer}/sso/continue?return_to=${encodeURIComponent(returnTo)}`;
  }

  /** Full Spurs sign-out (clears the shared cookie for every app). */
  logoutUrl(returnTo?: string): string {
    const base = `${this.issuer}/logout`;
    return returnTo ? `${base}?return_to=${encodeURIComponent(returnTo)}` : base;
  }

  /** Manage-account URL, for the shared avatar menu. */
  accountUrl(): string {
    return `${this.issuer}/me`;
  }

  /**
   * Issue a session token. Only Spurs Accounts itself should call this —
   * consumer apps verify, they never mint sessions.
   * @internal
   */
  async issue(user: SpursUser, expiresIn = "7d"): Promise<string> {
    return new SignJWT({
      name: user.name,
      username: user.username,
      email: user.email,
      email_verified: user.email_verified,
      kyc_level: user.kyc_level,
      kyc_status: user.kyc_status,
      picture: user.picture,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.sub)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.secret);
  }
}

/**
 * Build a client. Everything is optional — the issuer ships with the SDK and the
 * secret falls back to `SPURS_SESSION_SECRET`, so usually this is just:
 *
 * ```ts
 * const spurs = createSpursClient();
 * ```
 */
export function createSpursClient(config: SpursConfig = {}): SpursClient {
  return new SpursClient(config);
}

/** Alias of `createSpursClient()` for apps that configure purely by env. */
export function spursFromEnv(env: Record<string, string | undefined> = readEnv()): SpursClient {
  return new SpursClient({
    issuer: env.SPURS_ISSUER,
    sessionSecret: env.SPURS_SESSION_SECRET,
    cookieName: env.SPURS_COOKIE_NAME,
  });
}
