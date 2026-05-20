#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadDotenv } from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.saas.local');

if (!fs.existsSync(envPath)) {
  console.error('[saas-env] Missing .env.saas.local');
  console.error('[saas-env] Copy .env.saas.example to .env.saas.local and fill SaaS-only values.');
  process.exit(1);
}

loadDotenv({ path: envPath, override: true, quiet: true });

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('[saas-env] Missing command to run');
  console.error('[saas-env] Example: node scripts/saas/run-with-saas-env.mjs npm run build');
  process.exit(1);
}

const [command, ...commandArgs] = args;
const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
const useShell = process.platform === 'win32' && executable.endsWith('.cmd');

const result = spawnSync(executable, commandArgs, {
  stdio: 'inherit',
  env: process.env,
  shell: useShell,
});

if (result.error) {
  console.error(`[saas-env] Failed to run command: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
