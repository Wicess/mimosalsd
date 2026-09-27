# Launch checklist — MIMOSALSD

The framework, layout and components come from an existing build of the same shape.
Everything a search engine reads, and every claim a customer reads, must be this
company's own before this site goes public.

**The site can be deployed to Vercel and the domain attached at any time** — see
`02-DEPLOY-VERCEL.md`. What must wait is *telling search engines about it*: no Search
Console or Bing verification, no sitemap submission, no IndexNow run until section 1
below is done. Publishing the pages that still carry the parent build's words is how two
sites get read as one, and that is much harder to undo than to avoid.

---

## 0. Done — 27 September 2026

- **50 new articles were written for this site**, across five sections: 8 botanical,
  15 dyeing, 9 devices, 9 cannabinoids, 9 testing. Each is new text on a topic that is
  general to the trade — not a reworded copy of the parent build's article on the same
  subject. Different structure, different examples, different headings, different slugs.
- **Three more pages were rewritten from scratch** at their existing slugs, so every
  internal link and test kept working: the two pillar guides and the dyeing hub article.
  That makes **53 pages of this site's own writing**. Five authored articles and two
  guides are still the parent build's text — listed in 1.1 below.
- **Every article carries its own hero image.** 162 images (60 article heroes,
  102 product photographs) are in this site's own R2 bucket.
- **The pillar loop works**: `what-is-mimosa-hostilis-root-bark` and
  `how-to-read-a-certificate-of-analysis` were rewritten from scratch and now point down
  at 18 of the new articles, which link back up.
- **The blog index section intros** are this site's own words.
- **`URL.md` is generated, not hand-kept** — `npm run urls` rewrites it from the
  repository's own data and lists what is new since the last run. `npm run indexnow
  -- --all` reads the same collector, so the file and the submissions cannot disagree.

---

## 1. Before the site is public

### 1.1 Rewrite every page a visitor or a crawler reads

Same sections, same design, different words. What is still the parent build's text, in
order of how much traffic it stands to earn or lose:

| Where | File or source | Size of the job |
|---|---|---|
| **Product copy** | `postedProduct.document` in this database | **57 products, every one carrying its full description.** The largest block of duplicate text on the site by a wide margin |
| **State legality pages** | `state_rules` (153 rows) + `src/lib/legality/state-profiles.ts` | 51 indexable pages. Duplicate detection bites hardest here, because the statute text is identical and the pages are templated |
| Home | `src/app/(site)/page.tsx` | Hero, promise, every section |
| Categories | `src/lib/catalog/catalog.data.ts` | 4 category names, intros and FAQs |
| FAQ | `src/lib/content/faq.ts` | Every answer |
| Policies | `src/lib/content/policies.ts` | 5 pages: shipping, purchase, returns, privacy, terms |
| About | `src/app/(site)/about/page.tsx` | The whole page |
| llms.txt | `src/app/llms.txt/route.ts` | Business description |
| Footer, standards, canned replies | `site-footer.tsx`, `standards.tsx`, `lib/support/canned.ts` | Short but sitewide |
| 5 remaining articles | `src/lib/content/content.data.ts` | `what-is-muscimol`, `is-amanita-muscaria-legal-in-the-united-states`, `what-the-pact-act-means-for-buyers`, `shipping-restrictions-explained`, `how-we-batch-test-every-product` |
| 2 remaining guides | `src/lib/content/content.data.ts` | `amanita-muscaria-explained`, `how-ordering-and-payment-works` |

Three of those need a decision as well as a rewrite:

- **`how-we-batch-test-every-product`** describes laboratory arrangements. Do not rewrite
  it until this company's own arrangements are known — a rewritten claim is still a claim,
  and this is the exact failure that cost the parent build: 206 live pages went on saying
  a person had checked something after the rows behind it were deleted.
- **The two Amanita pieces and `what-is-muscimol`** describe a category whose listings are
  on hold. Leave them until the products they sit beside are settled.
- **`shipping-restrictions-explained`** and **`what-the-pact-act-means-for-buyers`** must
  not tell a customer about photo ID, adult signature, or which states are restricted.
  Written fresh, they are "how delivery works" pages under slugs that already rank for the
  question.

Also carried over and harmless but worth clearing: `next.config.ts` redirects eleven
retired product slugs from the parent build. Nothing on this domain ever used them.

### 1.2 Brand assets — done

The client's wordmark is in. It was cut out of the supplied artwork: the black ground and
its glow keyed to transparency, cropped to the mark, so it sits on both the light and the
dark theme without a halo. Every slot is generated from that one file and from the ornate
`M` inside it:

| File | What it is |
|---|---|
| `public/brand/logo.png` | The wordmark, 900×251, transparent |
| `public/brand/mark.png`, `app-icon-512`, `app-icon-192`, `icon-192`, `src/app/icon.png` | The round badge: dark disc, citron hairline, the `M` |
| `public/brand/app-icon-maskable-512.png`, `src/app/apple-icon.png` | Dark plate to the edges, art inside the 80% safe zone |
| `public/brand/notification-badge-96.png` | Solid white `M` on transparency — Android draws it as a silhouette |
| `public/brand/logo-email.png` | Wordmark on a dark plate; most email clients drop transparency |
| `assets/logo-badge.png` | The share card's circle, pre-masked |
| `src/app/favicon.ico` | 16/32/48 from the badge |

`assets/logo-source.jpg` is the original supplied artwork, kept so the set can be
regenerated. The wordmark's real aspect is 3.59:1, so the seven places that hard-coded the
placeholder's 996×440 now carry 1180×329.

### 1.3 Replace the sample photography

**The 102 product photographs in this bucket are the same image files as the parent
build's**, copied deliberately so every page renders while the site is being reviewed.
Identical photographs on two domains are a duplicate signal in their own right, and the
licence for another site's photography does not travel. They must be replaced before the
site is submitted to a search engine.

The 60 article hero images are in the same position, and so are the **two hero videos** in
`public/videos/` — transferred from the parent build at the owner's request so the landing
page runs as intended. Footage of this company's own is the eventual answer; the same clip
on two domains is the same signal as the same sentence.

`public/samples/*` are stand-ins and `public/team/*` are flat placeholders, not people.

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
