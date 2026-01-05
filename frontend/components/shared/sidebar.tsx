"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  FileSearch,
  ListChecks,
  MessageSquareWarning,
  Settings,
  BarChart3,
  Shield,
  FolderSync,
} from "lucide-react";

const navigation = [
  {
    name: "素材管理",
    href: "/assets",
    icon: ImageIcon,
  },
  {
    name: "雙屏審核",
    href: "/review",
    icon: FileSearch,
  },
  {
    name: "規則庫",
    href: "/rules",
    icon: ListChecks,
  },
  {
    name: "反饋單",
    href: "/feedback",
    icon: MessageSquareWarning,
  },
  {
    name: "侵權監控",
    href: "/infringement",
    icon: Shield,
  },
  {
    name: "營運儀表板",
    href: "/metrics",
    icon: BarChart3,
  },
  {
    name: "雲端同步",
    href: "/settings/cloud",
    icon: FolderSync,
  },
  {
    name: "系統設定",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileSearch className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">AI Visual QC</span>
          <span className="text-xs text-muted-foreground">視覺品管自動化</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium">Operations Hub</p>
          <p className="text-xs text-muted-foreground">v1.0.0</p>
        </div>
      </div>
    </aside>
  );
}
