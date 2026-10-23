import type { SpursOidcConfig, SpursTokenSet, SpursUser } from "./types.js";
import { resolveIssuer } from "./constants.js";

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Random URL-safe token, for `state` and the PKCE verifier. */
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** S256 PKCE challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}

/**
 * Third-party OAuth2 / OpenID Connect client for Spurs Accounts.
 * Authorization-code flow with PKCE. Third-party apps appear under the user's
 * "Connected apps" and require consent — unlike first-party shared sessions.
 */
export class SpursOidcClient {
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes: string;
  private readonly clientSecret: string;

  constructor(config: SpursOidcConfig) {
    // Issuer ships with the SDK; only overridden for dev/staging.
    this.issuer = resolveIssuer(config.issuer);
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.scopes = config.scopes ?? "openid profile email";
  }

  get authorizeEndpoint(): string { return `${this.issuer}/oauth/authorize`; }
  get tokenEndpoint(): string { return `${this.issuer}/oauth/token`; }
  get userinfoEndpoint(): string { return `${this.issuer}/oauth/userinfo`; }
  get discoveryEndpoint(): string { return `${this.issuer}/.well-known/openid-configuration`; }

  /**
   * Start a login. Persist `state` + `codeVerifier` (e.g. httpOnly cookies) and
   * redirect the user to `url`.
   */
  async createAuthorizationUrl(): Promise<{ url: string; state: string; codeVerifier: string }> {
    const state = randomToken(16);
    const codeVerifier = randomToken(32);
    const challenge = await pkceChallenge(codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return { url: `${this.authorizeEndpoint}?${params}`, state, codeVerifier };
  }

  /** Swap the authorization code (+ PKCE verifier) for tokens. */
  async exchangeCode(code: string, codeVerifier: string): Promise<SpursTokenSet> {
    const res = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: codeVerifier,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`[spurs] token exchange failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<SpursTokenSet>;
  }

  /** Fetch the user's claims with an access token. */
  async fetchUserInfo(accessToken: string): Promise<SpursUser> {
    const res = await fetch(this.userinfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`[spurs] userinfo failed (${res.status}): ${await res.text()}`);
    return res.json() as Promise<SpursUser>;
  }

  /** Convenience: exchange the code and return the user in one call. */
  async handleCallback(code: string, codeVerifier: string): Promise<{ tokens: SpursTokenSet; user: SpursUser }> {
    const tokens = await this.exchangeCode(code, codeVerifier);
    const user = await this.fetchUserInfo(tokens.access_token);
    return { tokens, user };
  }
}

export function createOidcClient(config: SpursOidcConfig): SpursOidcClient {
  return new SpursOidcClient(config);
}
