#!/usr/bin/env node

const { Client } = require('pg');

loadEnv('.env');

const databaseUrl = process.env.DATABASE_URL;
const adminToken = process.env.INTERNAL_ADMIN_TOKEN;
const apiUrl = process.env.INTERNAL_API_URL || 'http://127.0.0.1:3000';
const fallbackApiUrl = process.env.INTERNAL_API_FALLBACK_URL || 'http://api:3000';
const waitMs = Number(process.env.PROCESS_PENDING_WAIT_MS || 120_000);

if (!databaseUrl) {
  fail('DATABASE_URL is required');
}

if (!adminToken) {
  fail('INTERNAL_ADMIN_TOKEN is required');
}

async function main() {
  const resolvedApiUrl = await waitForApi();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const statusBefore = await messageStatus(client);
    console.log('[process-pending] message status before:', statusBefore);

    const range = await pendingRange(client);
    if (!range || Number(range.count) === 0) {
      console.log('[process-pending] No pending messages.');
      return;
    }

    if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_MODEL) {
      console.log('[process-pending] WARN: OPENROUTER_API_KEY or OPENROUTER_MODEL is empty in this container.');
      console.log('[process-pending] Extraction will complete but release messages back to pending.');
    }

    const periodStart = new Date(range.period_start);
    periodStart.setSeconds(periodStart.getSeconds() - 1);
    const periodEnd = new Date(range.period_end);
    periodEnd.setSeconds(periodEnd.getSeconds() + 1);

    const payload = {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };

    console.log('[process-pending] triggering extraction:', payload);
    await post(resolvedApiUrl, '/internal/jobs/extract', payload);

    const settled = await waitUntilSettled(client, waitMs);
    console.log('[process-pending] message status after extraction wait:', settled.status);

    if (Number(settled.status.pending ?? 0) > 0) {
      console.log('[process-pending] Pending messages remain. Check worker logs and ai-runs before reporting.');
      return;
    }

    console.log('[process-pending] triggering report:', payload);
    await post(resolvedApiUrl, '/internal/jobs/report', payload);
    console.log('[process-pending] Done. Refresh dashboard in a few seconds.');
  } finally {
    await client.end();
  }
}

async function messageStatus(client) {
  const result = await client.query(`
    select processing_status, count(*)::int as count
    from messages
    group by processing_status
    order by processing_status
  `);

  return Object.fromEntries(result.rows.map((row) => [row.processing_status, row.count]));
}

async function pendingRange(client) {
  const result = await client.query(`
    select count(*)::int as count, min(sent_at) as period_start, max(sent_at) as period_end
    from messages
    where processing_status = 'pending'
  `);

  return result.rows[0];
}

async function waitUntilSettled(client, timeoutMs) {
  const startedAt = Date.now();
  let lastStatus = await messageStatus(client);

  while (Date.now() - startedAt < timeoutMs) {
    const pending = Number(lastStatus.pending ?? 0);
    const processing = Number(lastStatus.processing ?? 0);
    if (pending === 0 && processing === 0) {
      return { status: lastStatus, timedOut: false };
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
    lastStatus = await messageStatus(client);
  }

  return { status: lastStatus, timedOut: true };
}

async function waitForApi() {
  const urls = [apiUrl, fallbackApiUrl].filter((url, index, list) => list.indexOf(url) === index);
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < 60_000) {
    for (const url of urls) {
      try {
        const response = await fetch(`${url}/health`);
        if (response.ok) {
          console.log(`[process-pending] API ready at ${url}`);
          return url;
        }
        lastError = new Error(`${url}/health returned ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw lastError ?? new Error('API did not become ready');
}

async function post(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': adminToken,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${text}`);
  }

  console.log(`[process-pending] ${path}:`, text);
}

function loadEnv(envPath) {
  const fs = require('node:fs');
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    process.env[key] = process.env[key] ?? value;
  }
}

function fail(message) {
  console.error(`[process-pending] ${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
