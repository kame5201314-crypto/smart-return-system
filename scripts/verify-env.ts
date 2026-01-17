/**
 * Environment Variables Verification Script
 * Run before deployment to ensure correct Supabase project is configured
 *
 * Usage: npx ts-node scripts/verify-env.ts
 * Or: npm run verify-env
 */

// Expected Supabase project ID for smart-return-system
const EXPECTED_PROJECT_ID = 'fdzfnenizyppxglypden';
const PROJECT_NAME = 'smart-return-system';

function verifyEnvironment(): boolean {
  console.log('🔍 Verifying environment variables...\n');

  let hasErrors = false;

  // Check NEXT_PUBLIC_SUPABASE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
    hasErrors = true;
  } else if (!supabaseUrl.includes(EXPECTED_PROJECT_ID)) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL does not match expected project!');
    console.error(`   Expected project ID: ${EXPECTED_PROJECT_ID}`);
    console.error(`   Current URL: ${supabaseUrl}`);
    console.error(`   This may cause data to be written to the WRONG database!`);
    hasErrors = true;
  } else {
    console.log('✅ NEXT_PUBLIC_SUPABASE_URL - Correct project');
  }

  // Check NEXT_PUBLIC_SUPABASE_ANON_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
    hasErrors = true;
  } else {
    console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY - Set');
  }

  // Check SUPABASE_SERVICE_ROLE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    hasErrors = true;
  } else {
    console.log('✅ SUPABASE_SERVICE_ROLE_KEY - Set');
  }

  // Check GEMINI_API_KEY (optional but recommended for AI features)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.warn('⚠️  GEMINI_API_KEY is not set (AI analysis will not work)');
  } else {
    console.log('✅ GEMINI_API_KEY - Set');
  }

  console.log('\n' + '='.repeat(50));

  if (hasErrors) {
    console.error(`\n❌ Environment verification FAILED for ${PROJECT_NAME}`);
    console.error(`\nPlease check your .env.local file or Vercel environment variables.`);
    console.error(`\nExpected Supabase project: ${EXPECTED_PROJECT_ID}`);
    console.error(`Dashboard: https://supabase.com/dashboard/project/${EXPECTED_PROJECT_ID}`);
    return false;
  }

  console.log(`\n✅ Environment verification PASSED for ${PROJECT_NAME}`);
  console.log(`   Supabase Project: ${EXPECTED_PROJECT_ID}`);
  return true;
}

// Run verification
const isValid = verifyEnvironment();
process.exit(isValid ? 0 : 1);
