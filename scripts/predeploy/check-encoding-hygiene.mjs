#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.sql', '.css', '.scss',
  '.yml', '.yaml', '.txt',
]);

const SKIP_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.vercel',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

const SKIP_FILES = new Set([
  // Legacy file with known mojibake content; tracked separately for cleanup.
  'app/(admin)/pickup/page.tsx',
]);

function normalizeFilePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function listTextFilesFromFilesystem(dirPath, rootDir = dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) {
      continue;
    }

    const absolutePath = path.join(dirPath, entry.name);
    const relativePath = normalizeFilePath(path.relative(rootDir, absolutePath));

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) {
        continue;
      }
      files.push(...listTextFilesFromFilesystem(absolutePath, rootDir));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

function listTrackedFiles() {
  try {
    const output = execSync('git ls-files', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return output
      .split(/\r?\n/)
      .map((line) => normalizeFilePath(line.trim()))
      .filter(Boolean)
      .filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));
  } catch {
    console.warn('[encoding-hygiene] git ls-files unavailable, using filesystem scan fallback.');
    return listTextFilesFromFilesystem(process.cwd());
  }
}

function hasNullByte(buffer) {
  for (const byte of buffer) {
    if (byte === 0) return true;
  }
  return false;
}

function findTripleQuestionInStringLiterals(text) {
  const findings = [];
  const pattern = /(['"`])(?:\\.|(?!\1)[\s\S])*?\?{3,}(?:\\.|(?!\1)[\s\S])*?\1/g;
  let match;
  while ((match = pattern.exec(text))) {
    const index = match.index;
    const line = text.slice(0, index).split('\n').length;
    findings.push({
      line,
      preview: match[0].slice(0, 120),
    });
  }
  return findings;
}

function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function isLikelyMojibakeText(input) {
  const text = String(input || '').trim();
  if (!text) return false;

  if (text.includes('\uFFFD')) return true;
  if (/\?{3,}/.test(text)) return true;

  const questionCount = countMatches(text, /\?/g);
  if (questionCount === 0) return false;

  const cjkCount = countMatches(text, /[\u3400-\u9FFF]/g);
  const latinCount = countMatches(text, /[A-Za-z]/g);
  const totalSignal = cjkCount + latinCount + questionCount;

  if (cjkCount > 0 && /[\u3400-\u9FFF]\?[\u3400-\u9FFF]/.test(text)) {
    return true;
  }

  if (cjkCount > 0 && questionCount >= 2 && questionCount / Math.max(totalSignal, 1) >= 0.18) {
    return true;
  }

  return false;
}

function findMojibakeRiskInStringLiterals(text) {
  const findings = [];
  const pattern = /(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g;
  let match;

  while ((match = pattern.exec(text))) {
    const literal = match[0].slice(1, -1);
    if (!isLikelyMojibakeText(literal)) {
      continue;
    }

    const index = match.index;
    const line = text.slice(0, index).split('\n').length;
    findings.push({
      line,
      preview: match[0].slice(0, 120),
    });
  }

  return findings;
}

function main() {
  const files = listTrackedFiles().filter((file) => !SKIP_FILES.has(file));
  const violations = [];

  for (const file of files) {
    const buffer = readFileSync(file);
    if (hasNullByte(buffer)) {
      continue;
    }

    const text = buffer.toString('utf8');

    if (text.includes('\uFFFD')) {
      const index = text.indexOf('\uFFFD');
      const line = text.slice(0, index).split('\n').length;
      violations.push({
        file,
        line,
        type: 'replacement-char',
        preview: 'Contains U+FFFD replacement character',
      });
    }

    const tripleQuestionFindings = findTripleQuestionInStringLiterals(text);
    for (const finding of tripleQuestionFindings) {
      violations.push({
        file,
        line: finding.line,
        type: 'triple-question',
        preview: finding.preview,
      });
    }

    const mojibakeFindings = findMojibakeRiskInStringLiterals(text);
    for (const finding of mojibakeFindings) {
      violations.push({
        file,
        line: finding.line,
        type: 'mojibake-risk',
        preview: finding.preview,
      });
    }
  }

  if (violations.length === 0) {
    console.log(`[encoding-hygiene] PASS (${files.length} file(s) scanned).`);
    return;
  }

  console.error('[encoding-hygiene] FAIL - suspicious mojibake patterns found:');
  for (const violation of violations.slice(0, 100)) {
    console.error(
      `  - ${violation.file}:${violation.line} [${violation.type}] ${violation.preview}`
    );
  }
  if (violations.length > 100) {
    console.error(`  ... ${violations.length - 100} more violation(s)`);
  }

  process.exit(1);
}

main();
