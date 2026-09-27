# Deploying to Vercel and adding mimosalsd.com

Everything below is done once. Values live in `.env` in this repository — that file is
gitignored and is the only copy, so keep it.

---

## 1. Import the repository

Vercel → **Add New → Project** → import `github.com/Wicess/mimosalsd`.

| Setting | Value |
|---|---|
| Framework preset | Next.js (detected) |
| Build command | `npm run build` — runs `prisma generate` first, which is required |
| Install command | `npm install` |
| Output directory | leave empty (Next.js default) |
| Node version | 20.x or later |
| Root directory | leave empty |

Do **not** deploy yet. Add the environment variables first, or the first build fails on
a missing `DATABASE_URL` while prerendering the sitemap.

---

## 2. Environment variables

Paste each into Vercel → Settings → Environment Variables, for **Production, Preview and
Development** unless noted. The values are in `.env`; the names must match exactly.

### Required — the build fails or the site is broken without these

| Name | What it is | Note |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** connection | Used by the app at runtime and during the build |
| `DIRECT_URL` | Neon **direct** connection | Migrations and backups only |
| `NEXT_PUBLIC_SITE_URL` | `https://www.mimosalsd.com` | Builds every canonical, sitemap entry and share link. Must match the host that actually serves the site, including the `www` decision |
| `ADMIN_SESSION_SECRET` | Signs the admin cookie and the visit collector token | Already generated; 40+ random characters |
| `ADMIN_PASSWORD_HASH` | The admin login | Already generated from the chosen password. Regenerate with `npm run admin:hash` |
| `R2_ACCOUNT_ID` | Cloudflare account | |
| `R2_ACCESS_KEY_ID` | R2 access key | |
| `R2_SECRET_ACCESS_KEY` | R2 secret | |
| `R2_BUCKET` | `mimosalsd` | |
| `R2_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` | |
| `R2_PUBLIC_HOST` | The bucket's public hostname | Server side |
| `NEXT_PUBLIC_R2_PUBLIC_HOST` | The same hostname | Client side. **Both are needed** — product and article images resolve through it |

### Needed for specific features

| Name | Without it |
|---|---|
| `CRON_SECRET` | The nightly visit flush in `vercel.json` returns 401 and page views are lost |
| `INDEXNOW_KEY` | `/indexnow-key.txt` 404s and Bing rejects every submission |
| `BREVO_API_KEY`, `EMAIL_FROM` | No order or enquiry email is sent |
| `NTFY_URL`, `NTFY_TOKEN` | No push alert on a new order |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` | Verify by DNS instead; both are optional |
| `ANTHROPIC_API_KEY` | The admin product writer is unavailable. Everything else works |

`AGE_VERIFY_PROVIDER` is unset on purpose.

---

## 3. Add the domain

1. Vercel → Settings → **Domains** → add `mimosalsd.com` **and** `www.mimosalsd.com`.
2. Set the redirect so **apex → www** (`mimosalsd.com` redirects to `www.mimosalsd.com`).
   The canonical tags, the sitemap and `URL.md` are all written for `www`, so the two must
   agree. If you would rather serve the apex, change `NEXT_PUBLIC_SITE_URL` to
   `https://mimosalsd.com`, reverse the redirect, and regenerate `URL.md`.
3. At the registrar, point DNS at the records Vercel shows — usually an `A` record on the
   apex and a `CNAME` on `www`.
4. Wait for the certificate to issue, then confirm `https://mimosalsd.com` lands on
   `https://www.mimosalsd.com` with a **301**, not a 307 or a chain.

---

## 4. First deploy, then check these seven URLs

| URL | What it should show |
|---|---|
| `/` | Home page, no console errors, images loading from the R2 host |
| `/robots.txt` | AI crawlers named and allowed; sitemap line pointing at `www` |
| `/sitemap.xml` | 187 URLs; spot-check that a `/blog/...` article is present |
| `/indexnow-key.txt` | The key, as plain text |
| `/llms.txt` | Business summary and key links |
| `/blog` | Five sections, 56 articles, every card with its own picture |
| `/admin` | Login screen; sign in with the chosen password |

If images 404, `NEXT_PUBLIC_R2_PUBLIC_HOST` is missing or misspelled — that is the most
common single mistake, because the server-side variable alone lets the build pass.

---

## 5. Search engines — only after the copy pass

**Do not verify the site with Google or Bing, and do not submit a sitemap, until
`00-LAUNCH-CHECKLIST.md` section 1 is complete.** The pages listed there still carry the
parent build's words. Submitting them is how two sites get read as one, which is the
single outcome this project cannot afford, and it is much harder to undo than to avoid.

When the copy is this company's own:

1. **Search Console** — add `https://www.mimosalsd.com` as a property, verify by DNS,
   submit `/sitemap.xml`.
2. **Bing Webmaster Tools** — add the property, verify, submit `/sitemap.xml`.
3. **IndexNow** — `npm run indexnow -- --all` once, after launch. Then leave it alone:
   `npm run indexnow -- --url /blog/<slug>` per new page, which is what Bing asks for.
   Resubmitting an unchanged sitemap daily is crawl waste, not diligence.
4. **Google has no IndexNow** — new URLs go in by hand through URL Inspection, about ten
   a day. `URL.md` lists what is new since it was last generated, for exactly this.

Regenerate the list whenever content changes:

```
npm run urls              rewrite URL.md
npm run urls -- --check   also request every URL and report anything not 200
```

---

## 6. Ongoing

- **Content** — articles written in the admin panel are live immediately, but the sitemap
  and `URL.md` only reflect them after a cache tag refresh or a regeneration. Run
  `npm run urls` after a publishing session.
- **The nightly cron** is already declared in `vercel.json` (`/api/cron/flush-visits`,
  03:15 UTC). It needs `CRON_SECRET` to be set.
- **Database cost** — Neon bills by how long the database stays awake and suspends only
  after about five minutes with no queries at all. Leaving the admin dashboard open on a
  timed refresh keeps it awake all day and bills Vercel invocations at the same time. If
  the admin is left open, make its refresh pause when the tab is hidden or idle.
- **Backups** — take one before any migration, and run migrations against a throwaway
  Postgres first. `DATABASE_URL` here is production; there is no staging copy.
