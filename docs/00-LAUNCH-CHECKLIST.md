# Launch checklist — MIMOSALSD

The framework, layout and components come from an existing build of the same shape.
Everything a search engine reads, and every claim a customer reads, must be this
company's own before this site goes public.

**Nothing in this repository may be deployed to mimosalsd.com until section 1 is
done.** The copy that ships today is sample text carried over from the other build,
kept only so that every section of the design renders while it is being reviewed.
Publishing it would put near-identical pages on two domains, which is the one thing
the client cannot afford, and would repeat claims that belong to another company.

---

## 1. Before the site is public

### 1.1 Rewrite every page a visitor or a crawler reads

Same sections, same design, different words. In order of how much traffic they earn:

| Where | File or source | What it is now |
|---|---|---|
| Home | `src/app/(site)/page.tsx` | Sample hero, promise, sections |
| Categories | `src/lib/catalog/catalog.data.ts` | Sample category names, intros, FAQs |
| Products | this site's database | Empty until seeded |
| Guides and articles | this site's database, `src/lib/content/content.data.ts` | Sample authored pieces |
| FAQ | `src/lib/content/faq.ts` | Sample answers |
| Policies | `src/lib/content/policies.ts` | Sample shipping, purchase, returns, privacy, terms |
| Legality pages | `src/lib/legality/state-profiles.ts` + `state_rules` | Sample per-state notes |
| About | `src/app/(site)/about/page.tsx` | Sample summary |
| llms.txt | `src/app/llms.txt/route.ts` | Sample business description |

Two pages must not be copied in shape either, because they are where duplicate
detection bites hardest: the per-state pages and the category pages. Write them from
this company's own position, with its own statutes and review dates.

### 1.2 Replace the placeholder brand assets

`public/brand/*`, `assets/logo-badge.png`, `src/app/icon.png`, `apple-icon.png`,
`favicon.ico` are plain text marks generated as stand-ins. The client's logo replaces
all of them.

### 1.3 Replace the sample photography

`public/samples/*` and any product image are stand-ins. Identical photographs on two
domains are a duplicate signal of their own, and the licence for another site's
photography does not travel. `public/team/*` are flat placeholders, not people.

### 1.4 Supply the company's own facts

Until each is supplied, the site says nothing rather than something untrue:

- Registered legal name (`BRAND.legalName`).
- Postal address — CAN-SPAM requires a real one in commercial email; blasts refuse to
  send while it is empty.
- Founder, if one is to be published: name, role, one-line description, photograph
  (`BRAND.proprietor`, currently sample).
- Team: roles, names, photographs (`src/lib/content/team.ts`, currently sample).
- Trading history: years and customers (`BRAND.track`, currently 0, which prints
  nothing at all).
- Laboratory arrangements: who tests, what panels, what is issued on request. Every
  testing sentence on the site must match what this company actually does.
- Free shipping threshold (`BRAND.freeShippingThresholdCents`, currently $100).

### 1.5 Its own infrastructure

- Neon database (`DATABASE_URL`, `DIRECT_URL`) — never shared with another site.
- Cloudflare R2 bucket and public host.
- Brevo sender, verified for mimosalsd.com.
- `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `CRON_SECRET` generated fresh.
- `INDEXNOW_KEY` generated for this domain.
- `NEXT_PUBLIC_SITE_URL` set to the live host, matching the www/apex redirect.

---

## 2. Making the two sites rank independently

The risk is not that the code is shared — Google does not rank code. The risk is
shared sentences, shared images and shared entity signals.

1. **No shared sentences.** Every page rewritten, not spun: different structure of
   argument, different examples, different headings.
2. **No shared images.** New photography or new generations; the same file on two
   domains is detectable directly.
3. **Distinct entity.** Its own legal name, address, email, phone, social profiles,
   Search Console and Bing Webmaster properties, IndexNow key, and its own
   Organization JSON-LD. No cross-linking between the two sites.
4. **Different content plan.** Not the same 60 article titles reworded. Pick this
   company's own topics, its own pillar structure, its own internal linking.
5. **Separate analytics and separate ntfy topics**, so neither site's data mixes with
   the other's.

## 3. What carries over untouched, and why that is fine

The Next.js app, the component library, the Prisma schema, the admin panel, the cart
and checkout flow, the compliance lexicon, the test suite. None of it is read by a
search engine as content, and the client is entitled to the same machinery: it is the
writing, the pictures and the identity that have to be theirs.
