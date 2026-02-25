import { RETURN_ITEM_RESOLUTION_TYPES } from '@/config/constants';

export type ReturnItemResolutionType =
  typeof RETURN_ITEM_RESOLUTION_TYPES[keyof typeof RETURN_ITEM_RESOLUTION_TYPES]['key'];

const RETURN_ITEM_RESOLUTION_TYPE_SET = new Set(
  Object.values(RETURN_ITEM_RESOLUTION_TYPES).map((item) => item.key)
);

export function isReturnItemResolutionType(value: string): value is ReturnItemResolutionType {
  return RETURN_ITEM_RESOLUTION_TYPE_SET.has(value as ReturnItemResolutionType);
}

export function normalizeResolutionTypeFromFallback(value: unknown): ReturnItemResolutionType {
  if (typeof value !== 'string') {
    return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
  }

  if (isReturnItemResolutionType(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'full' || lower === 'full_refund' || lower === 'full refund') {
    return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
  }
  if (lower === 'partial' || lower === 'partial_refund' || lower === 'partial refund') {
    return RETURN_ITEM_RESOLUTION_TYPES.PARTIAL.key;
  }
  if (lower === 'exchange') {
    return RETURN_ITEM_RESOLUTION_TYPES.EXCHANGE.key;
  }
  if (lower === 'round_trip' || lower === 'round trip') {
    return RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.key;
  }

  if (trimmed === RETURN_ITEM_RESOLUTION_TYPES.FULL.label) {
    return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
  }
  if (trimmed === RETURN_ITEM_RESOLUTION_TYPES.PARTIAL.label) {
    return RETURN_ITEM_RESOLUTION_TYPES.PARTIAL.key;
  }
  if (trimmed === RETURN_ITEM_RESOLUTION_TYPES.EXCHANGE.label) {
    return RETURN_ITEM_RESOLUTION_TYPES.EXCHANGE.key;
  }
  if (trimmed === RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.label) {
    return RETURN_ITEM_RESOLUTION_TYPES.ROUND_TRIP.key;
  }

  return RETURN_ITEM_RESOLUTION_TYPES.FULL.key;
}

export function applyFallbackResolutionTypeToItems<T extends Record<string, unknown>>(
  items: T[] | null | undefined,
  fallbackValue: unknown
): Array<T & { resolution_type: ReturnItemResolutionType }> {
  const fallbackResolution = normalizeResolutionTypeFromFallback(fallbackValue);
  return (items || []).map((item) => {
    const current = typeof item.resolution_type === 'string'
      ? item.resolution_type
      : null;
    const normalized = current && isReturnItemResolutionType(current)
      ? current
      : fallbackResolution;

    return {
      ...item,
      resolution_type: normalized,
    };
  });
}

