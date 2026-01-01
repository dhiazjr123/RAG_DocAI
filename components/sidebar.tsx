// components/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bot, BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Sidebar() {                    // ⬅️ export default
  const pathname = usePathname();
  const menu = [
    { href: "/assistant-workspace", label: "AI Assistant", icon: Bot },
    { href: "/", label: "Overview", icon: BarChart3 },
    { href: "/documents", label: "Kelola Dokumen", icon: FileText },
  ];

  return (
    <aside className="w-80 border-r border-border bg-sidebar/60 glass soft-shadow h-[calc(100vh-4rem)]">
      <div className="p-4">
        <nav className="space-y-2">
          {menu.map((m) => {
            const active = pathname === m.href;
            const Icon = m.icon;
            return (
              <Link key={m.href} href={m.href} className="block">
                <Button
                  variant={active ? "default" : "ghost"}
                  className={cn("w-full justify-start gap-2 btn-press", active && "btn-gradient")}
                >
                  <Icon className="h-4 w-4" />
                  {m.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
