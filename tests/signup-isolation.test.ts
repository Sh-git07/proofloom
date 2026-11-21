import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signUpWithEmailAction,
  requestPasswordResetAction,
  updatePasswordAction,
  loadSampleBrandDataAction,
} from "@/app/actions/auth";

// Mock Supabase server client and auth helpers
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUserContext: vi.fn(),
  clearUserContextCache: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Real-Email Sign Up & Multi-Tenant Isolation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Validation & Security in Sign Up Action", () => {
    it("rejects passwords shorter than 8 characters", async () => {
      const res = await signUpWithEmailAction({
        fullName: "Jane Doe",
        organisationName: "Acme Corp",
        email: "jane@acme.com",
        password: "short",
        confirmPassword: "short",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/at least 8 characters/i);
    });

    it("rejects mismatched password and confirmPassword", async () => {
      const res = await signUpWithEmailAction({
        fullName: "Jane Doe",
        organisationName: "Acme Corp",
        email: "jane@acme.com",
        password: "Password123!",
        confirmPassword: "Password456!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/passwords do not match/i);
    });

    it("rejects invalid email formats", async () => {
      const res = await signUpWithEmailAction({
        fullName: "Jane Doe",
        organisationName: "Acme Corp",
        email: "not-an-email",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/valid email/i);
    });

    it("rejects empty or short organisation names", async () => {
      const res = await signUpWithEmailAction({
        fullName: "Jane Doe",
        organisationName: "A",
        email: "jane@acme.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/organisation name must be at least 2 characters/i);
    });
  });

  describe("2. Single Organisation & Admin Membership Creation Isolation", () => {
    it("proves the signup function creates exactly one organisation and one admin membership for caller and cannot affect another organisation", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { clearUserContextCache } = await import("@/lib/auth-helpers");

      const mockUser = { id: "new-user-uuid-101", email: "founder@acme.com" };
      const mockSession = { access_token: "mock-token" };

      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          organisation_id: "new-org-uuid-999",
          name: "Acme Brand",
          slug: "acme-brand",
          role: "admin",
        },
        error: null,
      });

      const mockSignUp = vi.fn().mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      });

      const mockSupabase = {
        auth: {
          signUp: mockSignUp,
        },
        rpc: mockRpc,
      };

      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

      const res = await signUpWithEmailAction({
        fullName: "Alice Founder",
        organisationName: "Acme Brand",
        email: "founder@acme.com",
        password: "SecurePassword2026!",
        confirmPassword: "SecurePassword2026!",
      });

      expect(res.success).toBe(true);
      expect(res.requiresEmailConfirmation).toBe(false);
      expect(res.redirectUrl).toBe("/overview");

      // Verify auth.signUp was called with correct parameters
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "founder@acme.com",
        password: "SecurePassword2026!",
        options: {
          data: {
            full_name: "Alice Founder",
            organisation_name: "Acme Brand",
          },
          emailRedirectTo: expect.stringContaining("/auth/callback"),
        },
      });

      // Verify RPC invocation: only caller full_name and org_name are passed.
      // Crucially, NO client-provided org ID or role is passed or accepted.
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("create_user_organisation", {
        p_full_name: "Alice Founder",
        p_org_name: "Acme Brand",
      });

      // Verify context cache was invalidated
      expect(clearUserContextCache).toHaveBeenCalled();
    });

    it("handles email confirmation mode when session is not immediately returned", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockSignUp = vi.fn().mockResolvedValue({
        data: {
          user: { id: "unconfirmed-user-uuid" },
          session: null, // Email confirmation required
        },
        error: null,
      });

      const mockRpc = vi.fn();

      const mockSupabase = {
        auth: {
          signUp: mockSignUp,
        },
        rpc: mockRpc,
      };

      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

      const res = await signUpWithEmailAction({
        fullName: "Bob Pending",
        organisationName: "Pending Org",
        email: "bob@pending.com",
        password: "SecurePassword2026!",
        confirmPassword: "SecurePassword2026!",
      });

      expect(res.success).toBe(true);
      expect(res.requiresEmailConfirmation).toBe(true);
      // RPC should NOT be invoked client-side when session is null (handled upon code exchange callback)
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("returns friendly error when email is already registered", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockSignUp = vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "User already registered", status: 422 },
      });

      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { signUp: mockSignUp },
      });

      const res = await signUpWithEmailAction({
        fullName: "Existing User",
        organisationName: "Existing Org",
        email: "existing@domain.com",
        password: "SecurePassword2026!",
        confirmPassword: "SecurePassword2026!",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already registered/i);
    });
  });

  describe("3. Password Reset and Update Flows", () => {
    it("requests password reset for valid email", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockReset = vi.fn().mockResolvedValue({ error: null });
      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { resetPasswordForEmail: mockReset },
      });

      const res = await requestPasswordResetAction("alice@domain.com");
      expect(res.success).toBe(true);
      expect(mockReset).toHaveBeenCalledWith("alice@domain.com", {
        redirectTo: expect.stringContaining("/reset-password"),
      });
    });

    it("updates password with min-8 character enforcement", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: { updateUser: mockUpdate },
      });

      const shortRes = await updatePasswordAction("short");
      expect(shortRes.success).toBe(false);
      expect(shortRes.error).toMatch(/at least 8 characters/i);

      const validRes = await updatePasswordAction("NewStrongPassword2026!");
      expect(validRes.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ password: "NewStrongPassword2026!" });
    });
  });

  describe("4. Sample Brand Data Isolation", () => {
    it("loads sample data into caller's organisation only and denies unauthenticated callers", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { getCurrentUserContext } = await import("@/lib/auth-helpers");

      // Test unauthenticated case
      (getCurrentUserContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const unauthRes = await loadSampleBrandDataAction();
      expect(unauthRes.success).toBe(false);
      expect(unauthRes.error).toMatch(/authentication required/i);

      // Test authenticated case: org ID passed to RPC is strictly taken from current context
      const orgId = "org-target-uuid-555";
      (getCurrentUserContext as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-alice-123" },
        organisation: { id: orgId, name: "Target Org" },
        role: "admin",
      });

      const mockRpc = vi.fn().mockResolvedValue({
        data: { success: true, message: "Sample brand data loaded successfully." },
        error: null,
      });

      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        rpc: mockRpc,
      });

      const res = await loadSampleBrandDataAction();
      expect(res.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("load_sample_brand_data", {
        p_org_id: orgId,
      });
    });
  });
});
