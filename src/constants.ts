/**
 * Platform constants. The issuer is baked into the SDK — apps never need to
 * pass it. Override only when you need to point at a non-production Accounts
 * (local dev, staging) via the `SPURS_ISSUER` env var or an explicit `issuer`.
 */

/** Production Spurs Accounts. */
export const SPURS_ISSUER = "https://accounts.spurs.com.ng";

/** Cookie Spurs Accounts sets across all first-party apps. */
export const SPURS_SESSION_COOKIE = "spurs_session";

/** Safe `process.env` access (this package also runs on the edge / in browsers). */
export function readEnv(): Record<string, string | undefined> {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

/** Resolution order: explicit argument → `SPURS_ISSUER` env → built-in default. */
export function resolveIssuer(explicit?: string, env = readEnv()): string {
  return (explicit || env.SPURS_ISSUER || SPURS_ISSUER).replace(/\/$/, "");
}
