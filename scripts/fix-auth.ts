import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

import { isDevAuthFixAllowed } from '../lib/security/dev-auth-fix';

// Dev-only double gate. This script uses the service role to create/reset an
// admin account; it must NEVER run against a SaaS/production database.
// Requires BOTH: APP_MODE=development|local AND ALLOW_DEV_AUTH_FIX=true.
if (!isDevAuthFixAllowed(process.env)) {
  console.error(
    '❌ Refused: fix-auth is dev-only. Set APP_MODE=development (or local) AND ALLOW_DEV_AUTH_FIX=true to run. Never run against SaaS/production.'
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 請設定環境變數 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// No hardcoded password in source. The dev operator supplies it via env.
const devEmail = (process.env.DEV_ADMIN_FIX_EMAIL || 'admin@example.com').trim();
const devPassword = (process.env.DEV_ADMIN_FIX_PASSWORD || '').trim();
if (devPassword.length < 12) {
  console.error('❌ 請以 DEV_ADMIN_FIX_PASSWORD 設定至少 12 字的密碼（不可使用弱密碼）。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixAuth() {
  console.log('Checking users...');

  // List all users
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  console.log('Found users:', users.users.length);
  users.users.forEach(u => {
    console.log(`- ${u.email} (ID: ${u.id})`);
  });

  const adminUser = users.users.find(u => u.email === devEmail);

  if (!adminUser) {
    console.log('\nAdmin user not found. Creating new user...');

    const { data, error } = await supabase.auth.admin.createUser({
      email: devEmail,
      password: devPassword,
      email_confirm: true,
    });

    if (error) {
      console.error('Error creating user:', error);
      return;
    }

    console.log('✅ Admin user created');
    console.log('User ID:', data.user?.id);
  } else {
    console.log('\nAdmin user exists. Updating password...');

    const { error } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: devPassword,
      email_confirm: true,
    });

    if (error) {
      console.error('Error updating password:', error);
      return;
    }

    console.log('✅ Password updated');
  }

  // Test login
  console.log('\nTesting login...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: devEmail,
    password: devPassword,
  });

  if (signInError) {
    console.error('Login test failed:', signInError.message);
  } else {
    console.log('✅ Login test successful!');
    console.log('Session:', signInData.session ? 'Created' : 'None');
  }
}

fixAuth();
