#!/usr/bin/env node
'use strict';

const { Client } = require('pg');

const confirmed = process.argv.includes('--yes');

if (!confirmed) {
  console.error('[clean-derived] Refusing to clean without --yes');
  console.error('[clean-derived] This deletes reports, ai_runs, job_batches, task_events, and tasks. It preserves messages.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[clean-derived] DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('begin');

    const tables = [
      ['reports', 'reports'],
      ['aiRuns', 'ai_runs'],
      ['jobBatches', 'job_batches'],
      ['taskEvents', 'task_events'],
      ['tasks', 'tasks'],
    ];
    const deleted = {};

    for (const [key, table] of tables) {
      const result = await client.query(`delete from ${table}`);
      deleted[key] = result.rowCount;
    }

    await client.query('commit');

    console.log('[clean-derived] Done. Messages were preserved.');
    console.log(JSON.stringify(deleted, null, 2));
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[clean-derived]', error);
  process.exit(1);
});
