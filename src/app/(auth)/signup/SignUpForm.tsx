"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signUpWithEmailAction } from "@/app/actions/auth";
import { ArrowRight, AlertCircle, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const signUpSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters."),
    organisationName: z
      .string()
      .min(2, "Organisation name must be at least 2 characters."),
    email: z
      .string()
      .email("Please enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters."),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = React.useState(false);
  const [registeredEmail, setRegisteredEmail] = React.useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      organisationName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: SignUpFormData) {
    setServerError(null);
    const res = await signUpWithEmailAction({
      fullName: data.fullName,
      organisationName: data.organisationName,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
    });

    if (!res.success) {
      setServerError(res.error || "Failed to create account. Please check your details.");
      return;
    }

    if (res.requiresEmailConfirmation) {
      setRegisteredEmail(data.email);
      setEmailConfirmationRequired(true);
      return;
    }

    if (res.redirectUrl) {
      router.push(res.redirectUrl);
    } else {
      router.push("/overview");
    }
  }

  if (emailConfirmationRequired) {
    return (
      <div className="p-6 bg-[#DDEBDD]/50 brutal-border space-y-4 font-mono text-center">
        <div className="w-12 h-12 bg-[#16834A] text-white brutal-border mx-auto flex items-center justify-center">
          <Mail className="w-6 h-6 text-[#B7F28B]" />
        </div>
        <div className="space-y-1">
          <h2 className="font-extrabold text-base text-[#17251C] uppercase tracking-wide">
            CHECK YOUR EMAIL
          </h2>
          <p className="text-xs text-[#17251C] leading-relaxed">
            We have dispatched a verification link to <strong>{registeredEmail}</strong>.
          </p>
          <p className="text-[11px] text-[#637367] leading-relaxed">
            Click the link in the message to confirm your address and enter your organisation dashboard.
          </p>
        </div>

        <div className="pt-3 border-t border-[#253C2B] flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/login"
            className="brutal-btn brutal-btn-primary px-4 py-2 text-xs font-bold"
          >
            PROCEED TO SIGN IN &rarr;
          </Link>
          <Link
            href="/demo"
            className="brutal-btn brutal-btn-secondary px-4 py-2 text-xs font-bold"
          >
            TRY THE DEMO
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

      {/* Full Name */}
      <div>
        <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
          Full Name *
        </label>
        <input
          type="text"
          {...register("fullName")}
          placeholder="e.g. Alex Morgan"
          className="w-full px-3 py-2 bg-white brutal-border text-sm text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
        />
        {errors.fullName && (
          <p className="text-[#D94C4C] text-[11px] font-bold mt-1">{errors.fullName.message}</p>
        )}
      </div>

      {/* Organisation Name */}
      <div>
        <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
          Organisation Name *
        </label>
        <input
          type="text"
          {...register("organisationName")}
          placeholder="e.g. Acme Corporation"
          className="w-full px-3 py-2 bg-white brutal-border text-sm text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
        />
        {errors.organisationName && (
          <p className="text-[#D94C4C] text-[11px] font-bold mt-1">
            {errors.organisationName.message}
          </p>
        )}
      </div>

      {/* Email Address */}
      <div>
        <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
          Work Email Address *
        </label>
        <input
          type="email"
          {...register("email")}
          placeholder="e.g. alex@acmecorp.com"
          className="w-full px-3 py-2 bg-white brutal-border text-sm text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
        />
        {errors.email && (
          <p className="text-[#D94C4C] text-[11px] font-bold mt-1">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
          Password * (min 8 characters)
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

      {/* Confirm Password */}
      <div>
        <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
          Confirm Password *
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
        <span>{isSubmitting ? "CREATING ORGANISATION..." : "CREATE ACCOUNT & ORGANISATION"}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
