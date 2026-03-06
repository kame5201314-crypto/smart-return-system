#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadDotenv } from 'dotenv';

const EXPECTED_PROJECT_ID = 'fdzfnenizyppxglypden';
const PROJECT_NAME = 'smart-return-system';

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '\n').trim();
}

function loadEnvironmentFiles() {
  const cwd = process.cwd();
  const candidates = [
    '.env.local',
    '.env.production.local',
  ];

  const loaded = [];
  for (const file of candidates) {
    const fullPath = path.resolve(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    loadDotenv({ path: fullPath, override: true, quiet: true });
    loaded.push(file);
  }

  return loaded;
}

function verifyEnvironment() {
  const loadedFiles = loadEnvironmentFiles();
  console.log('Verifying environment variables...\n');
  if (loadedFiles.length > 0) {
    console.log(`Loaded env files: ${loadedFiles.join(', ')}`);
  } else {
    console.log('Loaded env files: none (using existing process env)');
  }

  let hasErrors = false;

  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!supabaseUrl) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is not set');
    hasErrors = true;
  } else if (!supabaseUrl.includes(EXPECTED_PROJECT_ID)) {
    console.error('NEXT_PUBLIC_SUPABASE_URL does not match expected project');
    console.error(`Expected project ID: ${EXPECTED_PROJECT_ID}`);
    console.error(`Current URL: ${supabaseUrl}`);
    hasErrors = true;
  } else {
    console.log('NEXT_PUBLIC_SUPABASE_URL: OK');
  }

  const anonKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!anonKey) {
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
    hasErrors = true;
  } else {
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY: OK');
  }

  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
    hasErrors = true;
  } else {
    console.log('SUPABASE_SERVICE_ROLE_KEY: OK');
  }

  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL);
  if (!appUrl) {
    console.warn('NEXT_PUBLIC_APP_URL is not set');
  } else {
    console.log('NEXT_PUBLIC_APP_URL: OK');
  }

  const cronSecret = normalizeEnvValue(process.env.CRON_SECRET);
  if (!cronSecret) {
    console.warn('CRON_SECRET is not set');
  } else {
    console.log('CRON_SECRET: OK');
  }

  const geminiKey = normalizeEnvValue(process.env.GEMINI_API_KEY);
  if (!geminiKey) {
    console.warn('GEMINI_API_KEY is not set (AI analysis will not work)');
  } else {
    console.log('GEMINI_API_KEY: OK');
  }

  console.log(`\nProject: ${PROJECT_NAME}`);
  console.log(`Expected Supabase project: ${EXPECTED_PROJECT_ID}`);

  if (hasErrors) {
    console.error('\nEnvironment verification failed.');
    return false;
  }

  console.log('\nEnvironment verification passed.');
  return true;
}

const isValid = verifyEnvironment();
process.exit(isValid ? 0 : 1);
