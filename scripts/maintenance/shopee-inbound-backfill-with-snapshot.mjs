#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { config as loadDotenv } from 'dotenv';

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').replace(/\n/g, '').trim();
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    envFile: '.env.vercel.production',
    outputDir: 'supabase/backups',
    execute: false,
    restoreFile: '',
    limit: 5000,
  };

  for (const arg of args) {
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    if (arg.startsWith('--env-file=')) {
      options.envFile = arg.split('=')[1].trim();
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.split('=')[1].trim();
      continue;
    }
    if (arg.startsWith('--restore-file=')) {
      options.restoreFile = arg.split('=')[1].trim();
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value > 0) {
        options.limit = Math.floor(value);
      }
    }
  }

  return options;
}

function resolveFromCwd(targetPath) {
  if (!targetPath) return '';
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);
}

function ensureEnv(options) {
  const envFilePath = resolveFromCwd(options.envFile);
  if (envFilePath) {
    loadDotenv({ path: envFilePath, override: true, quiet: true });
  }

  const baseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!baseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  return { baseUrl, serviceRoleKey, envFilePath };
}

async function supabaseRequest(ctx, { method = 'GET', table, query, body, prefer = '' }) {
  const url = new URL(`/rest/v1/${table}`, ctx.baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = {
    apikey: ctx.serviceRoleKey,
    authorization: `Bearer ${ctx.serviceRoleKey}`,
  };

  if (prefer) {
    headers.Prefer = prefer;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`${method} ${url.pathname}${url.search} failed (${response.status}): ${payload}`);
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function loadBackfillTargets(ctx, limit) {
  const data = await supabaseRequest(ctx, {
    method: 'GET',
    table: 'shopee_returns',
    query: {
      select: 'id,order_number,is_scanned,is_inbound,scanned_at,inbound_at,updated_at',
      is_scanned: 'is.true',
      is_inbound: 'is.false',
      order: 'order_number.asc',
      limit,
    },
  });

  return toArray(data);
}

async function loadSummary(ctx) {
  const [all, scanned, inbound, scannedNotInbound] = await Promise.all([
    supabaseRequest(ctx, { method: 'GET', table: 'shopee_returns', query: { select: 'id', limit: 5000 } }),
    supabaseRequest(ctx, { method: 'GET', table: 'shopee_returns', query: { select: 'id', is_scanned: 'is.true', limit: 5000 } }),
    supabaseRequest(ctx, { method: 'GET', table: 'shopee_returns', query: { select: 'id', is_inbound: 'is.true', limit: 5000 } }),
    supabaseRequest(ctx, {
      method: 'GET',
      table: 'shopee_returns',
      query: { select: 'id', is_scanned: 'is.true', is_inbound: 'is.false', limit: 5000 },
    }),
  ]);

  return {
    total: toArray(all).length,
    scanned: toArray(scanned).length,
    inbound: toArray(inbound).length,
    scannedNotInbound: toArray(scannedNotInbound).length,
  };
}

function buildSnapshotPath(outputDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(resolveFromCwd(outputDir), `shopee-inbound-backfill-${stamp}.json`);
}

async function writeSnapshotFile(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function runBackfill(ctx, options) {
  const targets = await loadBackfillTargets(ctx, options.limit);
  const before = await loadSummary(ctx);

  console.log(`[backfill] env file: ${ctx.envFilePath}`);
  console.log(`[backfill] before: total=${before.total}, scanned=${before.scanned}, inbound=${before.inbound}, scanned_not_inbound=${before.scannedNotInbound}`);
  console.log(`[backfill] targets=${targets.length}`);

  if (targets.length === 0) {
    console.log('[backfill] no target rows, nothing to do.');
    return;
  }

  const snapshotPath = buildSnapshotPath(options.outputDir);
  const snapshot = {
    mode: 'backfill',
    created_at: new Date().toISOString(),
    criteria: 'is_scanned=true AND is_inbound=false',
    rows: targets,
  };
  await writeSnapshotFile(snapshotPath, snapshot);

  console.log(`[backfill] snapshot saved: ${snapshotPath}`);
  console.log('[backfill] use this file with --restore-file=<path> if rollback is needed.');

  if (!options.execute) {
    console.log('[backfill] dry-run only. add --execute to apply changes.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const row of targets) {
    const now = new Date().toISOString();
    const inboundAt = row.scanned_at || now;

    try {
      await supabaseRequest(ctx, {
        method: 'PATCH',
        table: 'shopee_returns',
        query: { id: `eq.${row.id}` },
        body: {
          is_inbound: true,
          inbound_at: inboundAt,
          updated_at: now,
        },
        prefer: 'return=minimal',
      });
      updated += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[backfill] failed id=${row.id}: ${message}`);
    }
  }

  const after = await loadSummary(ctx);
  console.log(`[backfill] updated=${updated}, failed=${failed}`);
  console.log(`[backfill] after: total=${after.total}, scanned=${after.scanned}, inbound=${after.inbound}, scanned_not_inbound=${after.scannedNotInbound}`);
}

async function runRestore(ctx, options) {
  const snapshotPath = resolveFromCwd(options.restoreFile);
  if (!snapshotPath) {
    throw new Error('Missing --restore-file');
  }

  const raw = await fs.readFile(snapshotPath, 'utf8');
  const parsed = JSON.parse(raw);
  const rows = toArray(parsed?.rows);

  if (rows.length === 0) {
    throw new Error('Snapshot has no rows');
  }

  console.log(`[restore] env file: ${ctx.envFilePath}`);
  console.log(`[restore] snapshot: ${snapshotPath}`);
  console.log(`[restore] rows=${rows.length}`);

  if (!options.execute) {
    console.log('[restore] dry-run only. add --execute to apply restore.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const now = new Date().toISOString();
    try {
      await supabaseRequest(ctx, {
        method: 'PATCH',
        table: 'shopee_returns',
        query: { id: `eq.${row.id}` },
        body: {
          is_inbound: !!row.is_inbound,
          inbound_at: row.inbound_at || null,
          updated_at: now,
        },
        prefer: 'return=minimal',
      });
      updated += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[restore] failed id=${row.id}: ${message}`);
    }
  }

  const after = await loadSummary(ctx);
  console.log(`[restore] updated=${updated}, failed=${failed}`);
  console.log(`[restore] after: total=${after.total}, scanned=${after.scanned}, inbound=${after.inbound}, scanned_not_inbound=${after.scannedNotInbound}`);
}

async function main() {
  const options = parseArgs(process.argv);
  const ctx = ensureEnv(options);

  if (options.restoreFile) {
    await runRestore(ctx, options);
    return;
  }

  await runBackfill(ctx, options);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[shopee-inbound-backfill-with-snapshot] Failed:', message);
  process.exitCode = 1;
});
