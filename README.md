# CleanupPendingLeads

Standalone Railway cron service that performs cleanup only.

It does **not** run FamilyTreeNow enrichment, Playwright, Chromium, Smartproxy,
2Captcha, or another Railway service.

## What it does

It queries:

`unfiltered_ins_mold_pest_housecl_plumb_paint_land_lawn_handy`

and finds today's valid lead rows that:

- have `ftn_enriched_at IS NULL`
- are at least `CLEANUP_MINIMUM_AGE_MINUTES` old
- have a null, pending, failed, or processing FTN status

It then closes those leftover rows by setting:

```sql
ftn_enrichment_status = 'cleanup_skipped'
ftn_enriched_at = NOW()
```

This prevents them from remaining pending into the next day.

## Railway setup

1. Push this folder to GitHub.
2. Create a new Railway service from the repository.
3. Add `DATABASE_URL`.
4. Add the optional cleanup variables from `.env.example`.
5. Set the cron schedule after the final normal scraper/enrichment run.

The default start command is:

```bash
npm start
```

## Safe test

Temporarily set:

```env
CLEANUP_DRY_RUN=true
```

The service will list matching rows without updating them.

After verifying the Railway logs, change it to:

```env
CLEANUP_DRY_RUN=false
```

## Suggested cron

Railway cron schedules use UTC. Pick a time after your final regular cron run.

For example:

```cron
30 4 * * *
```

On August 4, 2026, that corresponds to 11:30 PM Central Daylight Time.

## Important

The cleanup status can be changed through:

```env
CLEANUP_STATUS=cleanup_skipped
```

No database migration or new columns are required.
