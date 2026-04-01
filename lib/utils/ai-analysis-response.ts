export function stripMarkdownCodeFences(text: string): string {
  return text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
}

function extractBalancedJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object found in AI response');
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  throw new Error('Incomplete JSON object in AI response');
}

export function repairCommonJsonIssues(text: string): string {
  return text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\u0000/g, '')
    .trim();
}

export function extractFirstJsonObject(text: string): string {
  const cleaned = stripMarkdownCodeFences(text);

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const balanced = extractBalancedJsonObject(cleaned);

    try {
      JSON.parse(balanced);
      return balanced;
    } catch {
      const repaired = repairCommonJsonIssues(balanced);
      JSON.parse(repaired);
      return repaired;
    }
  }
}

export function parseAIAnalysisResponseText(text: string): Record<string, unknown> {
  const parsed = JSON.parse(extractFirstJsonObject(text));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI response is not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

export function buildAIJsonRepairPrompt(rawResponse: string): string {
  return [
    'You are a JSON repair tool.',
    'Convert the following malformed model output into one strict JSON object.',
    'Return JSON only. Do not wrap in markdown. Do not add commentary.',
    'Required top-level keys: summary, pain_points, recommendations, sku_analysis, channel_analysis.',
    'If a key is missing, use an empty string for summary and empty arrays for the other keys.',
    'Malformed response:',
    rawResponse,
  ].join('\n');
}
