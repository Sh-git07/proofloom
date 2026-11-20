import sharp from "sharp";
import { computeMultiRegionDHashes, matchLogoAgainstHashes } from "./dhash";
import { analyzeColorPaletteCompliance, APPROVED_BRAND_PALETTE } from "./palette";
import { AuditFindingRecord, AuditSeverity } from "@/lib/audit/types";

export interface DatabaseLogoAsset {
  id: string;
  name: string;
  status: "current" | "superseded" | "expired" | string;
  perceptual_hash?: string | null;
  storage_path?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VisualCheckInput {
  imageBuffer: Buffer;
  imageAltText?: string | null;
  platform?: string;
  auditId: string;
  organisationId: string;
  approvedLogos: DatabaseLogoAsset[];
  approvedPaletteHexes?: string[];
}

export interface VisualCheckResult {
  findings: AuditFindingRecord[];
  visualScore: number;
  logoStatus: "VERIFIED" | "OUTDATED" | "REQUIRES_REVIEW";
  detectedLogo?: DatabaseLogoAsset;
  currentLogoAlternative?: DatabaseLogoAsset;
  colorAnalysis: {
    isOffPalette: boolean;
    offPalettePercentage: number;
    dominantOffColors: string[];
  };
  resolution: {
    width: number;
    height: number;
  };
  aspectRatio: number;
}

/**
 * Platform aspect ratio recommendations:
 * [minAllowedRatio, maxAllowedRatio, idealDescription]
 */
const PLATFORM_ASPECT_RATIOS: Record<string, [number, number, string]> = {
  LinkedIn: [0.75, 2.0, "1:1 square or 1.91:1 landscape"],
  Instagram: [0.75, 1.95, "1:1 square or 4:5 portrait"],
  X: [0.5, 2.4, "16:9 landscape or 1:1 square"],
  Facebook: [0.75, 2.0, "1:1 square or 16:9 landscape"],
  Website: [0.4, 3.5, "Responsive banner or standard hero"],
};

export async function checkVisualConsistency({
  imageBuffer,
  imageAltText,
  platform = "LinkedIn",
  auditId,
  organisationId,
  approvedLogos,
  approvedPaletteHexes = APPROVED_BRAND_PALETTE,
}: VisualCheckInput): Promise<VisualCheckResult> {
  const findings: AuditFindingRecord[] = [];
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const aspectRatio = height > 0 ? Math.round((width / height) * 100) / 100 : 1;

  // 1. Logo Verification via dHash (Whole Image + 5 Regions)
  const multiHashes = await computeMultiRegionDHashes(imageBuffer);

  let bestMatchLogo: DatabaseLogoAsset | undefined;
  let lowestDistance = Infinity;
  let matchRegion = "whole";

  for (const logo of approvedLogos) {
    if (!logo.perceptual_hash) continue;
    const matchRes = matchLogoAgainstHashes(multiHashes, logo.perceptual_hash, 12);
    if (matchRes.isMatch && matchRes.minDistance < lowestDistance) {
      lowestDistance = matchRes.minDistance;
      bestMatchLogo = logo;
      matchRegion = matchRes.matchedRegion;
    }
  }

  const currentLogo = approvedLogos.find((l) => l.status === "current");
  let logoStatus: "VERIFIED" | "OUTDATED" | "REQUIRES_REVIEW" = "REQUIRES_REVIEW";

  if (bestMatchLogo) {
    if (bestMatchLogo.status === "current") {
      logoStatus = "VERIFIED";
      findings.push({
        id: `FIND-VIS-001`,
        category: "visual",
        severity: "INFO",
        excerpt: `[Logo Detected: ${bestMatchLogo.name} in ${matchRegion}]`,
        startIndex: 0,
        endIndex: 0,
        explanation: `Verified official brand mark "${bestMatchLogo.name}" detected via perceptual hash in ${matchRegion} area (Hamming distance ${lowestDistance}/64).`,
        guidelineReference: "Visual Identity Standard §1.1 (Logo Usage)",
        evidenceSourceId: bestMatchLogo.id,
        verificationStatus: "VERIFIED",
        recommendedAction: "Approved mark verified. Preserve required minimum clear space.",
        confidence: "high",
        isResolved: false,
      });
    } else {
      logoStatus = "OUTDATED";
      findings.push({
        id: `FIND-VIS-001`,
        category: "visual",
        severity: "HIGH",
        excerpt: `[Outdated Logo Detected: ${bestMatchLogo.name}]`,
        startIndex: 0,
        endIndex: 0,
        explanation: `Detected superseded or legacy brand mark "${bestMatchLogo.name}" (status: ${bestMatchLogo.status}). Current branding guidelines mandate replacing this mark.`,
        guidelineReference: "Visual Identity Standard §1.4 (Superseded Assets)",
        evidenceSourceId: bestMatchLogo.id,
        verificationStatus: "OUTDATED",
        recommendedAction: currentLogo
          ? `Replace with current approved logo: "${currentLogo.name}".`
          : "Replace with current brand mark.",
        suggestedReplacement: currentLogo?.name || "Official Nova Creative Mark",
        confidence: "high",
        isResolved: false,
      });
    }
  } else {
    logoStatus = "REQUIRES_REVIEW";
    findings.push({
      id: `FIND-VIS-001`,
      category: "visual",
      severity: "INFO",
      excerpt: "[No Approved Brand Logo Detected]",
      startIndex: 0,
      endIndex: 0,
      explanation: "REQUIRES REVIEW: no approved logo detected in submission artwork (never a pass or a fail).",
      guidelineReference: "Visual Identity Standard §1.2 (Logo Clear Space & Presence)",
      verificationStatus: "REQUIRES_REVIEW",
      recommendedAction:
        "If this artwork represents an official broadcast post, ensure the approved Nova Creative emblem is included.",
      confidence: "high",
      isResolved: false,
    });
  }

  // 2. Colours Analysis (deltaE against Approved Palette)
  const colorAnalysis = await analyzeColorPaletteCompliance(
    imageBuffer,
    approvedPaletteHexes,
    15.0, // 15% threshold
    18.0 // deltaE threshold
  );

  if (colorAnalysis.isOffPalette) {
    findings.push({
      id: `FIND-VIS-002`,
      category: "visual",
      severity: "MEDIUM",
      excerpt: `[Off-Palette Colors: ${colorAnalysis.offPalettePercentage}%]`,
      startIndex: 0,
      endIndex: 0,
      explanation: `Artwork contains ${colorAnalysis.offPalettePercentage}% off-palette pixels (threshold is 15%). Dominant non-compliant color codes: ${colorAnalysis.dominantOffColors.join(", ")}.`,
      guidelineReference: "Brand Palette Standard §2.0 (Forest, Lime, Ink, Paper)",
      recommendedAction:
        "Align color accents with approved brand tokens: #16834A (Forest), #B7F28B (Lime), #17251C (Ink), #F4F1E8 (Paper).",
      confidence: "high",
      isResolved: false,
    });
  }

  // 3. Basics Check: Minimum Resolution
  if (width < 200 || height < 200) {
    findings.push({
      id: `FIND-VIS-003`,
      category: "visual",
      severity: "LOW",
      excerpt: `[Low Resolution: ${width}x${height}px]`,
      startIndex: 0,
      endIndex: 0,
      explanation: `Image resolution (${width}x${height}px) is below the minimum recommended production threshold of 200x200px.`,
      guidelineReference: "Digital Artwork Quality Guidelines §3.1",
      recommendedAction: "Provide high-resolution asset (at least 72 DPI, min 600px recommended).",
      confidence: "high",
      isResolved: false,
    });
  }

  // 4. Basics Check: Platform Aspect Ratio
  const platformRange = PLATFORM_ASPECT_RATIOS[platform] || [0.5, 2.5, "Standard web ratio"];
  if (aspectRatio < platformRange[0] || aspectRatio > platformRange[1]) {
    findings.push({
      id: `FIND-VIS-004`,
      category: "visual",
      severity: "LOW",
      excerpt: `[Aspect Ratio: ${aspectRatio}:1 for ${platform}]`,
      startIndex: 0,
      endIndex: 0,
      explanation: `Aspect ratio (${aspectRatio}:1) is outside recommended dimensions for ${platform} (${platformRange[2]}).`,
      guidelineReference: `Platform Distribution Guide §${platform}`,
      recommendedAction: `Reframe canvas to match ${platform} standard dimensions (${platformRange[2]}).`,
      confidence: "medium",
      isResolved: false,
    });
  }

  // 5. Basics Check: Missing Alt Text
  if (!imageAltText || imageAltText.trim().length === 0) {
    findings.push({
      id: `FIND-VIS-005`,
      category: "visual",
      severity: "MEDIUM",
      excerpt: "[Missing Alt Text Description]",
      startIndex: 0,
      endIndex: 0,
      explanation: "Missing alternative text description required for visual accessibility and WCAG 2.1 compliance.",
      guidelineReference: "Accessibility Guidelines §4.1 (Non-text Content)",
      recommendedAction: "Provide descriptive alt text detailing the visual information conveyable by the graphic.",
      confidence: "high",
      isResolved: false,
    });
  }

  // 6. Compute Visual Score
  // Base 100 with deduction map: CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3, INFO: 0
  // REQUIRES REVIEW is not counted as a pass: cap visual score at 84 if logo is REQUIRES_REVIEW
  let score = 100;
  for (const f of findings) {
    if (f.severity === "CRITICAL") score -= 25;
    else if (f.severity === "HIGH") score -= 15;
    else if (f.severity === "MEDIUM") score -= 8;
    else if (f.severity === "LOW") score -= 3;
  }

  if (logoStatus === "REQUIRES_REVIEW") {
    // "REQUIRES REVIEW is not counted as a pass" -> score cannot exceed 84 (below 85 pass threshold)
    score = Math.min(score, 82);
  }

  const visualScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    findings,
    visualScore,
    logoStatus,
    detectedLogo: bestMatchLogo,
    currentLogoAlternative: currentLogo,
    colorAnalysis,
    resolution: { width, height },
    aspectRatio,
  };
}
