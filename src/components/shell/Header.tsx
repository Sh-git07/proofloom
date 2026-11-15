"use client";

import Link from "next/link";
import { signOutUser } from "@/app/actions/auth";
import { Search, Bell, Plus, LogOut, Building } from "lucide-react";

interface HeaderProps {
  user: {
    fullName: string;
    email: string;
    department?: string;
  };
  organisation: {
    name: string;
    isDemo: boolean;
  };
  role: string;
  isDemoMode: boolean;
  aiMode: "live_ai" | "demo";
  unreadNotificationsCount?: number;
}

export function Header({
  user,
  organisation,
  role,
  isDemoMode,
  aiMode,
  unreadNotificationsCount = 2,
}: HeaderProps) {
  return (
    <header className="fixed top-0 right-0 left-64 z-20 bg-white border-b-2 border-[#253C2B]">
      {/* Demo Banner */}
      {isDemoMode && (
        <div className="bg-[#B7F28B] border-b-2 border-[#253C2B] px-4 py-1 flex items-center justify-between text-xs font-mono font-bold text-[#17251C]">
          <div className="flex items-center space-x-2">
            <span className="status-led status-led-live" />
            <span>DEMO ORGANISATION — SEEDED DEMONSTRATION DATA</span>
          </div>
          <span className="text-[#16834A]">{organisation.name.toUpperCase()} &bull; ACTIVE</span>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="h-16 px-6 flex items-center justify-between">
        {/* Left: Org Selector & Search */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-2.5 py-1.5 bg-[#F4F1E8] brutal-border text-xs font-mono font-bold text-[#17251C]">
            <Building className="w-3.5 h-3.5 text-[#16834A]" />
            <span>{organisation.name}</span>
          </div>

          <div className="relative w-64 hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#637367]" />
            <input
              type="text"
              placeholder="Search audits, facts, rules..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#16834A] placeholder:text-[#637367]"
            />
          </div>
        </div>

        {/* Right: Status LED, Notifications, + NEW AUDIT, User menu */}
        <div className="flex items-center space-x-4">
          {/* System Status LED */}
          <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 bg-[#F4F1E8] brutal-border text-[11px] font-mono font-bold">
            <span
              className={`status-led ${
                aiMode === "live_ai" ? "status-led-live" : "status-led-demo"
              }`}
            />
            <span className={aiMode === "live_ai" ? "text-[#16834A]" : "text-[#E6A23C]"}>
              {aiMode === "live_ai" ? "LIVE AI (GEMINI)" : "DEMO MODE (RULE-BASED)"}
            </span>
          </div>

          {/* Notifications Bell */}
          <Link
            href="/overview"
            className="relative p-2 bg-[#F4F1E8] brutal-border hover:bg-[#DDEBDD] transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-[#17251C]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#D94C4C] text-white font-mono text-[9px] font-bold flex items-center justify-center rounded-full">
                {unreadNotificationsCount}
              </span>
            )}
          </Link>

          {/* New Audit Action */}
          <Link
            href="/studio"
            className="brutal-btn brutal-btn-primary px-3 py-1.5 text-xs flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>NEW AUDIT</span>
          </Link>

          {/* User Profile & Sign Out */}
          <div className="flex items-center space-x-2 pl-2 border-l-2 border-[#253C2B]">
            <div className="text-right hidden sm:block">
              <span className="block text-xs font-bold text-[#17251C] leading-tight">
                {user.fullName}
              </span>
              <span className="block text-[10px] font-mono text-[#637367] uppercase">
                {role.replace("_", " ")}
              </span>
            </div>

            <form action={signOutUser}>
              <button
                type="submit"
                title="Sign Out"
                className="p-1.5 bg-[#F4F1E8] brutal-border hover:bg-[#D94C4C] hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
