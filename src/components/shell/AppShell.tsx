"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileEdit,
  History,
  BookOpen,
  GitBranch,
  CheckSquare,
  TrendingDown,
  BarChart3,
  Users,
  Settings,
  ShieldAlert,
  Menu,
  X,
  Search,
  Bell,
  Plus,
  LogOut,
  Building,
} from "lucide-react";
import { OrgRole } from "@/lib/permissions";
import { signOutUser } from "@/app/actions/auth";
import { StatusLED } from "@/components/ui/status-led";

interface AppShellProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    department?: string;
  };
  organisation: {
    id: string;
    name: string;
    slug: string;
    isDemo: boolean;
  };
  role: OrgRole;
  isDemoMode: boolean;
  aiMode: "live_ai" | "demo";
  children: React.ReactNode;
}

const navItems = [
  { label: "01 OVERVIEW", href: "/overview", icon: LayoutDashboard },
  { label: "02 CONTENT STUDIO", href: "/studio", icon: FileEdit },
  { label: "03 AUDIT HISTORY", href: "/audits", icon: History },
  { label: "04 BRAND KNOWLEDGE", href: "/knowledge", icon: BookOpen },
  { label: "05 CLAIM PROVENANCE", href: "/provenance", icon: GitBranch },
  { label: "06 REVIEW QUEUE", href: "/reviews", icon: CheckSquare },
  { label: "07 BRAND DRIFT", href: "/drift", icon: TrendingDown },
  { label: "08 GOVERNANCE INSIGHTS", href: "/insights", icon: BarChart3 },
  { label: "09 TEAM & ACCESS", href: "/team", icon: Users },
  { label: "10 SETTINGS", href: "/settings", icon: Settings },
];

