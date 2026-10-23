/** The authenticated Spurs user, as carried by the shared session or UserInfo. */
export interface SpursUser {
  /** Stable Spurs account id (the OIDC `sub`). Use this as your foreign key. */
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

/** Config for first-party apps that read the shared Spurs session cookie. */
export interface SpursConfig {
  /**
   * Shared HS256 secret used to sign the session cookie. Server-side only.
   * Falls back to the `SPURS_SESSION_SECRET` env var.
   */
  sessionSecret?: string;
  /**
   * Spurs Accounts base URL. Baked into the SDK — only set this for local dev
   * or staging (or use the `SPURS_ISSUER` env var).
   */
  issuer?: string;
  /** Cookie name. Defaults to `spurs_session`. */
  cookieName?: string;
}

/** Config for third-party apps using the OAuth2/OIDC authorization-code flow. */
export interface SpursOidcConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Optional override; defaults to the built-in Spurs Accounts issuer. */
  issuer?: string;
  /** Defaults to "openid profile email". */
  scopes?: string;
}

export interface SpursTokenSet {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}
