import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 請設定環境變數 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
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

  const adminUser = users.users.find(u => u.email === 'admin@example.com');

  if (!adminUser) {
    console.log('\nAdmin user not found. Creating new user...');

    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@example.com',
      password: 'admin888',
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
      password: 'admin888',
      email_confirm: true,
    });

    if (error) {
      console.error('Error updating password:', error);
      return;
    }

    console.log('✅ Password updated to admin888');
  }

  // Test login
  console.log('\nTesting login...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'admin@example.com',
    password: 'admin888',
  });

  if (signInError) {
    console.error('Login test failed:', signInError.message);
  } else {
    console.log('✅ Login test successful!');
    console.log('Session:', signInData.session ? 'Created' : 'None');
  }
}

fixAuth();
