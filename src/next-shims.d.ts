/**
 * Build-time type shims for the small slice of Next.js this SDK touches.
 *
 * They exist so the package compiles standalone (no `next` install required for
 * `npm install github:…`). At runtime the host app's real Next modules are used,
 * and `next` is declared an optional peer dependency. These declarations are
 * `.d.ts` inputs, so nothing is emitted into `dist`.
 */
declare module "next/headers" {
  export interface ReadonlyRequestCookie {
    name: string;
    value: string;
  }
  export interface ReadonlyRequestCookies {
    get(name: string): ReadonlyRequestCookie | undefined;
  }
  export function cookies(): Promise<ReadonlyRequestCookies>;
}

declare module "next/navigation" {
  export function redirect(url: string): never;
}

declare module "next/server" {
  export const NextResponse: {
    next(): unknown;
    redirect(url: string | URL): unknown;
  };
}
