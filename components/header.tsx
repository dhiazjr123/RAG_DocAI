// components/header.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LogOut, HelpCircle, User2, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function Header() {
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      const target = e.target as Node | null;
      if (target && !menuRef.current.contains(target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="border-b border-border bg-card/70 glass soft-shadow sticky top-0 z-[80]">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Image src="/neurabot2.png" alt="RAG Document AI" width={32} height={32} className="h-8 w-8" priority />
          <span className="text-xl font-semibold text-gradient">RAG Document AI</span>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-xs">Enterprise Department</Badge>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="ring-ambient icon-press"><HelpCircle className="h-4 w-4" /></Button>
            <Button variant="default" size="sm" className="ring-ambient btn-gradient btn-press" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
            <div className="relative" ref={menuRef}>
              <button
                className="rounded-full focus:outline-none icon-press"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/1.jpg" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-popover border border-border rounded-md shadow-md z-[90]">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 icon-press"
                    onClick={() => { setMenuOpen(false); router.push("/profile"); }}
                  >
                    <User2 className="h-4 w-4" /> Profile
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 icon-press"
                    onClick={() => { setMenuOpen(false); router.push("/setting"); }}
                  >
                    <Settings className="h-4 w-4" /> Setting
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
