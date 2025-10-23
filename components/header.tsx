// components/header.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
<<<<<<< HEAD
import { LogOut, HelpCircle, User2, Settings } from "lucide-react";
=======
import { LogOut, HelpCircle, Settings, User, ChevronDown } from "lucide-react";
>>>>>>> fdd87e3 (WIP: simpan perubahan lokal sebelum rebase)
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Header() {
  const router = useRouter();
  const supabase = createClient();
<<<<<<< HEAD
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
=======
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Update dropdown position when opened
  useEffect(() => {
    if (isDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right - window.scrollX
      });
    }
  }, [isDropdownOpen]);
>>>>>>> fdd87e3 (WIP: simpan perubahan lokal sebelum rebase)

  const onLogout = async () => {
    await supabase.auth.signOut();  // clear session Supabase
    router.replace("/login");
    router.refresh();
  };

<<<<<<< HEAD
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
=======
  const handleProfileClick = () => {
    console.log("Profile clicked");
    setIsDropdownOpen(false);
    router.push('/profile');
  };

  const handleSettingsClick = () => {
    console.log("Settings clicked");
    setIsDropdownOpen(false);
    router.push('/settings');
  };

  return (
    <header className="border-b border-border bg-card/70 glass soft-shadow relative z-[100]">
>>>>>>> fdd87e3 (WIP: simpan perubahan lokal sebelum rebase)
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Image src="/neurabot2.png" alt="RAG Document AI" width={32} height={32} className="h-8 w-8" priority />
          <span className="text-xl font-semibold text-gradient">RAG Document AI</span>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-xs">Enterprise Department</Badge>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="ring-ambient"><HelpCircle className="h-4 w-4" /></Button>
<<<<<<< HEAD
            <Button variant="default" size="sm" className="ring-ambient btn-gradient" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
            <div className="relative" ref={menuRef}>
              <button
                className="rounded-full focus:outline-none"
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
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60"
                    onClick={() => { setMenuOpen(false); router.push("/profile"); }}
                  >
                    <User2 className="h-4 w-4" /> Profile
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60"
                    onClick={() => { setMenuOpen(false); router.push("/setting"); }}
                  >
                    <Settings className="h-4 w-4" /> Setting
                  </button>
                </div>
              )}
            </div>
=======
            
            {/* Custom Dropdown */}
            <div className="relative">
              <Button 
                ref={triggerRef}
                variant="ghost" 
                className="relative h-8 w-8 rounded-full ring-ambient hover:bg-accent p-0"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarImage src="/1.jpg" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </Button>
            </div>
            
            {/* Portal Dropdown */}
            {isDropdownOpen && createPortal(
              <div 
                ref={dropdownRef}
                className="fixed w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-md z-[99999]"
                style={{
                  top: dropdownPosition.top,
                  right: dropdownPosition.right
                }}
              >
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium">John Doe</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">john.doe@example.com</p>
                </div>
                
                <div className="py-1">
                  <button
                    onClick={handleProfileClick}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </button>
                  <button
                    onClick={handleSettingsClick}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </button>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center text-red-600 dark:text-red-400"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>,
              document.body
            )}
>>>>>>> fdd87e3 (WIP: simpan perubahan lokal sebelum rebase)
          </div>
        </div>
      </div>
    </header>
  );
}
