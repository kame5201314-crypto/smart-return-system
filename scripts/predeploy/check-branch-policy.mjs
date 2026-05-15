#!/usr/bin/env node

import { execSync } from 'node:child_process';

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseBool(value, defaultValue = false) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  if (!normalized) return defaultValue;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function isProductionDeployment() {
  const isVercel = normalizeEnvValue(process.env.VERCEL) === '1';
  const vercelEnv = normalizeEnvValue(process.env.VERCEL_ENV).toLowerCase();
  return isVercel && vercelEnv === 'production';
}

function currentBranch() {
  const envBranch =
    normalizeEnvValue(process.env.VERCEL_GIT_COMMIT_REF) ||
    normalizeEnvValue(process.env.GITHUB_REF_NAME) ||
    normalizeEnvValue(process.env.BRANCH_NAME) ||
    normalizeEnvValue(process.env.CI_COMMIT_BRANCH);

  if (envBranch) return envBranch;

  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function failOrWarn(message, strict) {
  if (strict) {
    console.error(`${message} (strict mode: fail)`);
    process.exitCode = 1;
    return;
  }

  console.warn(`${message} (non-strict mode: warning)`);
}

function main() {
  if (parseBool(process.env.BRANCH_POLICY_BYPASS, false)) {
    console.warn('[branch-policy] Bypassed by BRANCH_POLICY_BYPASS');
    return;
  }

  const appMode = normalizeEnvValue(process.env.APP_MODE).toLowerCase();
  if (!appMode) {
    console.log('[branch-policy] APP_MODE is not set; skip');
    return;
  }

  if (!['internal', 'saas'].includes(appMode)) {
    failOrWarn(`[branch-policy] Invalid APP_MODE "${appMode}"`, true);
    return;
  }

  const strict = parseBool(process.env.BRANCH_POLICY_STRICT, false) || isProductionDeployment();
  const branch = currentBranch();

  if (!branch) {
    failOrWarn('[branch-policy] Unable to determine git branch', strict);
    return;
  }

  const expectedBranch =
    appMode === 'saas'
      ? normalizeEnvValue(process.env.SAAS_ALLOWED_BRANCH) || 'develop-saas'
      : normalizeEnvValue(process.env.INTERNAL_ALLOWED_BRANCH) || 'master';

  if (branch !== expectedBranch) {
    failOrWarn(
      `[branch-policy] APP_MODE=${appMode} must deploy from ${expectedBranch}, current branch is ${branch}`,
      strict
    );
    return;
  }

  console.log(`[branch-policy] PASS (APP_MODE=${appMode}, branch=${branch})`);
}

main();
