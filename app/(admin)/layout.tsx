'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Brain,
  ClipboardList,
  Loader2,
  LogOut,
  Menu,
  Package,
  Printer,
  Settings,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { getCurrentUser, signOut } from '@/lib/actions/auth';

const navItems = [
  { href: '/analytics', label: '營運總覽', icon: BarChart3, exact: true },
  { href: '/returns', label: '退貨管理', icon: Package },
  { href: '/shopee-returns', label: '蝦皮退貨', icon: Printer },
  { href: '/pickup', label: '取件紀錄', icon: ClipboardList },
  { href: '/logistics', label: '物流管理', icon: Truck },
  { href: '/analytics/ai-report', label: 'AI 分析', icon: Brain },
  { href: '/settings', label: '設定', icon: Settings },
];

interface UserInfo {
  id: string;
  email: string | undefined;
  name: string;
  role: string;
}

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: (typeof navItems)[number];
  pathname: string;
  onClick?: () => void;
}) {
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}

function BrandLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/analytics"
      onClick={onClick}
      className="flex h-16 items-center border-b px-6 transition-colors hover:bg-gray-50"
    >
      <Package className="size-8 text-primary" />
      <span className="ml-2 text-lg font-bold">Smart Return SaaS</span>
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const userData = await getCurrentUser();
      setUser(userData);
    }
    loadUser();
  }, []);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await signOut();
    } catch {
      toast.error('登出失敗');
      setIsLoggingOut(false);
    }
  }

  const userInitial = user?.name?.charAt(0).toUpperCase() || 'A';

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-64 md:flex-col">
        <div className="flex flex-grow flex-col border-r bg-white">
          <BrandLink />
          <nav className="flex-1 space-y-1 px-4 py-4">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-emerald-100 text-emerald-700">{userInitial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.name || '載入中...'}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="登出"
              >
                {isLoggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="fixed inset-x-0 top-0 z-50 border-b bg-white md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Package className="size-6 text-primary" />
            <span className="font-bold">Smart Return SaaS</span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-full flex-col">
                <BrandLink onClick={() => setMobileOpen(false)} />
                <nav className="flex-1 space-y-1 px-4 py-4">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      onClick={() => setMobileOpen(false)}
                    />
                  ))}
                </nav>
                <div className="border-t p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user?.name || '載入中...'}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 size-4" />
                    )}
                    登出
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <main className="min-h-screen min-w-0 pt-16 md:ml-64 md:pt-0">
        <div className="w-full min-w-0 px-4 py-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
