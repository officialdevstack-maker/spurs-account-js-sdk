"use client";

/**
 * The shared Spurs SSO button and account menu. Import from `@spurs-cloud/accounts/react`.
 *
 * Deliberately styled with inline styles rather than utility classes: a package
 * shipped in `node_modules` can't rely on the host app's Tailwind content scan,
 * so this renders identically in every Spurs app regardless of its CSS setup.
 * The accent is a fallback for users without a profile picture.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { cn } from "./cn.js";
import { SPURS_ISSUER } from "./constants.js";
import type { SpursUser } from "./types.js";

const DEFAULT_ACCENT = "#6366f1";

export interface SpursAccountMenuProps {
  /** The signed-in user. Omit it to render a "Sign in with Spurs" button. */
  user?: Pick<SpursUser, "name" | "email" | "picture"> | null;
  /** Fallback avatar colour (hex). Defaults to Spurs indigo. */
  accent?: string;
  /** Secondary gradient colour. Defaults to a darker shade of `accent`. */
  accentTo?: string;
  /** Accounts base URL. Baked in — override only for dev/staging. */
  issuer?: string;
  /** Where "Sign out" points. Defaults to a full Spurs sign-out. */
  signOutUrl?: string;
  /** Handle sign-out yourself (e.g. POST to your own route). Wins over `signOutUrl`. */
  onSignOut?: () => void;
  /** Where the "Sign in" button sends guests. Defaults to Spurs SSO, returning to the current page. */
  signInUrl?: string;
  /** Avatar diameter in px. Default 36. */
  size?: number;
  /** Popover alignment. Default "right". */
  align?: "left" | "right";
  /** Dark surface for the popover. */
  theme?: "light" | "dark";
  /** Extra links rendered above "Sign out". */
  children?: ReactNode;
  /** Classes for the root wrapper (layout: margin, order, self-alignment, etc.). */
  className?: string;
  /** Inline styles merged onto the root wrapper. */
  style?: CSSProperties;
  /** Classes for the avatar button. Visual props set inline (e.g. background) need Tailwind's `!` modifier. */
  buttonClassName?: string;
  /** Classes for the popover panel. Visual props set inline (e.g. background) need Tailwind's `!` modifier. */
  popoverClassName?: string;
}

export interface SpursSignInButtonProps {
  /** Where Spurs Accounts sends the user after signing in. Defaults to the current page. */
  returnTo?: string;
  /** Accounts base URL. Baked in — override only for dev/staging. */
  issuer?: string;
  /** Override the button label. */
  children?: ReactNode;
  /** Button colour. Defaults to Spurs indigo. */
  accent?: string;
  /** Extra classes, merged with Tailwind conflict resolution. */
  className?: string;
  /** Inline styles merged over the defaults. */
  style?: CSSProperties;
}

const baseOf = (issuer?: string) => (issuer || SPURS_ISSUER).replace(/\/+$/, "");

export function SpursSignInButton({
  returnTo,
  issuer,
  children = "Sign in with Spurs",
  accent = DEFAULT_ACCENT,
  className,
  style,
}: SpursSignInButtonProps) {
  // Start with a stable value so server and client markup match, then upgrade
  // to the current URL after hydration when no explicit `returnTo` was given.
  const [target, setTarget] = useState(returnTo ?? "/");
  useEffect(() => {
    setTarget(returnTo ?? window.location.href);
  }, [returnTo]);

  const href = `${baseOf(issuer)}/sso/continue?return_to=${encodeURIComponent(target)}`;

  return (
    <a
      href={href}
      className={cn("spurs-sign-in", className)}
      style={{ ...S.signIn, background: accent, ...style }}
    >
      {children}
    </a>
  );
}

function initialsOf(user: { name?: string | null; email?: string | null }): string {
  const source = user.name?.trim() || user.email?.trim() || "?";
  // Array.from keeps surrogate pairs (emoji, rarer scripts) intact.
  const parts = source.split(/\s+/).filter(Boolean).map((p) => Array.from(p)[0]);
  const letters = parts.length >= 2 ? parts[0] + parts[1] : parts[0] ?? "?";
  return letters.toUpperCase();
}

/**
 * Lighten/darken a hex colour by `amount` (-255..255 per channel).
 * Anything that isn't #rgb or #rrggbb (named colours, rgb(), hsl(), var())
 * is returned unchanged rather than turning into "#NaN".
 */
