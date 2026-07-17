#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const PROFILE_CONTEXT = 'authenticated_trial_onboarding';

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function key(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(issues, code) {
  if (!issues.includes(code)) issues.push(code);
}

export function auditPlatformCustomerSyncRows(input) {
  const organizations = rows(input.organizations);
  const members = rows(input.members);
  const subscriptions = rows(input.subscriptions);
  const claims = rows(input.claims);
  const signupRequests = rows(input.signupRequests);
  const authUsersById = input.authUsersById instanceof Map
    ? input.authUsersById
    : new Map(Object.entries(input.authUsersById || {}));

  const issues = [];
  const orgIds = new Set(organizations.map((row) => key(row?.id)).filter(Boolean));
  const subscriptionsByOrg = new Map();
  for (const subscription of subscriptions) {
    const orgId = key(subscription?.org_id);
    if (!orgId) continue;
    subscriptionsByOrg.set(orgId, (subscriptionsByOrg.get(orgId) || 0) + 1);
  }

  const ownerMemberships = new Map();
  for (const member of members) {
    if (member?.role !== 'owner' || member?.status !== 'active') continue;
    const orgId = key(member?.org_id);
    if (!orgId) continue;
    if (!ownerMemberships.has(orgId)) ownerMemberships.set(orgId, []);
    ownerMemberships.get(orgId).push(member);
  }

  const claimByUserId = new Map();
  let verifiedAuthUsers = 0;
  for (const claim of claims) {
    const orgId = key(claim?.org_id);
    const userId = key(claim?.user_id);
    const provider = key(claim?.identity_provider) || 'google';

    if (!orgId || !orgIds.has(orgId)) addIssue(issues, 'claim_without_organization');
    if (!orgId || !subscriptionsByOrg.has(orgId)) addIssue(issues, 'claim_without_subscription');

    const matchingOwner = orgId && userId
      ? (ownerMemberships.get(orgId) || []).some((member) => key(member?.user_id) === userId)
      : false;
    if (!matchingOwner) addIssue(issues, 'claim_without_matching_active_owner');

    if (!userId) {
      addIssue(issues, 'claim_without_auth_user_id');
      continue;
    }

    if (claimByUserId.has(userId) && claimByUserId.get(userId) !== orgId) {
      addIssue(issues, 'auth_user_claims_multiple_organizations');
    }
    claimByUserId.set(userId, orgId);

    const authUser = authUsersById.get(userId);
    if (!authUser) {
      addIssue(issues, 'claim_auth_user_missing');
      continue;
    }

    const providerNames = new Set([
      key(authUser?.app_metadata?.provider),
      ...rows(authUser?.app_metadata?.providers).map(key),
      ...rows(authUser?.identities).map((identity) => key(identity?.provider)),
    ].filter(Boolean));
    const verified = provider === 'phone_otp'
      ? Boolean(authUser?.phone_confirmed_at)
      : provider === 'email_otp'
        ? Boolean(authUser?.email_confirmed_at)
        : providerNames.has('google');
    if (!verified) addIssue(issues, 'claim_auth_identity_not_verified');
    else verifiedAuthUsers += 1;
  }

  let selfServiceProfiles = 0;
  let convertedProfiles = 0;
  for (const request of signupRequests) {
    const metadata = isRecord(request?.metadata) ? request.metadata : {};
    if (metadata.capture_context !== PROFILE_CONTEXT) continue;
    selfServiceProfiles += 1;

    if (request?.status !== 'converted') continue;
    convertedProfiles += 1;
    const orgId = key(request?.org_id);
    const userId = key(metadata.auth_user_id);
    if (!orgId || !orgIds.has(orgId)) addIssue(issues, 'converted_profile_without_organization');
    if (!userId || claimByUserId.get(userId) !== orgId) {
      addIssue(issues, 'converted_profile_claim_mismatch');
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    counts: {
      organizations: organizations.length,
      activeOwnerMemberships: Array.from(ownerMemberships.values())
        .reduce((sum, orgMembers) => sum + orgMembers.length, 0),
      subscriptions: subscriptions.length,
      selfServiceClaims: claims.length,
      verifiedAuthUsers,
      selfServiceProfiles,
      convertedProfiles,
    },
  };
}

function requireEnv(name) {
  const value = key(process.env[name]);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assertSaaSProject(url, expectedProjectId) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is invalid.');
  }
  if (!host.startsWith(`${expectedProjectId}.`)) {
    throw new Error('Supabase URL does not match SAAS_SUPABASE_PROJECT_ID.');
  }
}

async function queryRows(client, table, columns) {
  const { data, error } = await client.from(table).select(columns);
  if (error) throw new Error(`Read-only audit could not load ${table}: ${error.message}`);
  return rows(data);
}

async function main() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const projectId = requireEnv('SAAS_SUPABASE_PROJECT_ID');
  assertSaaSProject(url, projectId);

  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [organizations, members, subscriptions, claims, signupRequests] = await Promise.all([
    queryRows(client, 'organizations', 'id,status'),
    queryRows(client, 'organization_members', 'org_id,user_id,role,status'),
    queryRows(client, 'subscriptions', 'org_id,status'),
    queryRows(client, 'saas_self_service_trial_claims', 'org_id,user_id,identity_provider'),
    queryRows(client, 'signup_requests', 'org_id,status,metadata'),
  ]);

  const authUsersById = new Map();
  for (const userId of new Set(claims.map((claim) => key(claim?.user_id)).filter(Boolean))) {
    const { data, error } = await client.auth.admin.getUserById(userId);
    if (error) throw new Error(`Read-only audit could not verify an auth user: ${error.message}`);
    if (data?.user) authUsersById.set(userId, data.user);
  }

  const result = auditPlatformCustomerSyncRows({
    organizations,
    members,
    subscriptions,
    claims,
    signupRequests,
    authUsersById,
  });

  const countText = Object.entries(result.counts)
    .map(([name, count]) => `${name}=${count}`)
    .join(' ');
  console.log(`[platform-customer-sync-audit] ${countText}`);

  if (!result.ok) {
    for (const issue of result.issues) console.error(`[FAIL] ${issue}`);
    process.exitCode = 1;
    return;
  }

  console.log('[platform-customer-sync-audit] PASS: customer identity, tenant, owner, subscription, and onboarding links are consistent.');
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`[platform-customer-sync-audit] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
