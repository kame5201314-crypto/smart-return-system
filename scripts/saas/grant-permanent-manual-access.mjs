#!/usr/bin/env node

import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ACTION = 'platform.billing.permanent_manual_access_granted';

function normalized(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseArguments(argv) {
  const parsed = {
    apply: false,
    email: null,
    reason: 'explicit_account_owner_authorization',
  };

  for (const argument of argv) {
    if (argument === '--apply') {
      parsed.apply = true;
    } else if (argument.startsWith('--email=')) {
      parsed.email = normalized(argument.slice('--email='.length))?.toLowerCase() ?? null;
    } else if (argument.startsWith('--reason=')) {
      parsed.reason = normalized(argument.slice('--reason='.length)) ?? parsed.reason;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!parsed.email || !parsed.email.includes('@')) {
    throw new Error('A valid --email=name@example.com argument is required.');
  }

  return parsed;
}

function requireEnvironment(name) {
  const value = normalized(process.env[name]);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assertExpectedProject(url, expectedProjectId) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is invalid.');
  }

  if (!hostname.startsWith(`${expectedProjectId}.`)) {
    throw new Error('Supabase URL does not match SAAS_SUPABASE_PROJECT_ID.');
  }
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function assertData(result, message) {
  if (result.error) throw new Error(`${message}: ${result.error.message}`);
  return result.data;
}

async function findUniqueUserByEmail(client, email) {
  const matches = [];
  const perPage = 200;

  for (let page = 1; page <= 100; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage });
    if (result.error) throw new Error(`Could not inspect auth users: ${result.error.message}`);

    const users = rows(result.data?.users);
    for (const user of users) {
      if (normalized(user?.email)?.toLowerCase() === email) matches.push(user);
    }
    if (users.length < perPage) break;
  }

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one auth user for the supplied email; found ${matches.length}.`);
  }
  return matches[0];
}

async function exactCount(query, label) {
  const result = await query;
  if (result.error) throw new Error(`Could not verify ${label}: ${result.error.message}`);
  return result.count ?? 0;
}

async function loadTargetState(client, email) {
  const user = await findUniqueUserByEmail(client, email);
  const memberships = assertData(
    await client
      .from('organization_members')
      .select('id, org_id, user_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    'Could not inspect organization memberships'
  );

  if (rows(memberships).length !== 1) {
    throw new Error('The account must have exactly one active organization membership.');
  }
  const membership = memberships[0];
  if (membership.role !== 'owner') {
    throw new Error('Only the active owner of an organization may receive this account-level grant.');
  }

  const organization = assertData(
    await client
      .from('organizations')
      .select('id, name, plan, status, suspension_source, suspended_at, updated_at')
      .eq('id', membership.org_id)
      .single(),
    'Could not load the organization'
  );
  const subscription = assertData(
    await client
      .from('subscriptions')
      .select(
        'id, org_id, plan, provider, status, current_period_start, current_period_end, trial_end, cancel_at_period_end, canceled_at, updated_at'
      )
      .eq('org_id', membership.org_id)
      .single(),
    'Could not load the subscription'
  );

  const [
    selfServiceClaims,
    paidOrders,
    processedManualPayments,
    subscriptionPeriods,
    permanentAccessAuditLogs,
  ] =
    await Promise.all([
      exactCount(
        client
          .from('saas_self_service_trial_claims')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', organization.id),
        'self-service trial claims'
      ),
      exactCount(
        client
          .from('payment_orders')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', organization.id)
          .eq('status', 'paid'),
        'paid payment orders'
      ),
      exactCount(
        client
          .from('billing_events')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', organization.id)
          .eq('provider', 'manual')
          .eq('event_type', 'manual.payment_marked')
          .eq('status', 'processed'),
        'processed manual payments'
      ),
      exactCount(
        client
          .from('subscription_periods')
          .select('id', { count: 'exact', head: true })
          .eq('subscription_id', subscription.id),
        'subscription periods'
      ),
      exactCount(
        client
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', organization.id)
          .eq('action', ACTION)
          .eq('target_id', subscription.id),
        'permanent-access audit logs'
      ),
    ]);

  return {
    user,
    membership,
    organization,
    subscription,
    evidence: {
      selfServiceClaims,
      paidOrders,
      processedManualPayments,
      subscriptionPeriods,
    },
    permanentAccessAuditLogs,
  };
}

function assertEligible(state) {
  if (state.organization.suspension_source === 'platform_admin') {
    throw new Error('A platform-admin suspension must be handled separately.');
  }
  if (state.subscription.provider !== 'manual') {
    throw new Error('Only a manually managed subscription can receive permanent access.');
  }

  const evidenceTotal = Object.values(state.evidence).reduce((sum, count) => sum + count, 0);
  if (evidenceTotal !== 0) {
    throw new Error('The organization has trial or payment evidence and is not eligible.');
  }
}

function isAlreadyPermanent(state) {
  return (
    state.organization.status === 'active' &&
    state.organization.suspension_source === null &&
    state.subscription.provider === 'manual' &&
    state.subscription.status === 'active' &&
    state.subscription.current_period_end === null &&
    state.subscription.trial_end === null &&
    state.subscription.cancel_at_period_end === false
  );
}

function sanitizedResult(state, status, apply) {
  return {
    mode: apply ? 'apply' : 'dry_run',
    status,
    organizationId: state.organization.id,
    subscriptionId: state.subscription.id,
    plan: state.subscription.plan,
    evidence: state.evidence,
    permanentAccessAuditLogs: state.permanentAccessAuditLogs,
  };
}

async function recordPermanentAccessAudit(client, state, reason, source, changedAt) {
  assertData(
    await client.from('audit_logs').insert({
      org_id: state.organization.id,
      actor_user_id: null,
      action: ACTION,
      target_type: 'subscription',
      target_id: state.subscription.id,
      metadata: {
        source,
        reason,
        granted_at: changedAt,
        preserved_plan: state.subscription.plan,
        previous_organization_status: state.organization.status,
        previous_subscription_status: state.subscription.status,
        previous_period_end: state.subscription.current_period_end,
      },
    }),
    'Could not write the permanent-access audit record'
  );
}

async function restorePreviousState(client, state, changes) {
  const failures = [];

  if (changes.organization) {
    const result = await client
      .from('organizations')
      .update({
        status: state.organization.status,
        suspension_source: state.organization.suspension_source,
        suspended_at: state.organization.suspended_at,
        updated_at: state.organization.updated_at,
      })
      .eq('id', state.organization.id);
    if (result.error) failures.push(`organization rollback: ${result.error.message}`);
  }

  if (changes.subscription) {
    const result = await client
      .from('subscriptions')
      .update({
        plan: state.subscription.plan,
        provider: state.subscription.provider,
        status: state.subscription.status,
        current_period_start: state.subscription.current_period_start,
        current_period_end: state.subscription.current_period_end,
        trial_end: state.subscription.trial_end,
        cancel_at_period_end: state.subscription.cancel_at_period_end,
        canceled_at: state.subscription.canceled_at,
        updated_at: state.subscription.updated_at,
      })
      .eq('id', state.subscription.id)
      .eq('org_id', state.organization.id);
    if (result.error) failures.push(`subscription rollback: ${result.error.message}`);
  }

  if (failures.length > 0) throw new Error(failures.join('; '));
}

async function grantPermanentAccess(client, state, reason) {
  const changedAt = new Date().toISOString();
  const changes = { organization: false, subscription: false };

  try {
    assertData(
      await client
        .from('subscriptions')
        .update({
          provider: 'manual',
          status: 'active',
          current_period_end: null,
          trial_end: null,
          cancel_at_period_end: false,
          canceled_at: null,
          updated_at: changedAt,
        })
        .eq('id', state.subscription.id)
        .eq('org_id', state.organization.id)
        .select('id')
        .single(),
      'Could not grant permanent subscription access'
    );
    changes.subscription = true;

    assertData(
      await client
        .from('organizations')
        .update({
          status: 'active',
          suspension_source: null,
          suspended_at: null,
          updated_at: changedAt,
        })
        .eq('id', state.organization.id)
        .select('id')
        .single(),
      'Could not activate the organization'
    );
    changes.organization = true;

    await recordPermanentAccessAudit(
      client,
      state,
      reason,
      'explicit_user_authorization',
      changedAt
    );
  } catch (error) {
    await restorePreviousState(client, state, changes);
    throw error;
  }
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const url = requireEnvironment('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  const projectId = requireEnvironment('SAAS_SUPABASE_PROJECT_ID');
  assertExpectedProject(url, projectId);

  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const state = await loadTargetState(client, arguments_.email);
  assertEligible(state);

  if (isAlreadyPermanent(state)) {
    if (state.permanentAccessAuditLogs === 0 && arguments_.apply) {
      await recordPermanentAccessAudit(
        client,
        state,
        arguments_.reason,
        'permanent_state_reconciliation',
        new Date().toISOString()
      );
      const verified = await loadTargetState(client, arguments_.email);
      console.log(JSON.stringify(sanitizedResult(verified, 'audit_record_added', true)));
      return;
    }
    console.log(JSON.stringify(sanitizedResult(state, 'already_permanent', arguments_.apply)));
    return;
  }
  if (!arguments_.apply) {
    console.log(JSON.stringify(sanitizedResult(state, 'eligible', false)));
    return;
  }

  await grantPermanentAccess(client, state, arguments_.reason);
  const verified = await loadTargetState(client, arguments_.email);
  if (!isAlreadyPermanent(verified)) {
    throw new Error('Post-write verification failed.');
  }

  console.log(JSON.stringify(sanitizedResult(verified, 'permanent_access_granted', true)));
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`[grant-permanent-manual-access] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
