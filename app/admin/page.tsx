import { redirect } from 'next/navigation';

import { PLATFORM_ADMIN_HOME_PATH } from '@/lib/auth/internal-login-redirect';

export default function AdminEntryPage() {
  redirect(PLATFORM_ADMIN_HOME_PATH);
}
