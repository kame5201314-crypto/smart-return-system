export function normalizeCandidate(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const MATCHERS: RegExp[] = [
  /(?<![A-Z0-9])TW\d{8,}(?![A-Z0-9])/g,
  /(?<![A-Z0-9])[A-Z]\d{8,14}(?![A-Z0-9])/g,
  /(?<![A-Z0-9])\d{6}[A-Z0-9]{4,}(?![A-Z0-9])/g,
  /(?<![A-Z0-9])\d{8,14}(?![A-Z0-9])/g,
];

export function extractTextScanCandidates(rawText: string): string[] {
  if (!rawText.trim()) {
    return [];
  }

  const normalizedSources = rawText
    .toUpperCase()
    .split(/\r?\n+/)
    .flatMap((line) => {
      const compact = line.replace(/[^A-Z0-9]/g, '');
      return compact && compact !== line ? [line, compact] : [line];
    })
    .filter((source) => source.trim().length > 0);

  const candidates = new Set<string>();

  for (const source of normalizedSources) {
    for (const matcher of MATCHERS) {
      const matches = source.match(matcher) ?? [];
      for (const match of matches) {
        const normalized = normalizeCandidate(match);
        if (normalized.length >= 8) {
          candidates.add(normalized);
        }
      }
    }
  }

  const tokens = rawText
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((token) => normalizeCandidate(token))
    .filter((token) => token.length >= 8);

  for (const token of tokens) {
    candidates.add(token);
  }

  return Array.from(candidates).filter((candidate) => {
    if (!/^\d+$/.test(candidate)) {
      return true;
    }

    return !Array.from(candidates).some((other) => (
      other.length > candidate.length
      && /[A-Z]/.test(other)
      && other.endsWith(candidate)
    ));
  });
}
