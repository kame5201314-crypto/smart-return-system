#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SAAS_BRANCH = 'develop-saas';
const DEFAULT_SAAS_PROJECT_NAME = 'smart-return-system-saas';
const DEFAULT_SAAS_PROJECT_ID = 'prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8';
const DEFAULT_INTERNAL_PROJECT_ID = 'prj_aaRiMeML9D4G7U71QRDZYVonLH8h';

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function gitOutput(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function fail(message) {
  console.error(`[saas-checkout] ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.log(`[saas-checkout] WARN: ${message}`);
}

function pass(message) {
  console.log(`[saas-checkout] ${message}`);
}

function readVercelProject() {
  const projectPath = path.resolve(process.cwd(), '.vercel', 'project.json');
  if (!fs.existsSync(projectPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(projectPath, 'utf8'));
}

function main() {
  const expectedBranch = normalizeEnvValue(process.env.SAAS_ALLOWED_BRANCH) || DEFAULT_SAAS_BRANCH;
  const expectedProjectName =
    normalizeEnvValue(process.env.SAAS_VERCEL_PROJECT_NAME) || DEFAULT_SAAS_PROJECT_NAME;
  const expectedProjectId =
    normalizeEnvValue(process.env.SAAS_VERCEL_PROJECT_ID) || DEFAULT_SAAS_PROJECT_ID;
  const internalProjectId =
    normalizeEnvValue(process.env.INTERNAL_VERCEL_PROJECT_ID) || DEFAULT_INTERNAL_PROJECT_ID;

  let currentBranch = '';
  try {
    currentBranch = gitOutput('git rev-parse --abbrev-ref HEAD');
  } catch {
    fail('Unable to read current git branch');
  }

  if (currentBranch === expectedBranch) {
    pass(`Git branch OK (${currentBranch})`);
  } else {
    fail(`Expected branch ${expectedBranch}, current branch is ${currentBranch || '(unknown)'}`);
  }

  const project = readVercelProject();
  if (!project) {
    warn('No .vercel/project.json found. Link the SaaS Vercel project before deploying.');
  } else {
    if (project.projectName === expectedProjectName) {
      pass(`Vercel project name OK (${project.projectName})`);
    } else {
      fail(`Expected Vercel project ${expectedProjectName}, found ${project.projectName}`);
    }

    if (project.projectId === expectedProjectId) {
      pass(`Vercel project id OK (${project.projectId})`);
    } else {
      fail(`Expected Vercel project id ${expectedProjectId}, found ${project.projectId}`);
    }

    if (project.projectId === internalProjectId) {
      fail(`SaaS checkout is linked to the internal/live Vercel project (${internalProjectId})`);
    }
  }

  if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
    warn('.env.local exists. Keep it SaaS-only in this checkout or remove it before local builds.');
  }

  if (!fs.existsSync(path.resolve(process.cwd(), '.env.saas.local'))) {
    warn('.env.saas.local is missing. SaaS env verification and strict local build cannot run yet.');
  }

  if (process.exitCode) {
    console.error('[saas-checkout] Verification failed.');
    process.exit(process.exitCode);
  }

  pass('Verification passed.');
}

main();
