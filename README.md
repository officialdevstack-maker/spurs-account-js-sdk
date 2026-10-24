# @spurs-cloud/accounts

The **Spurs Accounts SDK** for JavaScript / TypeScript.

Two integration modes:

| Mode | Who | How it works |
|---|---|---|
| **Shared session** | First-party Spurs apps (baas, pay, wallet, cloud) | Reads the `spurs_session` cookie issued by Accounts. One sign-in covers every app, no consent screen, and the app never shows up under "Connected apps". |
| **OAuth2 / OIDC** | Third-party apps | Authorization-code flow with PKCE. Requires consent and appears under the user's "Connected apps". |

---

## Install (from GitHub)

```bash
npm install github:spurs-cloud/accounts-js
# pin a tag
npm install github:spurs-cloud/accounts-js#v0.1.0
```

The package builds itself on install (`prepare` → `tsc`), so no publish step is needed.

> Installing from a **subdirectory** of a monorepo isn't supported by npm. Either
> mirror this folder to its own repo (`spurs-cloud/accounts-js`), or use pnpm/yarn:
> `pnpm add "github:spurs-cloud/spurs#path:products/sdks/accounts/js"`

---

## Configuration

The **issuer ships with the SDK** — you never pass it. The only thing an app
needs is the shared secret:

```bash
SPURS_SESSION_SECRET=<shared HS256 secret>
```

Override the issuer *only* for local dev or staging:

```bash
SPURS_ISSUER=http://127.0.0.1:8000     # optional
```

---

## First-party apps (shared session)

### Next.js (App Router)

```ts
// any server component
import { getSpursUser, requireSpursUser } from "@spurs-cloud/accounts/next";

const user = await getSpursUser();        // SpursUser | null
const me   = await requireSpursUser();    // redirects to Accounts when signed out
```

Gate the whole app in `proxy.ts` (Next 16 renamed `middleware` → `proxy`):

```ts
import { createSpursProxy } from "@spurs-cloud/accounts/next";

export const proxy = createSpursProxy({ publicPaths: ["/", "/api/v1", "/api/private"] });
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

> **Important:** the shared cookie is scoped to a host. In development every app
> must sit on the *same* host (all `127.0.0.1`, or all `localhost`). In production
> set the cookie domain to `.spurs.com.ng`.

### Any other runtime

```ts
import { createSpursClient } from "@spurs-cloud/accounts";

const spurs = createSpursClient();   // issuer built in, secret from env

const user = await spurs.userFromRequest(request);   // Fetch API Request
if (!user) return Response.redirect(spurs.loginUrl("https://myapp.spurs.com.ng"));
```

`SpursUser` includes `username`, `email_verified`, `kyc_level`, and
`kyc_status` when those claims are present in the shared session. For OIDC
integrations, request the `roles` scope to receive KYC status and level.

Useful URLs for your account menu:

```ts
spurs.accountUrl();            // .../me
spurs.logoutUrl(returnTo);     // full Spurs sign-out
```

---

## The shared sign-in button and account menu

Add a Spurs SSO button anywhere:

```tsx
import { SpursSignInButton } from "@spurs-cloud/accounts/react";

<SpursSignInButton /> // returns to the current page after sign-in
<SpursSignInButton returnTo="/dashboard" /> // app-relative paths are supported
```

The same avatar + menu can be reused across every Spurs app:

```tsx
// a server component gets the user…
import { getSpursUser } from "@spurs-cloud/accounts/next";
import { SpursAccountMenu } from "@spurs-cloud/accounts/react";

const user = await getSpursUser();

<SpursAccountMenu user={user} />
```

The user prop is optional: omitting it (or passing `null`) shows a
"Sign in with Spurs" button. For signed-in users, the menu opens on click and
shows their profile picture when available (otherwise initials), name, email,
**Manage your Spurs Account** → Accounts, and **Sign out**. `picture` is read
from the shared session claims and replaces the fallback accent in the avatar.

The menu panel uses inline styles so it renders consistently across apps. The
sign-in button and avatar trigger accept Tailwind `className` overrides, merged
with defaults via `cn` (`clsx` + `tailwind-merge`). Make sure your Tailwind build
scans this package for the components' default utility classes. Both components
use Spurs indigo by default; set the same `accent` in each app to share another
fallback avatar color:

| Prop | Default | Notes |
| --- | --- | --- |
| `user` | `undefined` | `{ name, email, picture? }` or `null`; omit to show sign-in |
| `accent` / `accentTo` | Spurs indigo | Fallback avatar gradient when no picture is available |
| `signOutUrl` / `onSignOut` | Spurs sign-out | Use `onSignOut` to POST your own logout route |
| `signInUrl` | Spurs SSO | Where guests go |
| `size` | `36` | Avatar diameter (px) |
| `align` | `"right"` | Popover side |
| `theme` | `"light"` | `"dark"` for dark surfaces |
| `children` | — | Extra menu links above "Sign out" |
| `className` | — | Tailwind classes for the sign-in button or avatar trigger |

`SpursSignInButton` accepts `returnTo`, `issuer`, `accent`, and custom button
content via `children`, as well as `className`. You can also import `cn` from
`@spurs-cloud/accounts/react` to merge Tailwind classes elsewhere.

Needs `react` (an optional peer dependency).

---

## Third-party apps (OAuth2 / OIDC)

```ts
import { createOidcClient } from "@spurs-cloud/accounts";

const oidc = createOidcClient({
  issuer: process.env.SPURS_ISSUER!,
  clientId: process.env.SPURS_CLIENT_ID!,
  clientSecret: process.env.SPURS_CLIENT_SECRET!,
  redirectUri: "https://myapp.com/auth/callback",
});

// 1. start login — persist state + codeVerifier, then redirect
const { url, state, codeVerifier } = await oidc.createAuthorizationUrl();

// 2. on /auth/callback (after checking `state` matches)
const { tokens, user } = await oidc.handleCallback(code, codeVerifier);
```

---

## API

**Shared session** — `createSpursClient(config)` / `spursFromEnv()`
- `verify(token)` → `SpursUser | null`
- `userFromCookieHeader(header)` / `userFromRequest(request)`
- `loginUrl(returnTo)`, `logoutUrl(returnTo?)`, `accountUrl()`

**OIDC** — `createOidcClient(config)`
- `createAuthorizationUrl()`, `exchangeCode(code, verifier)`, `fetchUserInfo(token)`, `handleCallback(code, verifier)`

**Next** (`@spurs-cloud/accounts/next`)
- `getSpursUser()`, `requireSpursUser(returnTo?)`, `createSpursProxy(options)`, `spurs()`

Types: `SpursUser`, `SpursConfig`, `SpursOidcConfig`, `SpursTokenSet`.

---

## Security notes

- `sessionSecret` is **server-side only** — never ship it to the browser.
- Sessions are HS256 JWTs; `verify` enforces the algorithm and returns `null` on any failure.
- `issue()` exists for Accounts itself. Consumer apps verify — they never mint sessions.
