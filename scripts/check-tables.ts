import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fdddpvxqcvbcfxmsrlbg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZGRwdnhxY3ZiY2Z4bXNybGJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQxMzc5MiwiZXhwIjoyMDgyOTg5NzkyfQ.KlsjpTqUEdO_EZ9okpDvehLiLOnMDcFS9pMSCHzK3Xg'
);

async function checkTables() {
  console.log('檢查資料表...\n');

  const tables = ['customers', 'orders', 'return_requests', 'return_items', 'return_images', 'activity_logs'];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: ${count} 筆`);
    }
  }
}

checkTables();
