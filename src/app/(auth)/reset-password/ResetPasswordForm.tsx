"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updatePasswordAction } from "@/app/actions/auth";
import { ArrowRight, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "New password must be at least 8 characters long."),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ResetPasswordFormData) {
    setServerError(null);
    const res = await updatePasswordAction(data.password);

    if (!res.success) {
      setServerError(res.error || "Failed to update password. Please try again.");
      return;
    }

    setIsSuccess(true);
  }

  if (isSuccess) {
    return (
      <div className="p-6 bg-[#DDEBDD]/50 brutal-border space-y-4 font-mono text-center">
        <div className="w-12 h-12 bg-[#16834A] text-white brutal-border mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-[#B7F28B]" />
        </div>
        <div className="space-y-1">
          <h2 className="font-extrabold text-base text-[#17251C] uppercase tracking-wide">
            PASSWORD UPDATED SUCCESSFULLY
          </h2>
          <p className="text-xs text-[#17251C] leading-relaxed">
            Your account credentials have been securely updated.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/overview"
            className="w-full brutal-btn brutal-btn-primary py-2.5 text-xs font-bold flex items-center justify-center space-x-1"
          >
            <span>CONTINUE TO DASHBOARD</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mb-6 font-mono">
      {serverError && (
        <div className="p-2.5 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
          New Password * (min 8 characters)
        </label>
        <input
          type="password"
          {...register("password")}
          placeholder="••••••••••••"
          className="w-full px-3 py-2 bg-white brutal-border text-sm text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
        />
        {errors.password && (
          <p className="text-[#D94C4C] text-[11px] font-bold mt-1">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
          Confirm New Password *
        </label>
        <input
          type="password"
          {...register("confirmPassword")}
          placeholder="••••••••••••"
          className="w-full px-3 py-2 bg-white brutal-border text-sm text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
        />
        {errors.confirmPassword && (
          <p className="text-[#D94C4C] text-[11px] font-bold mt-1">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full brutal-btn brutal-btn-primary py-2.5 font-bold text-sm tracking-wider flex items-center justify-center space-x-2 cursor-pointer mt-2"
      >
        <Lock className="w-4 h-4" />
        <span>{isSubmitting ? "UPDATING PASSWORD..." : "UPDATE PASSWORD & SIGN IN"}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
