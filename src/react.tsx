"use client";

/**
 * The shared Spurs SSO button and account menu. Import from `@spurs-cloud/accounts/react`.
 *
 * Deliberately styled with inline styles rather than utility classes: a package
 * shipped in `node_modules` can't rely on the host app's Tailwind content scan,
 * so this renders identically in every Spurs app regardless of its CSS setup.
 * The accent is a fallback for users without a profile picture.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SPURS_ISSUER } from "./constants.js";
import type { SpursUser } from "./types.js";

export interface SpursAccountMenuProps {
  /** The signed-in user. Omit it to render a "Sign in with Spurs" button. */
  user?: Pick<SpursUser, "name" | "email" | "picture"> | null;
  /** Fallback avatar colour. Defaults to Spurs indigo. */
  accent?: string;
  /** Secondary gradient colour. Defaults to a darker shade of `accent`. */
  accentTo?: string;
  /** Accounts base URL. Baked in — override only for dev/staging. */
  issuer?: string;
  /** Where "Sign out" points. Defaults to a full Spurs sign-out. */
  signOutUrl?: string;
  /** Handle sign-out yourself (e.g. POST to your own route). Wins over `signOutUrl`. */
  onSignOut?: () => void;
  /** Where the "Sign in" button sends guests. Defaults to Spurs SSO. */
  signInUrl?: string;
  /** Avatar diameter in px. Default 36. */
  size?: number;
  /** Popover alignment. Default "right". */
  align?: "left" | "right";
  /** Dark surface for the popover. */
  theme?: "light" | "dark";
  /** Extra links rendered above "Sign out". */
  children?: ReactNode;
}

export interface SpursSignInButtonProps {
  /** Where Spurs Accounts sends the user after signing in. */
  returnTo?: string;
  /** Accounts base URL. Baked in — override only for dev/staging. */
  issuer?: string;
  /** Override the button label. */
  children?: ReactNode;
  /** Fallback avatar/button colour. Defaults to Spurs indigo. */
  accent?: string;
}

export function SpursSignInButton({
  returnTo,
  issuer,
  children = "Sign in with Spurs",
  accent = "#6366f1",
}: SpursSignInButtonProps) {
  const base = (issuer || SPURS_ISSUER).replace(/\/$/, "");
  const [target, setTarget] = useState(returnTo ?? "/");
  useEffect(() => {
    if (!returnTo) setTarget(window.location.href);
  }, [returnTo]);
  const href = `${base}/sso/continue?return_to=${encodeURIComponent(target)}`;

  return (
    <a href={href} style={{ ...S.signIn, background: accent }}>
      {children}
    </a>
  );
}

function initialsOf(user: { name?: string; email?: string } | null | undefined): string {
  const source = user?.name?.trim() || user?.email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 1).toUpperCase();
}

export function SpursAccountMenu({
  user,
  accent = "#6366f1",
  accentTo,
  issuer,
  signOutUrl,
  onSignOut,
  signInUrl,
  size = 36,
  align = "right",
  theme = "light",
  children,
}: SpursAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const base = (issuer || SPURS_ISSUER).replace(/\/$/, "");
  const accountUrl = `${base}/me`;
  const outUrl = signOutUrl ?? `${base}/logout`;
  const inUrl = signInUrl ?? `${base}/sso/continue`;
  const gradient = `linear-gradient(135deg, ${accent}, ${accentTo ?? shade(accent, -28)})`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const dark = theme === "dark";
  const surface = dark ? "#18181b" : "#ffffff";
  const border = dark ? "#3f3f46" : "#e5e7eb";
  const text = dark ? "#fafafa" : "#111827";
  const muted = dark ? "#a1a1aa" : "#6b7280";

  if (!user) {
    return (
      <a href={inUrl} style={{ ...S.signIn, background: accent }}>
        Sign in with Spurs
      </a>
    );
  }

  const initials = initialsOf(user);

  return (
    <div ref={ref} style={S.wrap}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Spurs account"
        onClick={() => setOpen((v) => !v)}
        style={{ ...S.avatarBtn, width: size, height: size, background: gradient, fontSize: size * 0.4 }}
      >
        {user.picture ? (
          <img src={user.picture} alt="" style={S.avatarImage} />
        ) : initials}
      </button>

      {open && (
        <div role="menu" style={{ ...S.popover, background: surface, borderColor: border, color: text, [align]: 0 } as CSSProperties}>
          <div style={{ ...S.header, borderColor: border }}>
            <div style={{ ...S.bigAvatar, background: gradient }}>
              {user.picture ? <img src={user.picture} alt="" style={S.avatarImage} /> : initials}
            </div>
            <div style={S.name}>{user.name ?? "Your account"}</div>
            {user.email && <div style={{ ...S.email, color: muted }}>{user.email}</div>}
            <a href={accountUrl} style={{ ...S.manage, borderColor: border, color: text }}>
              Manage your Spurs Account
            </a>
          </div>

          {children}

          {onSignOut ? (
            <button type="button" onClick={onSignOut} style={{ ...S.item, color: "#dc2626", width: "100%", textAlign: "left" }}>
              Sign out
            </button>
          ) : (
            <a href={outUrl} style={{ ...S.item, color: "#dc2626" }}>
              Sign out
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Lighten/darken a hex colour by `amount` (-100..100). */
function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const num = parseInt(full, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0xff) + amount);
  const b = clamp((num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const S: Record<string, CSSProperties> = {
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
  name: { fontSize: 14, fontWeight: 500, marginTop: 4 },
  email: { fontSize: 12 },
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
};

export default SpursAccountMenu;
