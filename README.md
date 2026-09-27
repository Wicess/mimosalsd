# {{BRAND}} — Compliant Psychedelics & Botanicals Commerce

Production e-commerce platform for a **US** seller of legal psychedelics and botanicals.
Built mobile-first, organic-search-first, and compliance-first.

Customers **do not pay on the site** — they submit an order request and choose a preferred
method (CashApp / Chime / Apple Cash / Bitcoin). We verify, then contact them.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma ·
Neon Postgres · Vercel · Cloudflare R2 + CDN · ntfy

## Documentation

| Doc | What it is |
|---|---|
| [`docs/01-COMPLIANCE-RESEARCH.md`](docs/01-COMPLIANCE-RESEARCH.md) | Market + legal research. **The constraint layer — read first.** |
| [`docs/02-BUILD-PLAN.md`](docs/02-BUILD-PLAN.md) | **The final merged 20-step build plan**, phased, with a Definition of Done per step |
| [`docs/03-MASTER-PROMPT.md`](docs/03-MASTER-PROMPT.md) | Self-contained development prompt for Claude Code |
| [`CLAUDE.md`](CLAUDE.md) | Standing guardrails for every AI session in this repo |

## The three things that shape this build

1. **Three products, three compliance regimes.** Mimosa Hostilis (botanical, never for
   consumption) · Amanita muscaria (unscheduled, blocked in Louisiana) · disposable vapes
   (PACT Act — separate carrier, adult signature, monthly per-state federal filings).
2. **Organic search is the only channel.** Google prohibits paid ads here. SEO/AEO/GEO is
   an architectural constraint from step one, not a launch task.
3. **No payment on site.** Order request → manual verification → off-site payment.
   PCI scope: zero — and that is a genuine, truthful trust asset worth saying out loud.

## The SEO architecture

Paid ads are prohibited in this category, so organic is the entire funnel — which makes SEO
an architectural constraint from step one, not a launch task. Three surfaces carry it:

- **`/locations/[city]`** — real physical stores with matching NAP + `LocalBusiness` schema.
  Genuine local SEO, and what makes same-day delivery a real promise rather than a claim.
- **`/legality/[state]`** — 50 pages of cited, dated, per-state legal status, reading the
  *same* `state_rules` table the cart enforces. The national moat. (Note: "near me" is a
  proximity trigger, not a keyword — and thin templated city pages are Doorway Abuse.)
- **`/blog` + `/guides`** — answer-first informative content with contextual
  `<RecommendedProducts>`, tuned for AI citation (llms.txt, FAQ/Article schema, AI crawlers
  explicitly allowed).

## Status

📋 Planning complete. Implementation starts at
[`docs/02-BUILD-PLAN.md`](docs/02-BUILD-PLAN.md) Step 1.

⚠️ Nothing in this repository is legal advice. Every rule in `state_rules` must be
reviewed and signed off by licensed counsel before launch.
