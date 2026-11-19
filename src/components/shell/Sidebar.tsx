"use client";

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
  LogOut,
} from "lucide-react";
import { signOutUser } from "@/app/actions/auth";
import { OrgRole } from "@/lib/permissions";

interface SidebarProps {
  currentRole: OrgRole;
  isDemoMode: boolean;
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

export function Sidebar({ currentRole, isDemoMode }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white brutal-border border-r-2 flex-shrink-0 flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Brand Header */}
      <div className="p-4 border-b-2 border-[#253C2B] bg-[#F4F1E8]">
        <Link href="/overview" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#16834A] text-white flex items-center justify-center font-bold font-mono text-sm brutal-border">
            PL
          </div>
          <div>
            <span className="font-mono font-extrabold text-lg tracking-tight text-[#17251C] block leading-none">
              PROOFLOOM
            </span>
            <span className="font-mono text-[9px] text-[#637367] uppercase tracking-wider block mt-0.5">
              Brand Governance
            </span>
          </div>
        </Link>
        <p className="mt-2 text-[10px] text-[#637367] italic leading-tight">
          Where every brand claim has a thread of proof.
        </p>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/overview" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`flex items-center space-x-2.5 px-3 py-2 text-xs font-mono font-bold uppercase transition-all rounded-[2px] ${
                isActive
                  ? "bg-[#16834A] text-white brutal-border brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
                  : "text-[#17251C] hover:bg-[#DDEBDD] hover:text-[#16834A]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#B7F28B]" : "text-[#637367]"}`} />
              <span className="tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role Indicator & Demo Switcher */}
      <div className="p-3 border-t-2 border-[#253C2B] bg-[#F4F1E8]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase">
            ACTIVE ROLE
          </span>
          <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 bg-[#17251C] text-[#B7F28B] uppercase">
            {currentRole.replace("_", " ")}
          </span>
        </div>

        {isDemoMode && (
          <Link
            href="/demo"
            className="flex items-center justify-center space-x-1 w-full py-1.5 px-2 bg-white brutal-border text-[11px] font-mono font-bold text-[#17251C] hover:bg-[#DDEBDD] brutal-shadow-sm mb-2"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#16834A]" />
            <span>SWITCH DEMO ROLE &rarr;</span>
          </Link>
        )}

        <form action={signOutUser}>
          <button
            type="submit"
            className="flex items-center justify-center space-x-1.5 w-full py-1.5 px-2 bg-[#F4F1E8] hover:bg-[#D94C4C] hover:text-white brutal-border text-[11px] font-mono font-bold text-[#17251C] transition-colors cursor-pointer"
            title="Log out and return to home"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>LOG OUT</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
