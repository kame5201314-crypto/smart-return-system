#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.sql', '.css', '.scss',
  '.yml', '.yaml', '.txt',
]);

function listTrackedFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()));
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

function main() {
  const files = listTrackedFiles();
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

