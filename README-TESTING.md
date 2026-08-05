# ScraperCleanup FTN parser fix

This package keeps the original scraper flow and fixes the FamilyTreeNow results parser.

## Included fixes

- Keeps separate people separate by deduplicating primarily with the record `rid`, not the shared search `smck` token.
- Keeps the real detail-page URL when duplicate card links exist.
- Correctly matches requested cities and states appearing under `LIVED:` / `LIVED IN:` by using real regex word boundaries.
- Logs the number of raw card links and distinct person cards after deduplication.
- Leaves the original captcha and database insertion flow unchanged.

## Expected regression checks

- Joe Kewish: the Plano record should remain available and be preferred over an out-of-state record.
- Steven Howell: multiple visible people should remain multiple parsed results rather than collapsing to one.
- Willy Bolt / Billy Bolt: the card should parse, but the strict first-name rule will still reject the nickname difference unless nickname matching is intentionally added later.

## Deploy

Replace the existing `cleanupPendingLeads.js`, then run:

```bash
git add cleanupPendingLeads.js
git commit -m "Fix FTN result-card dedupe and lived-in matching"
git push origin main
```

Watch for logs like:

```text
[DEBUG] Found 18 raw FTN result card link(s).
[DEBUG] 9 distinct FTN person card(s) after dedupe.
[RESULTS] FamilyTreeNow returned 9 result(s).
```
