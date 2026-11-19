import { signInDemoUser } from "@/app/actions/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shield, Sparkles, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  const isDemoEnabled =
    process.env.DEMO_MODE_ENABLED === "true" ||
    process.env.DEMO_MODE_ENABLED === "1";

  if (!isDemoEnabled) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F4F1E8] flex flex-col items-center justify-center p-4">
      {/* Back to Home Link */}
      <div className="w-full max-w-xl mb-3">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 font-mono text-xs font-bold text-[#17251C] hover:text-[#16834A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>&larr; Back to home</span>
        </Link>
      </div>

      {/* Neo-brutalist Container */}
      <div className="w-full max-w-xl brutal-card bg-white p-6 sm:p-8">
        {/* Banner */}
        <div className="bg-[#B7F28B] brutal-border py-2 px-3 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="status-led status-led-live" />
            <span className="font-mono text-xs font-bold tracking-wider text-[#17251C] uppercase">
              DEMO ORGANISATION — SEEDED DEMONSTRATION DATA
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-[#16834A]">NOVA CREATIVE</span>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            title="Go to Proofloom Home"
            className="inline-flex items-center justify-center space-x-2 mb-2 group hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 bg-[#16834A] text-white flex items-center justify-center font-bold font-mono brutal-border group-hover:bg-[#126b3c] transition-colors">
              PL
            </div>
            <h1 className="font-mono font-extrabold text-2xl tracking-tight text-[#17251C] group-hover:text-[#16834A] transition-colors">
              PROOFLOOM
            </h1>
          </Link>
          <p className="font-mono text-xs text-[#637367] uppercase tracking-wider mb-2">
            Where every brand claim has a thread of proof.
          </p>
          <p className="text-sm text-[#17251C] font-medium max-w-md mx-auto">
            Select an authorized team role to enter the governance control environment.
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Admin */}
          <form action={signInDemoUser.bind(null, "admin")}>
            <button
              type="submit"
              className="w-full text-left p-4 brutal-border bg-[#F4F1E8] hover:bg-[#DDEBDD] brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-[#17251C] text-white">
                  01 ADMIN
                </span>
                <Shield className="w-4 h-4 text-[#16834A]" />
              </div>
              <h3 className="font-bold text-sm text-[#17251C] group-hover:text-[#16834A]">
                Alex Vance
              </h3>
              <p className="text-xs text-[#637367] mt-1 font-mono">
                Executive &bull; Full settings, critical overrides & member control
              </p>
            </button>
          </form>

          {/* Brand Manager */}
          <form action={signInDemoUser.bind(null, "brand_manager")}>
            <button
              type="submit"
              className="w-full text-left p-4 brutal-border bg-[#F4F1E8] hover:bg-[#DDEBDD] brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-[#16834A] text-white">
                  02 BRAND MANAGER
                </span>
                <Sparkles className="w-4 h-4 text-[#16834A]" />
              </div>
              <h3 className="font-bold text-sm text-[#17251C] group-hover:text-[#16834A]">
                Morgan Riley
              </h3>
              <p className="text-xs text-[#637367] mt-1 font-mono">
                Brand Governance &bull; Knowledge vault, guidelines & facts
              </p>
            </button>
          </form>

          {/* Creator */}
          <form action={signInDemoUser.bind(null, "creator")}>
            <button
              type="submit"
              className="w-full text-left p-4 brutal-border bg-[#B7F28B] hover:bg-[#a6ec73] brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-[#17251C] text-[#B7F28B]">
                  03 CREATOR (RECOMMENDED)
                </span>
                <ArrowRight className="w-4 h-4 text-[#17251C]" />
              </div>
              <h3 className="font-bold text-sm text-[#17251C]">
                Casey Jordan
              </h3>
              <p className="text-xs text-[#17251C] mt-1 font-mono">
                Product Marketing &bull; Submit content, run audits, accept rewrites
              </p>
            </button>
          </form>

          {/* Reviewer */}
          <form action={signInDemoUser.bind(null, "reviewer")}>
            <button
              type="submit"
              className="w-full text-left p-4 brutal-border bg-[#F4F1E8] hover:bg-[#DDEBDD] brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-extrabold px-2 py-0.5 bg-[#637367] text-white">
                  04 REVIEWER
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#16834A]" />
              </div>
              <h3 className="font-bold text-sm text-[#17251C] group-hover:text-[#16834A]">
                Sam Taylor
              </h3>
              <p className="text-xs text-[#637367] mt-1 font-mono">
                Legal & Compliance &bull; Review queue, challenges & signoffs
              </p>
            </button>
          </form>
        </div>

        {/* Footer info & link */}
        <div className="border-t-2 border-[#253C2B] pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-xs text-[#637367]">
          <span>DEMO PASSWORD: ChangeMe-Demo-2026!</span>
          <Link
            href="/login"
            className="text-[#16834A] font-bold hover:underline"
          >
            Sign in with your account &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
