#!/usr/bin/env node

import { execSync } from 'node:child_process';
import path from 'node:path';

const LIVE_CHANGE_ACK = 'I_UNDERSTAND_THIS_TOUCHES_LIVE_VERSION';
const OTHER_BRANCH_ACK = 'I_UNDERSTAND_THIS_IS_A_NONSTANDARD_BRANCH';

function command(commandLine) {
  try {
    return execSync(commandLine, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function fail(message) {
  console.error(`[agent-boundary] ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`[agent-boundary] WARN: ${message}`);
}

function pass(message) {
  console.log(`[agent-boundary] ${message}`);
}

const cwd = process.cwd();
const normalizedCwd = cwd.toLowerCase();
const branch = command('git rev-parse --abbrev-ref HEAD');
const status = command('git status --porcelain');
const remotes = command('git remote -v');

console.log(`[agent-boundary] cwd=${cwd}`);
console.log(`[agent-boundary] branch=${branch || '(unknown)'}`);

if (normalizedCwd.includes('ai自動上架') || normalizedCwd.includes('ai上架')) {
  fail('This appears to be the AI listing project. Do not operate here for return-system work.');
}

if (!remotes.includes('smart-return-system')) {
  fail('Git remote does not look like smart-return-system. Stop before editing.');
}

if (branch === 'master' || branch === 'main') {
  if (process.env.ALLOW_LIVE_VERSION_CHANGE !== LIVE_CHANGE_ACK) {
    fail(
      `Current branch is ${branch}, which is treated as live/protected. Set ALLOW_LIVE_VERSION_CHANGE=${LIVE_CHANGE_ACK} only after explicit user authorization.`
    );
  } else {
    warn(`Live branch override is set for ${branch}. Proceed only with the explicitly authorized live change.`);
  }
} else if (branch === 'develop-saas') {
  pass('SaaS branch OK.');
} else if (process.env.ALLOW_OTHER_BRANCH_WORK !== OTHER_BRANCH_ACK) {
  fail(
    `Unexpected branch "${branch || '(unknown)'}". Set ALLOW_OTHER_BRANCH_WORK=${OTHER_BRANCH_ACK} only for an explicitly authorized task branch.`
  );
}

if (status) {
  warn('Working tree has local changes. Confirm they are expected before continuing.');
}

if (path.basename(cwd).toLowerCase() === 'smart-return-system' && branch === 'develop-saas') {
  warn('This checkout is the original return-system folder but currently on develop-saas. Confirm this is intentional.');
}

if (process.exitCode) {
  console.error('[agent-boundary] Boundary check failed.');
  process.exit(process.exitCode);
}

pass('Boundary check passed.');
