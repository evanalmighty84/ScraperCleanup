# ScraperCleanup

Standalone Railway cron service that processes leftover leads from:

`unfiltered_ins_mold_pest_housecl_plumb_paint_land_lawn_handy`

This service contains its own FamilyTreeNow lookup logic. It does not call or import another Railway service.

## Behavior

It loads scraper rows where:

- `is_lead = true`
- `ftn_enriched_at IS NULL`
- author, city, and state are present

For each row it searches FamilyTreeNow through Smartproxy. When a mobile phone is found, it:

1. Inserts the result into `familytreenow`.
2. Routes matching contractors.
3. Sets the source row's `ftn_enrichment_status` to `enriched`.
4. Sets `ftn_enriched_at`.

A missing matching result or rejected location remains pending for another run. A confirmed no-phone result is marked `no_phone`; an unusable author is marked `invalid_name`.

## Railway

Copy every variable from `.env.example` into Railway. At minimum, configure:

- `DATABASE_URL`
- `FTN_PROXY_USER`
- `FTN_PROXY_PASS`
- `FTN_PROXIES`
- `FTN_PROXY_PORT`

The Dockerfile installs Google Chrome and Xvfb. Railway uses the included entrypoint automatically.

## Reset the rows incorrectly marked by the previous cleanup service

```sql
UPDATE unfiltered_ins_mold_pest_housecl_plumb_paint_land_lawn_handy
SET
    ftn_enrichment_status = NULL,
    ftn_enriched_at = NULL
WHERE id IN (
    1328, 1329, 1332, 1339, 1341, 1347,
    1352, 1362, 1369, 1389, 1391
)
  AND ftn_enrichment_status = 'cleanup_skipped';
```

## Run locally

```bash
npm install
npm start
```

## Headed Chrome on Railway

The scraper intentionally keeps `headless: false`, matching the original enrichment service. The npm start command launches it through Xvfb:

```bash
xvfb-run -a -s "-screen 0 1920x1080x24 -ac +extension RANDR" node cleanupPendingLeads.js
```

Do not override Railway's Start Command with `node cleanupPendingLeads.js`. Leave it blank or set it to `npm start`. Ensure Railway builds from the included Dockerfile so the `xvfb` and Google Chrome packages are installed.