function shade(color: string, amount: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const hex = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  const num = parseInt(hex, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0xff) + amount);
  const b = clamp((num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Profile picture with an initials fallback if the image fails to load. */
function Avatar({ picture, initials }: { picture?: string | null; initials: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [picture]);

  if (!picture || failed) return <>{initials}</>;
  return (
    <img
      src={picture}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={S.avatarImage}
    />
  );
}

export function SpursAccountMenu({
  user,
  accent = DEFAULT_ACCENT,
  accentTo,
  issuer,
  signOutUrl,
  onSignOut,
  signInUrl,
  size = 36,
  align = "right",
  theme = "light",
  children,
  className,
  style,
  buttonClassName,
  popoverClassName,
}: SpursAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // pointerdown covers mouse, touch and pen.
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Close the popover when any link or button inside it is activated, so
  // same-page links and custom `children` don't leave it hanging open.
  const onPanelClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) close();
  };

  if (!user) {
    // An explicit signInUrl wins; otherwise use the button that carries return_to.
    return signInUrl ? (
      <a
        href={signInUrl}
        className={cn("spurs-sign-in", className)}
        style={{ ...S.signIn, background: accent, ...style }}
      >
        Sign in with Spurs
      </a>
    ) : (
      <SpursSignInButton issuer={issuer} accent={accent} className={className} style={style} />
    );
  }

  const base = baseOf(issuer);
  const accountUrl = `${base}/me`;
  const outUrl = signOutUrl ?? `${base}/logout`;
  const gradient = `linear-gradient(135deg, ${accent}, ${accentTo ?? shade(accent, -28)})`;

  const dark = theme === "dark";
  const surface = dark ? "#18181b" : "#ffffff";
  const border = dark ? "#3f3f46" : "#e5e7eb";
  const text = dark ? "#fafafa" : "#111827";
  const muted = dark ? "#a1a1aa" : "#6b7280";

  const initials = initialsOf(user);
  const label = user.name || user.email || "Spurs account";

  return (
    <div ref={wrapRef} className={cn("spurs-account-menu", className)} style={{ ...S.wrap, ...style }}>
      <button
        ref={buttonRef}
        type="button"
        className={cn("spurs-account-menu__button", buttonClassName)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Spurs account: ${label}`}
        onClick={() => setOpen((v) => !v)}
        style={{ ...S.avatarBtn, width: size, height: size, background: gradient, fontSize: size * 0.4 }}
      >
        <Avatar picture={user.picture} initials={initials} />
      </button>

      {open && (
        // Disclosure pattern: a plain panel of links. `role="menu"` would
        // promise arrow-key navigation and menuitem children we don't provide.
        <div
          id={panelId}
          className={cn("spurs-account-menu__popover", popoverClassName)}
          onClick={onPanelClick}
          style={{
            ...S.popover,
            background: surface,
            borderColor: border,
            color: text,
            ...(align === "left" ? { left: 0 } : { right: 0 }),
          }}
        >
          <div style={{ ...S.header, borderColor: border }}>
            <div style={{ ...S.bigAvatar, background: gradient }}>
              <Avatar picture={user.picture} initials={initials} />
            </div>
            <div style={S.name}>{user.name || "Your account"}</div>
            {user.email && <div style={{ ...S.email, color: muted }}>{user.email}</div>}
            <a href={accountUrl} style={{ ...S.manage, borderColor: border, color: text }}>
              Manage your Spurs Account
            </a>
          </div>

          {children}

          {onSignOut ? (
            <button type="button" onClick={onSignOut} style={{ ...S.item, ...S.signOut, width: "100%", textAlign: "left" }}>
              Sign out
            </button>
          ) : (
            <a href={outUrl} style={{ ...S.item, ...S.signOut }}>
              Sign out
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: { position: "relative", display: "inline-block" },
  avatarBtn: {
    display: "grid",
    placeItems: "center",
    borderRadius: "9999px",
    border: "none",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    fontFamily: "inherit",
    overflow: "hidden",
  },
  signIn: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 8,
    padding: "8px 14px",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
    fontFamily: "inherit",
  },
  popover: {
    position: "absolute",
    top: "calc(100% + 8px)",
    width: 288,
    maxWidth: "calc(100vw - 16px)",
    borderRadius: 16,
    border: "1px solid",
    boxShadow: "0 12px 32px rgba(0,0,0,.16)",
    overflow: "hidden",
    zIndex: 50,
    fontFamily: "inherit",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "20px 20px 18px",
    borderBottom: "1px solid",
  },
  bigAvatar: {
    display: "grid",
    placeItems: "center",
    width: 56,
    height: 56,
    borderRadius: "9999px",
    color: "#fff",
    fontSize: 20,
    fontWeight: 600,
    overflow: "hidden",
  },
  avatarImage: {
    display: "block",
    width: "100%",
    height: "100%",
    borderRadius: "inherit",
    objectFit: "cover",
  },
  name: { fontSize: 14, fontWeight: 500, marginTop: 4, maxWidth: "100%", overflowWrap: "anywhere", textAlign: "center" },
  email: { fontSize: 12, maxWidth: "100%", overflowWrap: "anywhere", textAlign: "center" },
  manage: {
    marginTop: 8,
    display: "inline-block",
    borderRadius: 9999,
    border: "1px solid",
    padding: "6px 16px",
    fontSize: 12,
    fontWeight: 500,
    textDecoration: "none",
  },
  item: {
    display: "block",
    padding: "12px 20px",
    fontSize: 14,
    textDecoration: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  signOut: { color: "#dc2626" },
} satisfies Record<string, CSSProperties>;

export default SpursAccountMenu;