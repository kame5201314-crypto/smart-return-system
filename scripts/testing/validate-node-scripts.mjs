import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const scriptsDir = path.join(rootDir, 'scripts');

function walkMjsFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMjsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(fullPath);
    }
  }

  return files;
}

if (!statSync(scriptsDir).isDirectory()) {
  console.error('scripts 目錄不存在');
  process.exit(1);
}

const mjsFiles = walkMjsFiles(scriptsDir).sort();
if (mjsFiles.length === 0) {
  console.log('沒有找到 .mjs 腳本，略過檢查。');
  process.exit(0);
}

for (const file of mjsFiles) {
  const rel = path.relative(rootDir, file);
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'pipe',
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    console.error(`語法檢查失敗: ${rel}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }

  console.log(`OK: ${rel}`);
}

console.log(`腳本語法檢查完成，共 ${mjsFiles.length} 個 .mjs 檔案。`);