export function AppShell({
  user,
  organisation,
  role,
  isDemoMode,
  aiMode,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#F4F1E8] flex">
      {/* 1. Desktop Fixed Sidebar (visible on lg: screens >= 1024px) */}
      <aside className="hidden lg:flex w-64 bg-white brutal-border border-r-2 flex-col h-screen fixed left-0 top-0 z-30">
        {/* Brand Header */}
        <div className="p-4 border-b-2 border-[#253C2B] bg-[#F4F1E8]">
          <Link href="/overview" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-[#16834A] text-white flex items-center justify-center font-bold font-mono text-base brutal-border brutal-shadow-sm">
              PL
            </div>
            <div>
              <span className="font-mono font-extrabold text-lg tracking-tight text-[#17251C] block leading-none">
                PROOFLOOM
              </span>
              <span className="font-mono text-[9px] font-bold text-[#16834A] uppercase tracking-wider block mt-1">
                BRAND INTEGRITY ENGINE
              </span>
            </div>
          </Link>
          <div className="mt-2.5 px-2 py-1 bg-white brutal-border text-[10px] font-mono text-[#637367] leading-tight">
            Tagline: Where every brand claim has a thread of proof.
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/overview" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-2.5 px-3 py-2 text-xs font-mono font-bold uppercase transition-all rounded-[2px] ${
                  isActive
                    ? "bg-[#16834A] text-[#B7F28B] brutal-border brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
                    : "text-[#17251C] hover:bg-[#DDEBDD] hover:text-[#16834A]"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-[#B7F28B]" : "text-[#637367]"
                  }`}
                />
                <span className="tracking-wider truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Role & Demo Switcher Footer */}
        <div className="p-3 border-t-2 border-[#253C2B] bg-[#F4F1E8]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-bold text-[#637367] uppercase">
              ACTIVE ROLE
            </span>
            <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 bg-[#17251C] text-[#B7F28B] uppercase brutal-border">
              {role.replace("_", " ")}
            </span>
          </div>

          {isDemoMode && (
            <Link
              href="/demo"
              className="flex items-center justify-center space-x-1.5 w-full py-1.5 px-2 bg-white brutal-border text-[11px] font-mono font-bold text-[#17251C] hover:bg-[#DDEBDD] brutal-shadow-sm"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#16834A]" />
              <span>SWITCH DEMO ROLE &rarr;</span>
            </Link>
          )}
        </div>
      </aside>

      {/* 2. Mobile Drawer Backdrop & Drawer Panel (visible < 1024px when toggled) */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#17251C]/70"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-white brutal-border border-r-2 h-full flex flex-col z-50">
            {/* Header */}
            <div className="p-4 border-b-2 border-[#253C2B] bg-[#F4F1E8] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#16834A] text-white flex items-center justify-center font-bold font-mono text-sm brutal-border">
                  PL
                </div>
                <span className="font-mono font-extrabold text-base tracking-tight text-[#17251C]">
                  PROOFLOOM
                </span>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 brutal-border bg-white hover:bg-[#D94C4C] hover:text-white transition-colors"
                aria-label="Close Navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav list */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/overview" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center space-x-2.5 px-3 py-2 text-xs font-mono font-bold uppercase transition-all rounded-[2px] ${
                      isActive
                        ? "bg-[#16834A] text-[#B7F28B] brutal-border brutal-shadow-sm"
                        : "text-[#17251C] hover:bg-[#DDEBDD]"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-[#B7F28B]" : "text-[#637367]"
                      }`}
                    />
                    <span className="tracking-wider">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Footer */}
            <div className="p-3 border-t-2 border-[#253C2B] bg-[#F4F1E8] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#637367]">ROLE:</span>
                <span className="font-bold text-[#17251C] uppercase">
                  {role.replace("_", " ")}
                </span>
              </div>
              {isDemoMode && (
                <Link
                  href="/demo"
                  className="block text-center py-1.5 bg-[#B7F28B] text-[#17251C] brutal-border text-xs font-mono font-bold"
                >
                  SWITCH DEMO ROLE
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Container */}
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
        {/* Persistent Engineering Header */}
        <header className="sticky top-0 z-20 bg-white border-b-2 border-[#253C2B]">
          {/* Demo Alert Banner */}
          {isDemoMode && (
            <div className="bg-[#B7F28B] border-b-2 border-[#253C2B] px-3 sm:px-6 py-1 flex items-center justify-between text-[11px] font-mono font-bold text-[#17251C]">
              <div className="flex items-center space-x-2">
                <StatusLED status="live" />
                <span className="truncate">DEMO ORGANISATION &bull; SEEDED BENCHMARK DATA</span>
              </div>
              <span className="text-[#16834A] uppercase hidden sm:inline">
                {organisation.name} &bull; ACTIVE
              </span>
            </div>
          )}

          {/* Controls Bar */}
          <div className="h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between gap-2">
            {/* Left: Mobile hamburger + Org Selector */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="lg:hidden p-2 brutal-border bg-[#F4F1E8] hover:bg-[#DDEBDD] transition-colors"
                aria-label="Open Navigation Drawer"
              >
                <Menu className="w-4 h-4 text-[#17251C]" />
              </button>

              <div className="flex items-center space-x-2 px-2.5 py-1.5 bg-[#F4F1E8] brutal-border text-xs font-mono font-bold text-[#17251C]">
                <Building className="w-3.5 h-3.5 text-[#16834A]" />
                <span className="truncate max-w-[120px] sm:max-w-none">{organisation.name}</span>
              </div>

              {/* Global search */}
              <div className="relative w-48 xl:w-72 hidden md:block">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#637367]" />
                <input
                  type="text"
                  placeholder="Query audits, facts, rules..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none placeholder:text-[#637367]"
                />
              </div>
            </div>

            {/* Right Actions: LED, Bell, New Audit, Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* System status LED chip */}
              <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 bg-[#F4F1E8] brutal-border text-[11px] font-mono font-bold">
                <StatusLED
                  status={aiMode === "live_ai" ? "live" : "demo"}
                  label={aiMode === "live_ai" ? "LIVE AI (GEMINI)" : "DEMO (RULE-BASED)"}
                />
              </div>

              {/* Notifications */}
              <Link
                href="/overview"
                className="relative p-2 bg-[#F4F1E8] brutal-border hover:bg-[#DDEBDD] transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4 text-[#17251C]" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#D94C4C] text-white font-mono text-[9px] font-bold flex items-center justify-center rounded-full">
                  2
                </span>
              </Link>

              {/* + NEW AUDIT Button */}
              <Link
                href="/studio"
                className="brutal-btn brutal-btn-primary px-3 py-1.5 text-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">NEW AUDIT</span>
              </Link>

              {/* User profile & Logout */}
              <div className="flex items-center space-x-2 pl-2 border-l-2 border-[#253C2B]">
                <div className="text-right hidden xl:block">
                  <span className="block text-xs font-bold text-[#17251C] leading-none">
                    {user.fullName}
                  </span>
                  <span className="block text-[10px] font-mono text-[#637367] uppercase mt-0.5">
                    {role.replace("_", " ")}
                  </span>
                </div>

                <form action={signOutUser}>
                  <button
                    type="submit"
                    title="Sign Out"
                    className="p-2 bg-[#F4F1E8] brutal-border hover:bg-[#D94C4C] hover:text-white transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
