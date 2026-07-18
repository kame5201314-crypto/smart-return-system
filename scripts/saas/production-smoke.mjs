#!/usr/bin/env node

import process from 'node:process';

const DEFAULT_BASE_URL = 'https://smart-return-system-saas.vercel.app';

const args = process.argv.slice(2);
const explicitUrl = args.find((arg) => arg.startsWith('--url='))?.slice('--url='.length);
const explicitTimeout = args.find((arg) => arg.startsWith('--timeout-ms='))
  ?.slice('--timeout-ms='.length);
const expectAccountRegistration = args.includes('--expect-account-registration')
  || ['1', 'true', 'yes', 'on'].includes(
    String(process.env.SAAS_PRODUCTION_SMOKE_EXPECT_ACCOUNT_REGISTRATION || '')
      .trim()
      .toLowerCase()
  );
const baseUrl = normalizeBaseUrl(explicitUrl || process.env.SAAS_PRODUCTION_URL || DEFAULT_BASE_URL);
const requestTimeoutMs = normalizeTimeoutMs(
  explicitTimeout || process.env.SAAS_PRODUCTION_SMOKE_TIMEOUT_MS
);

const checks = [];

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function normalizeTimeoutMs(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= 250 && parsed <= 30_000
    ? parsed
    : 10_000;
}

function record(status, label, detail = '') {
  checks.push({ status, label, detail });
}

function statusIcon(status) {
  if (status === 'pass') return 'PASS';
  if (status === 'warn') return 'WARN';
  return 'FAIL';
}

