/**
 * No-op stand-in for the `server-only` package.
 *
 * That package throws on import outside a React Server Component, which is exactly
 * what we want in the app — importing the payment-handle pool into a client component
 * must be a build error, not a silent leak. Vitest is not an RSC context, so the guard
 * is stubbed here rather than removed from the source.
 */
export {}
