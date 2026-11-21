import { ResetPasswordForm } from "./ResetPasswordForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#F4F1E8] flex flex-col items-center justify-center p-4">
      {/* Back to Home Link */}
      <div className="w-full max-w-md mb-3">
        <Link
          href="/login"
          className="inline-flex items-center space-x-1.5 font-mono text-xs font-bold text-[#17251C] hover:text-[#16834A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>&larr; Back to sign in</span>
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
            Set New Account Password
          </p>
        </div>

        {/* Reset Password Form */}
        <ResetPasswordForm />

        {/* Footer */}
        <div className="pt-4 border-t-2 border-[#253C2B] text-center font-mono text-xs">
          <p className="text-[#637367]">
            Remember your credentials?{" "}
            <Link
              href="/login"
              className="text-[#16834A] font-bold underline hover:text-[#17251C] transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
