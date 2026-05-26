import { Eye } from 'lucide-react';

import { loadPlatformTenantPreviewMode } from '@/lib/saas/platform-tenant-preview';
import { TenantPreviewExitButton } from '@/components/saas/tenant-preview-exit-button';

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export async function TenantPreviewBanner() {
  const mode = await loadPlatformTenantPreviewMode();

  if (mode.state !== 'ready') {
    return null;
  }

  const { preview } = mode;

  return (
    <div
      className="mb-4 rounded-lg border border-orange-300 bg-orange-100 p-3 text-orange-950 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
            <Eye className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              你正在以「{preview.orgName}」身分查看
            </div>
            <div className="text-xs text-orange-900">
              此查看為唯讀檢視，不會影響該租戶資料 · 有效至 {formatExpiry(preview.expiresAt)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0">
          <TenantPreviewExitButton exitPath={preview.exitPath} />
        </div>
      </div>
    </div>
  );
}
