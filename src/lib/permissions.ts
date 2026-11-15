export type OrgRole = "admin" | "brand_manager" | "creator" | "reviewer";

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export function canManageSettings(role: OrgRole): boolean {
  return role === "admin";
}

export function canManageMembers(role: OrgRole): boolean {
  return role === "admin";
}

export function canManageKnowledge(role: OrgRole): boolean {
  return role === "admin" || role === "brand_manager";
}

export function canSubmitContent(role: OrgRole): boolean {
  return role === "admin" || role === "brand_manager" || role === "creator";
}

export function canAssignReviewers(role: OrgRole): boolean {
  return role === "admin" || role === "brand_manager";
}

export function canReviewContent(role: OrgRole): boolean {
  return role === "admin" || role === "brand_manager" || role === "reviewer";
}

export function canDecideChallenges(role: OrgRole): boolean {
  return role === "admin" || role === "brand_manager" || role === "reviewer";
}

export function canOverrideCritical(role: OrgRole, reason?: string): PermissionCheckResult {
  if (role !== "admin") {
    return {
      allowed: false,
      reason: "Only administrators can override critical finding restrictions.",
    };
  }
  const trimmed = (reason || "").trim();
  if (trimmed.length < 15) {
    return {
      allowed: false,
      reason: "An explicit justification of at least 15 characters is required for critical overrides.",
    };
  }
  return { allowed: true };
}

export function canViewAllAudits(role: OrgRole): boolean {
  return role === "admin" || role === "brand_manager";
}

export function canChallengeFinding(role: OrgRole): boolean {
  return role === "admin" || role === "brand_manager" || role === "creator";
}

export function canAcceptRewrite(role: OrgRole): boolean {
  return role === "admin" || role === "brand_manager" || role === "creator";
}
