# CLAUDE.md — {{BRAND}}

Guardrails for every AI session in this repo. Read `docs/01-COMPLIANCE-RESEARCH.md`
before writing code that touches products, cart, shipping or content.

## What this is
Compliant DTC commerce for legal psychedelics & botanicals (**USA only**). Customers do not
pay on site — they submit an order request and choose a method; we verify, then contact them.
Next.js 16 App Router ·
React 19 · TS strict · Tailwind v4 · Prisma · Neon · Vercel · Cloudflare R2 · ntfy.
Acquisition is **100% organic** — paid ads are prohibited in this category.

## Priority order when requirements conflict
`Legal compliance → Mobile UX → SEO/AEO → Performance → Aesthetics`

## Hard rules — do not violate without explicit human sign-off

1. **Never hardcode state legality.** It lives in the `state_rules` table, editable in
   admin, versioned, audit-logged. The cart and `/legality/[state]` read the *same* row.
2. **Vapes are PACT Act regulated.** Separate `fulfillmentChannel`; not USPS/UPS/FedEx;
   adult signature; monthly per-state delivery reports. Carts split by channel.
   Free-shipping-over-$100 and same-day delivery **never** apply to vapes nationally.
3. **MHRB is not for human consumption.** Non-dismissible banner above ATC + intended-use
   attestation at checkout, persisted with the order.
4. **Banned-terms lexicon** (`lib/compliance/lexicon.ts`) gates all copy, blog content,
   product descriptions and customer reviews. Blocks extraction/consumption terms on MHRB
   and health claims (`cure, treat, heal, anxiety, depression, ...`) sitewide. CI enforces.
5. **No health claims, ever** — including in user-generated reviews. Moderate before publish.
6. **Age verification is layered and evidenced.** No self-declaration-only modal.
   The age gate must never hide content from crawlers.
7. **Payment handles are server-only**, post-order, tokenised, from a rotating pool.
   Never in static HTML. Label Apple Pay as **"Apple Cash"**.
8. **Money is integer cents.** Every order transition writes an immutable `OrderEvent`.
9. **No thin templated city pages** — that is Doorway Abuse. Build real per-state legality
   pages with cited statutes and review dates.
10. **`robots.txt` must allow** `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`,
    `CCBot`. AI citation is a primary channel here.
11. **FDA disclaimer renders on every PDP and content page** as a component.
12. **Locations pages only for locations that physically exist**, NAP byte-identical to the
    Google Business Profile.
13. **Blogs are informative first**, converting via contextual `<RecommendedProducts>` —
    never hype, never a health claim.
14. **US market only.** No international shipping, pricing, or content targeting.

## Engineering conventions
- Server Components by default; `"use client"` only when interactivity requires it.
- Zod validation on every Server Action and route handler.
- Design mobile-first at **375px**. Primary CTAs in the bottom third. Sticky ATC on PDP.
- No hardcoded hex outside the design-token file.
- Checkout ≤ 8 visible fields.
- Near-100% test coverage on `lib/compliance`, pricing and shipping-eligibility modules.

## Budgets (CI-enforced)
LCP < 2.0s · INP < 200ms · CLS < 0.1 · Lighthouse mobile ≥95 perf/SEO · a11y 100 · WCAG 2.2 AA

## Footer signature (house convention)
`Developed by W!CE` — `W!CE` is a mailto link to kenj52974@gmail.com,
`aria-label="Contact the developer, W!CE"`, slow metallic sheen, disabled under
`prefers-reduced-motion`. See the global convention in `~/.claude/CLAUDE.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
