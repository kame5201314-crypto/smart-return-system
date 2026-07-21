export const SAAS_BILLING_TIME_ZONE = 'Asia/Taipei';

function toValidDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSaaSBillingDate(value: string | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '尚未設定';
  return date.toLocaleDateString('zh-TW', {
    timeZone: SAAS_BILLING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatSaaSBillingDateTime(value: string | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '尚未設定';
  const datePart = date.toLocaleDateString('zh-TW', {
    timeZone: SAAS_BILLING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timePart = date.toLocaleTimeString('zh-TW', {
    timeZone: SAAS_BILLING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${datePart} ${timePart}`;
}
