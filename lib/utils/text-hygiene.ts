function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

export function isLikelyMojibakeText(input: string): boolean {
  const text = input.trim();
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

export function containsLikelyMojibake(value: unknown): boolean {
  const stack: unknown[] = [value];
  const visited = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === 'string') {
      if (isLikelyMojibakeText(current)) return true;
      continue;
    }

    if (current && typeof current === 'object') {
      if (visited.has(current)) continue;
      visited.add(current);

      if (Array.isArray(current)) {
        for (const item of current) {
          stack.push(item);
        }
      } else {
        for (const item of Object.values(current)) {
          stack.push(item);
        }
      }
    }
  }

  return false;
}
