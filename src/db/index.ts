import {
    RDSDataClient,
    ExecuteStatementCommand,
    SqlParameter,
} from '@aws-sdk/client-rds-data';
import { config } from '../config';

/**
 * Database access via the Aurora RDS Data API.
 *
 * The Data API is an HTTPS endpoint, so callers (Lambda or your laptop) do not
 * need to be inside the VPC. That lets the Lambda stay outside the VPC and reach
 * Yahoo Finance without a NAT Gateway (~$32/month).
 *
 * `query()` keeps the same shape as the old `pg` Pool.query(): it accepts
 * `$1, $2, ...` placeholders and returns `{ rows }`.
 */

const client = new RDSDataClient({});

// The cluster auto-pauses at 0 ACU. The first request wakes it and fails with
// DatabaseResumingException; resuming takes ~15s, or 30s+ after 24h+ paused.
const RESUME_RETRY_DELAY_MS = 10_000;
const RESUME_MAX_WAIT_MS = 5 * 60_000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toSqlParameter(value: unknown, index: number): SqlParameter {
    const name = `p${index + 1}`;

    if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
        return { name, value: { isNull: true } };
    }
    if (value instanceof Date) {
        // Data API TIMESTAMP format: 'YYYY-MM-DD HH:MM:SS[.FFF]' (UTC)
        return {
            name,
            value: { stringValue: value.toISOString().replace('T', ' ').replace('Z', '') },
            typeHint: 'TIMESTAMP',
        };
    }
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? { name, value: { longValue: value } }
            : { name, value: { doubleValue: value } };
    }
    if (typeof value === 'boolean') {
        return { name, value: { booleanValue: value } };
    }
    if (typeof value === 'string' && DATE_ONLY.test(value)) {
        return { name, value: { stringValue: value }, typeHint: 'DATE' };
    }
    return { name, value: { stringValue: String(value) } };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function query(text: string, params: unknown[] = []): Promise<{ rows: any[] }> {
    const command = new ExecuteStatementCommand({
        resourceArn: config.db.clusterArn,
        secretArn: config.db.secretArn,
        database: config.db.database,
        // Convert pg-style $1 placeholders to Data API named parameters (:p1)
        sql: text.replace(/\$(\d+)/g, ':p$1'),
        parameters: params.map(toSqlParameter),
        formatRecordsAs: 'JSON',
    });

    const start = Date.now();
    while (true) {
        try {
            const result = await client.send(command);
            return { rows: result.formattedRecords ? JSON.parse(result.formattedRecords) : [] };
        } catch (error: any) {
            if (error?.name === 'DatabaseResumingException' && Date.now() - start < RESUME_MAX_WAIT_MS) {
                console.log(`Database is resuming from auto-pause, retrying in ${RESUME_RETRY_DELAY_MS / 1000}s...`);
                await sleep(RESUME_RETRY_DELAY_MS);
                continue;
            }
            throw error;
        }
    }
}

// The Data API is connectionless; kept so callers don't need to change.
export const closeDb = async () => {};
