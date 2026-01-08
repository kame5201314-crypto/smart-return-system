'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  Brain,
  Menu,
  LogOut,
  Loader2,
  Truck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Toaster } from '@/components/ui/sonner';
import { getCurrentUser, signOut } from '@/lib/actions/auth';
import { toast } from 'sonner';

const navItems = [
  { href: '/dashboard', label: '總覽', icon: LayoutDashboard },
  { href: '/returns', label: '退貨管理', icon: Package },
  { href: '/analytics', label: '數據中心', icon: BarChart3, exact: true },
  { href: '/analytics/ai-report', label: 'AI 分析', icon: Brain },
  { href: '/logistics', label: '物流快查', icon: Truck },
];

interface UserInfo {
  id: string;
  email: string | undefined;
  name: string;
  role: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center h-16 px-6 border-b hover:bg-gray-50 transition-colors">
            <Package className="w-8 h-8 text-primary" />
            <span className="ml-2 text-lg font-bold">退貨管理系統</span>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-purple-100 text-purple-600">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || '載入中...'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="登出"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <span className="font-bold">退貨管理</span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
                <Link href="/dashboard" className="flex items-center h-16 px-6 border-b hover:bg-gray-50 transition-colors" onClick={() => setMobileOpen(false)}>
                  <Package className="w-6 h-6 text-primary" />
                  <span className="ml-2 font-bold">退貨管理系統</span>
                </Link>
                <nav className="flex-1 px-4 py-4 space-y-1">
                  {navItems.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${isActive
                            ? 'bg-primary text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
                {/* Mobile User Section */}
                <div className="p-4 border-t">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar>
                      <AvatarFallback className="bg-purple-100 text-purple-600">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user?.name || '載入中...'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4 mr-2" />
                    )}
                    登出
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-6">{children}</div>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
