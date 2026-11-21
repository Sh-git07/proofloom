import { LoginForm } from "./LoginForm";
import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const context = await getCurrentUserContext();
  if (context?.user && context?.organisation) {
    redirect("/overview");
  }

  const isDemoEnabled =
    process.env.DEMO_MODE_ENABLED === "true" ||
    process.env.DEMO_MODE_ENABLED === "1";

  return (
    <div className="min-h-screen bg-[#F4F1E8] flex flex-col items-center justify-center p-4">
      {/* Back to Home Link */}
      <div className="w-full max-w-md mb-3">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 font-mono text-xs font-bold text-[#17251C] hover:text-[#16834A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>&larr; Back to home</span>
        </Link>
      </div>

      <div className="w-full max-w-md brutal-card bg-white p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
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
          <p className="font-mono text-xs text-[#637367] uppercase tracking-wider">
            Brand Governance Authentication
          </p>
        </div>

        {/* Form */}
        <LoginForm />

        {/* Links: Create an account & Try the demo */}
        <div className="pt-4 border-t-2 border-[#253C2B] text-center space-y-2.5 font-mono text-xs">
          <p className="text-[#637367]">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-[#16834A] font-bold underline hover:text-[#17251C] transition-colors"
            >
              Create an account
            </Link>
          </p>

          <p className="text-[#637367]">
            Evaluating the platform?{" "}
            <Link
              href="/demo"
              className="text-[#16834A] font-bold underline hover:text-[#17251C] transition-colors"
            >
              Try the demo
            </Link>
          </p>
          {isDemoEnabled && (
            <Link
              href="/demo"
              className="inline-flex items-center justify-center space-x-2 w-full py-2 px-4 brutal-border bg-[#B7F28B] text-[#17251C] font-mono font-bold text-xs uppercase tracking-wider brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all mt-2"
            >
              <ShieldCheck className="w-4 h-4 text-[#16834A]" />
              <span>EXPLORE VIA DEMO PORTAL (4 ROLES) &rarr;</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
