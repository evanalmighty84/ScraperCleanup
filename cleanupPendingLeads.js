#!/usr/bin/env node

"use strict";

require("dotenv").config();

const { Pool } = require("pg");

const SOURCE_TABLE =
    "unfiltered_ins_mold_pest_housecl_plumb_paint_land_lawn_handy";

const TIME_ZONE = process.env.CLEANUP_TIME_ZONE || "America/Chicago";
const CLEANUP_STATUS =
    process.env.CLEANUP_STATUS || "cleanup_skipped";
const MINIMUM_AGE_MINUTES = Math.max(
    0,
    Number(process.env.CLEANUP_MINIMUM_AGE_MINUTES || 20),
);
const MAX_ROWS = Math.max(
    1,
    Number(process.env.CLEANUP_MAX_ROWS || 500),
);
const DRY_RUN =
    String(process.env.CLEANUP_DRY_RUN || "false").toLowerCase() === "true";

/*
 * Prevents overlapping copies of this cleanup service from updating
 * the same rows at the same time.
 */
const ADVISORY_LOCK_ID = 2608041717;

function buildConnectionString() {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }

    const {
        DB_USER,
        DB_PASSWORD = "",
        DB_HOST,
        DB_PORT = "5432",
        DB_NAME,
    } = process.env;

    if (!DB_USER || !DB_HOST || !DB_NAME) {
        throw new Error(
            "Set DATABASE_URL or DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, and DB_NAME.",
        );
    }

    return (
        `postgres://${encodeURIComponent(DB_USER)}:` +
        `${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:` +
        `${DB_PORT}/${encodeURIComponent(DB_NAME)}`
    );
}

const pool = new Pool({
    connectionString: buildConnectionString(),
    ssl:
        String(process.env.PGSSLMODE || "").toLowerCase() === "disable"
            ? false
            : { rejectUnauthorized: false },
});

async function acquireLock(client) {
    const { rows } = await client.query(
        "SELECT pg_try_advisory_lock($1) AS acquired",
        [ADVISORY_LOCK_ID],
    );

    return rows[0]?.acquired === true;
}
//empty commit
async function releaseLock(client) {
    await client.query(
        "SELECT pg_advisory_unlock($1)",
        [ADVISORY_LOCK_ID],
    );
}

async function findPendingRows(client) {
    const { rows } = await client.query(
        `
        SELECT
            id,
            author,
            city,
            state,
            lead_type,
            ftn_enrichment_status,
            ftn_enriched_at,
            timestamp
        FROM ${SOURCE_TABLE}
        WHERE is_lead IS TRUE
          AND ftn_enriched_at IS NULL
          AND author IS NOT NULL
          AND BTRIM(author) <> ''
          AND city IS NOT NULL
          AND BTRIM(city) <> ''
          AND state IS NOT NULL
          AND BTRIM(state) <> ''
          AND (
                timestamp AT TIME ZONE $1
              )::date = (
                NOW() AT TIME ZONE $1
              )::date
          AND timestamp <=
                NOW() - ($2 * INTERVAL '1 minute')
          AND (
                ftn_enrichment_status IS NULL
                OR ftn_enrichment_status IN (
                    'pending',
                    'failed',
                    'processing'
                )
          )
        ORDER BY id ASC
        LIMIT $3
        `,
        [TIME_ZONE, MINIMUM_AGE_MINUTES, MAX_ROWS],
    );

    return rows;
}

async function cleanRows(client, ids) {
    if (ids.length === 0) {
        return [];
    }

    const { rows } = await client.query(
        `
        UPDATE ${SOURCE_TABLE}
        SET
            ftn_enrichment_status = $2,
            ftn_enriched_at = NOW()
        WHERE id = ANY($1::int[])
          AND ftn_enriched_at IS NULL
        RETURNING
            id,
            author,
            city,
            state,
            lead_type,
            ftn_enrichment_status,
            ftn_enriched_at
        `,
        [ids, CLEANUP_STATUS],
    );

    return rows;
}

async function main() {
    const startedAt = Date.now();
    const client = await pool.connect();
    let lockAcquired = false;

    try {
        console.log("============================================================");
        console.log("Cleanup Pending Leads");
        console.log("============================================================");
        console.log(`Source table: ${SOURCE_TABLE}`);
        console.log(`Time zone: ${TIME_ZONE}`);
        console.log(`Minimum age: ${MINIMUM_AGE_MINUTES} minute(s)`);
        console.log(`Maximum rows: ${MAX_ROWS}`);
        console.log(`Cleanup status: ${CLEANUP_STATUS}`);
        console.log(`Dry run: ${DRY_RUN}`);

        lockAcquired = await acquireLock(client);

        if (!lockAcquired) {
            console.log(
                "Another cleanup run is already active. Exiting without changes.",
            );
            return;
        }

        const pendingRows = await findPendingRows(client);

        console.log(`Found ${pendingRows.length} leftover pending lead(s).`);

        if (pendingRows.length === 0) {
            console.log("Nothing needs cleanup.");
            return;
        }

        for (const row of pendingRows) {
            console.log(
                `- ID ${row.id}: ${row.author} — ${row.city}, ${row.state}`,
            );
        }

        if (DRY_RUN) {
            console.log(
                "Dry run enabled. No database rows were changed.",
            );
            return;
        }

        await client.query("BEGIN");

        const cleanedRows = await cleanRows(
            client,
            pendingRows.map((row) => row.id),
        );

        await client.query("COMMIT");

        console.log(
            `Cleaned ${cleanedRows.length} row(s) by setting ` +
            `ftn_enrichment_status='${CLEANUP_STATUS}' and ` +
            "ftn_enriched_at=NOW().",
        );
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // There may not be an active transaction.
        }

        console.error(
            "Cleanup failed:",
            error instanceof Error ? error.stack : String(error),
        );
        process.exitCode = 1;
    } finally {
        if (lockAcquired) {
            try {
                await releaseLock(client);
            } catch (error) {
                console.error(
                    "Could not release advisory lock:",
                    error.message,
                );
            }
        }

        client.release();
        await pool.end();

        console.log(
            `Finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
        );
    }
}

main();
