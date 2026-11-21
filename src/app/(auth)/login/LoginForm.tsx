"use client";

import * as React from "react";
import { useActionState } from "react";
import { signInWithEmail, requestPasswordResetAction } from "@/app/actions/auth";
import { ArrowRight, AlertCircle, Mail, CheckCircle2 } from "lucide-react";

export function LoginForm() {
  const [showForgot, setShowForgot] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetStatus, setResetStatus] = React.useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [isResetting, setIsResetting] = React.useState(false);

  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error?: string } | null, formData: FormData) => {
      return await signInWithEmail(formData);
    },
    null
  );

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return;

    setIsResetting(true);
    setResetStatus(null);

    const res = await requestPasswordResetAction(resetEmail);
    setIsResetting(false);

    if (res.success) {
      setResetStatus({
        success: true,
        message: `Password reset instructions have been sent to ${resetEmail}. Check your inbox.`,
      });
    } else {
      setResetStatus({
        error: res.error || "Failed to send reset link. Please check your email.",
      });
    }
  }

  if (showForgot) {
    return (
      <form onSubmit={handleResetSubmit} className="space-y-4 mb-6 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[#253C2B] pb-2">
          <span className="font-extrabold uppercase text-[#17251C] flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#16834A]" />
            <span>RESET PASSWORD</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setShowForgot(false);
              setResetStatus(null);
            }}
            className="text-[10px] font-bold text-[#16834A] hover:underline cursor-pointer"
          >
            &larr; Back to sign in
          </button>
        </div>

        {resetStatus?.error && (
          <div className="p-2.5 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{resetStatus.error}</span>
          </div>
        )}

        {resetStatus?.success && (
          <div className="p-3 bg-[#DDEBDD] border-2 border-[#16834A] text-[#16834A] text-xs space-y-1">
            <div className="flex items-center space-x-2 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>RESET LINK DISPATCHED</span>
            </div>
            <p className="text-[11px] text-[#17251C]">{resetStatus.message}</p>
          </div>
        )}

        <div>
          <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
            Your Account Email
          </label>
          <input
            type="email"
            required
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="e.g. user@example.com"
            className="w-full px-3 py-2 bg-white brutal-border font-mono text-sm text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
          />
        </div>

        <button
          type="submit"
          disabled={isResetting || Boolean(resetStatus?.success)}
          className="w-full brutal-btn brutal-btn-primary py-2.5 font-bold text-xs tracking-wider flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>{isResetting ? "SENDING RESET LINK..." : "SEND PASSWORD RESET LINK"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-4 mb-6">
      {state?.error && (
        <div className="p-2.5 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
          Email Address
        </label>
        <input
          type="email"
          name="email"
          required
          placeholder="e.g. creator.demo@example.com"
          className="w-full px-3 py-2 bg-white brutal-border font-mono text-sm text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block font-mono text-xs font-bold uppercase text-[#17251C]">
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-[11px] font-mono text-[#16834A] hover:underline font-bold cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
        <input
          type="password"
          name="password"
          required
          placeholder="••••••••••••"
          className="w-full px-3 py-2 bg-white brutal-border font-mono text-sm text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full brutal-btn brutal-btn-primary py-2.5 font-bold text-sm tracking-wider flex items-center justify-center space-x-2 cursor-pointer"
      >
        <span>{isPending ? "AUTHENTICATING..." : "AUTHENTICATE"}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
