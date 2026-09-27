# Article batches

The source text of every article written for this site, as JSON. The database holds the
published copy; these files are the reviewable version — a diff here shows what changed in
a piece of writing, which a database row cannot.

```
npx tsx scripts/publish-posts.ts scripts/content/<batch>.json           check only
npx tsx scripts/publish-posts.ts scripts/content/<batch>.json --apply   write it
```

Re-applying a batch is safe: articles are upserted by slug.

The publisher refuses a batch rather than half-publishing it, and checks each piece for:

- a table that would render as raw pipes, and any block that would not survive paragraph splitting
- a summary outside 35–75 words — it is the answer-first block an answer engine lifts
- an internal link to an article or product that does not exist, in this batch or already published
- anything the compliance lexicon blocks, scanned against all three product lines
- meta title and description, derived the same way the admin panel derives them

Faults it caught while these were written, in case they come up again: an empty first
header cell makes a table malformed; `treat`, `prevent`, `extraction`, `cure` and `tea` are
all blocked words that appear naturally in craft and laboratory writing; and a link to an
article later in the same batch is fine, but a link to one in a *later* batch is a dead link.
