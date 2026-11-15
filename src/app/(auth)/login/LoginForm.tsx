"use client";

import { useActionState } from "react";
import { signInWithEmail } from "@/app/actions/auth";
import { ArrowRight, AlertCircle } from "lucide-react";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error?: string } | null, formData: FormData) => {
      return await signInWithEmail(formData);
    },
    null
  );

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
        <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
          Password
        </label>
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
        className="w-full brutal-btn brutal-btn-primary py-2.5 font-bold text-sm tracking-wider flex items-center justify-center space-x-2"
      >
        <span>{isPending ? "AUTHENTICATING..." : "AUTHENTICATE"}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
