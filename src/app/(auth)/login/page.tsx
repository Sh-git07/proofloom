import { LoginForm } from "./LoginForm";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const isDemoEnabled =
    process.env.DEMO_MODE_ENABLED === "true" ||
    process.env.DEMO_MODE_ENABLED === "1";

  return (
    <div className="min-h-screen bg-[#F4F1E8] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md brutal-card bg-white p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center space-x-2 mb-2">
            <div className="w-8 h-8 bg-[#16834A] text-white flex items-center justify-center font-bold font-mono brutal-border">
              PL
            </div>
            <h1 className="font-mono font-extrabold text-2xl tracking-tight text-[#17251C]">
              PROOFLOOM
            </h1>
          </div>
          <p className="font-mono text-xs text-[#637367] uppercase tracking-wider">
            Brand Governance Authentication
          </p>
        </div>

        {/* Form */}
        <LoginForm />

        {/* Demo Mode Quick Access */}
        {isDemoEnabled && (
          <div className="pt-4 border-t-2 border-[#253C2B] text-center">
            <p className="text-xs text-[#637367] mb-3 font-mono">
              Demo environment active. Skip credentials with one-click access:
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center space-x-2 w-full py-2 px-4 brutal-border bg-[#B7F28B] text-[#17251C] font-mono font-bold text-xs uppercase tracking-wider brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-[#16834A]" />
              <span>EXPLORE VIA DEMO PORTAL (4 ROLES) &rarr;</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
