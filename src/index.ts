/**
 * @spurs-cloud/accounts — the Spurs Accounts SDK.
 *
 * Two ways to authenticate:
 *  1. First-party Spurs apps read the **shared session cookie** (no consent,
 *     signed in everywhere at once) — see `createSpursClient` / `spursFromEnv`.
 *  2. Third-party apps use **OAuth2 / OIDC** with PKCE and appear under the
 *     user's "Connected apps" — see `createOidcClient`.
 *
 * Next.js helpers live in `@spurs-cloud/accounts/next`.
 */
export { SpursClient, createSpursClient, spursFromEnv, readCookie } from "./session.js";
export { SpursOidcClient, createOidcClient, randomToken, pkceChallenge } from "./oidc.js";
export { SPURS_ISSUER, SPURS_SESSION_COOKIE, resolveIssuer } from "./constants.js";
export type { SpursUser, SpursConfig, SpursOidcConfig, SpursTokenSet } from "./types.js";