async function get(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      redirect: options.redirect || 'follow',
      headers: {
        'user-agent': 'smart-return-saas-production-smoke/1.0',
      },
      signal: controller.signal,
    });
    const text = options.text ? await response.text() : '';
    const json = options.json ? await response.json() : null;
    return { url, response, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function expectStatus(path, expectedStatus) {
  try {
    const { response } = await get(path, { redirect: 'manual' });
    if (response.status === expectedStatus) {
      record('pass', `${path} status`, `${response.status}`);
      return response;
    }
    record('fail', `${path} status`, `expected ${expectedStatus}, got ${response.status}`);
    return response;
  } catch (error) {
    record('fail', `${path} status`, error.message);
    return null;
  }
}

async function expectRedirect(path, expectedLocationPattern) {
  try {
    const { response } = await get(path, { redirect: 'manual' });
    const location = response.headers.get('location') || '';
    const isRedirect = response.status >= 300 && response.status < 400;
    if (isRedirect && expectedLocationPattern.test(location)) {
      record('pass', `${path} redirect`, `${response.status} -> ${location}`);
      return;
    }
    record(
      'fail',
      `${path} redirect`,
      `expected ${expectedLocationPattern}, got ${response.status} -> ${location || '(empty)'}`,
    );
  } catch (error) {
    record('fail', `${path} redirect`, error.message);
  }
}

async function checkPricing() {
  try {
    const { response, text } = await get('/pricing', { text: true });
    if (response.status !== 200) {
      record('fail', '/pricing content', `expected 200, got ${response.status}`);
      return;
    }

    const has499 = /499/.test(text);
    const has699 = /699/.test(text);
    const hasOld1490 = /1,490|1490/.test(text);
    const hasOld2990 = /2,990|2990/.test(text);

    record(has499 ? 'pass' : 'fail', '/pricing has 499 marker');
    record(has699 ? 'pass' : 'fail', '/pricing has 699 marker');
    record(hasOld1490 ? 'fail' : 'pass', '/pricing has no old 1490 marker');
    record(hasOld2990 ? 'fail' : 'pass', '/pricing has no old 2990 marker');
  } catch (error) {
    record('fail', '/pricing content', error.message);
  }
}

async function checkAccountRegistration() {
  let signupText = '';
  try {
    const { response, text } = await get('/login?plan=growth', { text: true });
    if (response.status !== 200) {
      record('fail', '/login account registration content', `expected 200, got ${response.status}`);
    } else {
      record(
        text.includes('註冊新帳號') ? 'pass' : 'fail',
        '/login has account registration action'
      );
      record(
        text.includes('/signup?plan=growth') ? 'pass' : 'fail',
        '/login preserves growth signup plan'
      );
    }
  } catch (error) {
    record('fail', '/login account registration content', error.message);
  }

  try {
    const { response, text } = await get('/signup?plan=growth', { text: true });
    if (response.status !== 200) {
      record('fail', '/signup account registration content', `expected 200, got ${response.status}`);
      return;
    }
    signupText = text;

    record(
      text.includes('id="signup-identifier"') && text.includes('手機／信箱')
        ? 'pass'
        : 'fail',
      '/signup has the direct phone or Email registration form'
    );
    record(
      !text.includes('使用 Google 繼續') && !text.includes('lead-capture-form')
        ? 'pass'
        : 'fail',
      '/signup omits Google and manual application UI'
    );
  } catch (error) {
    record('fail', '/signup account registration content', error.message);
  }

  try {
    const { response, json } = await get('/api/saas/signup/readiness', { json: true });
    if (response.status !== 200) {
      record(
        'fail',
        '/api/saas/signup/readiness status',
        `expected 200, got ${response.status}`
      );
      return;
    }

    const readiness = json?.data;
    const hasExactReadinessShape = (
      json?.success === true &&
      readiness &&
      typeof readiness === 'object' &&
      typeof readiness.emailEnabled === 'boolean' &&
      typeof readiness.phoneEnabled === 'boolean' &&
      Object.keys(readiness).sort().join(',') === 'emailEnabled,phoneEnabled'
    );
    record(
      hasExactReadinessShape ? 'pass' : 'fail',
      '/api/saas/signup/readiness boolean contract'
    );

    const cacheControl = response.headers.get('cache-control') || '';
    record(
      cacheControl.toLowerCase().includes('no-store') ? 'pass' : 'fail',
      '/api/saas/signup/readiness no-store',
      cacheControl || '(empty)'
    );

    if (hasExactReadinessShape && signupText) {
      const hasUnavailableEmailShell = signupText.includes(
        'email-signup-unavailable-notice'
      );
      record(
        !hasUnavailableEmailShell && signupText.includes('id="signup-identifier"')
          ? 'pass'
          : 'fail',
        '/signup keeps one registration form without rollout notices'
      );
    }
  } catch (error) {
    record('fail', '/api/saas/signup/readiness contract', error.message);
  }
}

async function checkPlatformAdminEntry() {
  try {
    const { response, text } = await get('/admin/login?next=%2Finternal', { text: true });
    if (response.status !== 200) {
      record('fail', '/admin/login dedicated content', `expected 200, got ${response.status}`);
      return;
    }

    record(
      text.includes('平台管理後台登入') && text.includes('商家請改用一般登入入口')
        ? 'pass'
        : 'fail',
      '/admin/login has dedicated platform-admin copy'
    );
    record(
      !text.includes('使用 Google 繼續') && !text.includes('建立帳號')
        ? 'pass'
        : 'fail',
      '/admin/login omits merchant Google and registration actions'
    );
  } catch (error) {
    record('fail', '/admin/login dedicated content', error.message);
  }
}

async function main() {
  console.log(
    `[saas-production-smoke] baseUrl=${baseUrl} timeoutMs=${requestTimeoutMs} `
      + `expectAccountRegistration=${expectAccountRegistration}`
  );

  for (const path of [
    '/',
    '/pricing',
    '/signup',
    '/login',
    '/forgot-password',
    '/robots.txt',
    '/sitemap.xml',
  ]) {
    await expectStatus(path, 200);
  }

  await checkPricing();
  await checkPlatformAdminEntry();
  if (expectAccountRegistration) {
    await checkAccountRegistration();
  }

  for (const path of ['/analytics', '/shopee-returns', '/analytics/ai-report', '/settings/team']) {
    await expectRedirect(path, /\/login(?:\?|$)/);
  }

  await expectRedirect('/internal', /\/admin\/login\?next=%2Finternal/);
  await expectRedirect('/internal/orgs', /\/admin\/login\?next=%2Finternal%2Forgs/);
  await expectRedirect('/admin', /\/admin\/login\?next=%2Finternal/);
  await expectRedirect('/reset-password', /\/login(?:\?|$)/);

  let failed = 0;
  let warned = 0;
  for (const check of checks) {
    if (check.status === 'fail') failed += 1;
    if (check.status === 'warn') warned += 1;
    console.log(`[${statusIcon(check.status)}] ${check.label}${check.detail ? ` - ${check.detail}` : ''}`);
  }

  console.log(`[saas-production-smoke] ${checks.length - failed - warned} pass, ${warned} warn, ${failed} fail`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[saas-production-smoke] fatal: ${error.message}`);
  process.exit(1);
});
