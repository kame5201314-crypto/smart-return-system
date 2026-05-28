/**
 * Health Check Script - Smart Return System
 * 執行系統自我診斷
 *
 * 執行方式: npx tsx scripts/health-check.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// 載入 .env.local
config({ path: '.env.local' });

// 載入環境變數
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: unknown;
}

const results: HealthCheckResult[] = [];

function log(result: HealthCheckResult) {
  const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
  console.log(`${icon} ${result.name}: ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, result.details);
  }
  results.push(result);
}

async function checkEnvironmentVariables() {
  console.log('\n📋 環境變數檢查...\n');

  // Supabase URL
  if (SUPABASE_URL && SUPABASE_URL.includes('supabase.co')) {
    log({ name: 'SUPABASE_URL', status: 'pass', message: '已配置' });
  } else {
    log({ name: 'SUPABASE_URL', status: 'fail', message: '未配置或格式錯誤' });
  }

  // Supabase Anon Key
  if (SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.startsWith('eyJ')) {
    log({ name: 'SUPABASE_ANON_KEY', status: 'pass', message: '已配置' });
  } else {
    log({ name: 'SUPABASE_ANON_KEY', status: 'fail', message: '未配置' });
  }

  // Supabase Service Role Key
  if (SUPABASE_SERVICE_KEY && SUPABASE_SERVICE_KEY.startsWith('eyJ')) {
    log({ name: 'SUPABASE_SERVICE_ROLE_KEY', status: 'pass', message: '已配置' });
  } else {
    log({ name: 'SUPABASE_SERVICE_ROLE_KEY', status: 'fail', message: '未配置' });
  }

  // OpenAI API Key
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey.startsWith('sk-')) {
    log({ name: 'OPENAI_API_KEY', status: 'pass', message: '已配置' });
  } else {
    log({ name: 'OPENAI_API_KEY', status: 'warning', message: '未配置 (AI 分析功能將無法使用)' });
  }
}

async function checkSupabaseConnection() {
  console.log('\n🔌 Supabase 連線測試...\n');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Test basic connection
    const { error } = await supabase.from('customers').select('count').limit(1);

    if (error) {
      // 表不存在也算通過，只要連線成功
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        log({
          name: 'Supabase 連線',
          status: 'warning',
          message: '連線成功，但 customers 表不存在',
          details: error.message
        });
      } else {
        log({
          name: 'Supabase 連線',
          status: 'fail',
          message: '連線失敗',
          details: error.message
        });
      }
    } else {
      log({ name: 'Supabase 連線', status: 'pass', message: '連線成功' });
    }

    // Check for infringement_system schema
    const { error: schemaError } = await supabase
      .rpc('get_schemas', {})
      .maybeSingle();

    if (schemaError) {
      // Try direct query to check schema
      const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_schema, table_name')
        .eq('table_schema', 'infringement_system')
        .limit(5);

      if (tableError) {
        log({
          name: 'infringement_system Schema',
          status: 'warning',
          message: '無法驗證 Schema (可能權限不足)',
          details: tableError.message
        });
      } else if (tables && tables.length > 0) {
        log({
          name: 'infringement_system Schema',
          status: 'pass',
          message: `找到 ${tables.length} 個資料表`
        });
      } else {
        log({
          name: 'infringement_system Schema',
          status: 'warning',
          message: 'Schema 可能尚未建立'
        });
      }
    }

  } catch (err) {
    log({
      name: 'Supabase 連線',
      status: 'fail',
      message: '連線異常',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}

async function checkReturnSystemTables() {
  console.log('\n📊 退貨系統資料表檢查...\n');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const tables = ['customers', 'orders', 'return_requests', 'return_items', 'return_images'];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          log({
            name: `資料表: ${table}`,
            status: 'warning',
            message: '資料表不存在'
          });
        } else {
          log({
            name: `資料表: ${table}`,
            status: 'fail',
            message: '查詢失敗',
            details: error.message
          });
        }
      } else {
        log({
          name: `資料表: ${table}`,
          status: 'pass',
          message: `正常 (${count ?? 0} 筆資料)`
        });
      }
    }
  } catch (err) {
    log({
      name: '資料表檢查',
      status: 'fail',
      message: '檢查失敗',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 功能狀態清單');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;

  console.log(`✅ 正常: ${passed}`);
  console.log(`⚠️ 需注意: ${warnings}`);
  console.log(`❌ 需修復: ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('❌ 需修復的項目:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
  }

  if (warnings > 0) {
    console.log('\n⚠️ 需注意的項目:');
    results.filter(r => r.status === 'warning').forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

async function checkCriticalFiles() {
  console.log('\n📁 核心檔案檢查...\n');

  const criticalPaths = [
    { filePath: 'app/(admin)/dashboard/page.tsx', description: 'Admin Dashboard' },
    { filePath: 'app/(admin)/returns/page.tsx', description: 'Returns Management' },
    { filePath: 'app/(admin)/orders/page.tsx', description: 'Orders Management' },
    { filePath: 'app/(admin)/analytics/page.tsx', description: 'Analytics' },
    { filePath: 'app/(admin)/settings/page.tsx', description: 'Settings' },
    { filePath: 'app/(customer)/portal/page.tsx', description: 'Customer Portal' },
    { filePath: 'app/login/page.tsx', description: 'Login Page' },
    { filePath: 'lib/supabase/client.ts', description: 'Supabase Client' },
    { filePath: 'lib/actions/auth.ts', description: 'Auth Actions' },
    { filePath: 'lib/actions/return.actions.ts', description: 'Return Actions' },
    { filePath: 'middleware.ts', description: 'Middleware' },
  ];

  for (const file of criticalPaths) {
    const fullPath = path.join(process.cwd(), file.filePath);
    if (fs.existsSync(fullPath)) {
      log({
        name: `檔案: ${file.description}`,
        status: 'pass',
        message: file.filePath
      });
    } else {
      log({
        name: `檔案: ${file.description}`,
        status: 'fail',
        message: `缺少: ${file.filePath}`
      });
    }
  }
}

async function checkGeminiAPI() {
  console.log('\n🤖 Gemini API 測試...\n');

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    log({
      name: 'Gemini API',
      status: 'warning',
      message: 'GEMINI_API_KEY 未設定 (AI 功能將無法使用)'
    });
    return;
  }

  try {
    // 使用 gemini-2.5-flash-lite 模型
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }],
        }),
      }
    );

    if (response.ok) {
      log({
        name: 'Gemini API',
        status: 'pass',
        message: '連線正常'
      });
    } else {
      const errData = await response.json();
      log({
        name: 'Gemini API',
        status: 'fail',
        message: `API 錯誤: ${response.status}`,
        details: errData.error?.message
      });
    }
  } catch (err) {
    log({
      name: 'Gemini API',
      status: 'fail',
      message: '連線失敗',
      details: err instanceof Error ? err.message : String(err)
    });
  }
}

// Main execution
async function main() {
  console.log('');
  console.log('🏥 Smart Return System - Health Check');
  console.log('='.repeat(60));

  await checkEnvironmentVariables();
  await checkSupabaseConnection();
  await checkReturnSystemTables();
  await checkCriticalFiles();
  await checkGeminiAPI();
  await printSummary();

  // 輸出 JSON 報告
  const report = {
    timestamp: new Date().toISOString(),
    project: 'Smart Return System',
    results
  };
  fs.writeFileSync('health-check-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 報告已儲存至: health-check-report.json\n');
}

main().catch(console.error);
