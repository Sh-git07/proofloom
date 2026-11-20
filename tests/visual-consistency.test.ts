import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { checkVisualConsistency, DatabaseLogoAsset } from "../src/lib/visual/checker";
import { computeDHash, computeMultiRegionDHashes } from "../src/lib/visual/dhash";
import { calculateAuditScores } from "../src/lib/audit/scoring";
import { AuditFindingRecord, AuditDimension } from "../src/lib/audit/types";

// SVG sources exactly as seed.ts (single-line, no extra whitespace) — used to simulate
// what the seed stores in approved_assets.perceptual_hash
const SEED_CURRENT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><rect width="240" height="80" fill="#16834A" /><rect x="12" y="12" width="56" height="56" fill="#B7F28B" rx="4"/><text x="40" y="50" font-family="sans-serif" font-size="28" font-weight="900" fill="#17251C" text-anchor="middle">PL</text><text x="80" y="42" font-family="sans-serif" font-size="20" font-weight="800" fill="#F4F1E8" letter-spacing="1.5">NOVA</text><text x="80" y="60" font-family="sans-serif" font-size="11" font-weight="700" fill="#B7F28B" letter-spacing="2">CREATIVE</text></svg>`;

const SEED_OLD_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><rect width="240" height="80" fill="#2E2E2E" /><circle cx="40" cy="40" r="28" fill="#888888" /><text x="40" y="48" font-family="serif" font-size="24" font-weight="700" fill="#FFFFFF" text-anchor="middle">NC</text><text x="82" y="42" font-family="serif" font-size="18" font-weight="600" fill="#CCCCCC">NOVA CORP</text><text x="82" y="58" font-family="sans-serif" font-size="9" fill="#999999">LEGACY 2021</text></svg>`;

const TEST_ASSETS = join(__dirname, "..", "test-assets");

function loadTestImage(name: string): Buffer {
  return readFileSync(join(TEST_ASSETS, name));
}

describe("Visual Consistency — dHash", () => {
  it("computes a 64-bit dHash string for an image", async () => {
    const buf = loadTestImage("current-logo.png");
    const hash = await computeDHash(buf);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64); // 64 binary characters
    expect(hash).toMatch(/^[01]+$/);
  });

  it("computes multi-region dHashes (whole + 5 crops)", async () => {
    const buf = loadTestImage("current-logo.png");
    const hashes = await computeMultiRegionDHashes(buf);
    expect(hashes.whole).toBeDefined();
    expect(hashes.crops.length).toBe(5);
    const regions = hashes.crops.map((c) => c.region);
    expect(regions).toContain("top-left");
    expect(regions).toContain("top-right");
    expect(regions).toContain("bottom-left");
    expect(regions).toContain("bottom-right");
    expect(regions).toContain("centre");
  });
});

describe("Visual Consistency — Logo Verification", () => {
  it("verifies the current logo → VERIFIED", async () => {
    const currentBuf = loadTestImage("current-logo.png");
    const currentHash = await computeDHash(currentBuf);

    const approvedLogos: DatabaseLogoAsset[] = [
      {
        id: "logo-current",
        name: "Nova Creative Mark (Current)",
        status: "current",
        perceptual_hash: currentHash,
      },
    ];

    const result = await checkVisualConsistency({
      imageBuffer: currentBuf,
      imageAltText: "Current logo test",
      platform: "LinkedIn",
      auditId: "test-audit",
      organisationId: "test-org",
      approvedLogos,
    });

    expect(result.logoStatus).toBe("VERIFIED");
    const logoFinding = result.findings.find((f) => f.id === "FIND-VIS-001");
    expect(logoFinding).toBeDefined();
    expect(logoFinding!.verificationStatus).toBe("VERIFIED");
    expect(logoFinding!.severity).toBe("INFO");
  });

  it("flags the old superseded logo → OUTDATED", async () => {
    const oldBuf = loadTestImage("old-logo.png");
    const oldHash = await computeDHash(oldBuf);
    const currentBuf = loadTestImage("current-logo.png");
    const currentHash = await computeDHash(currentBuf);

    const approvedLogos: DatabaseLogoAsset[] = [
      {
        id: "logo-old",
        name: "Legacy Logo",
        status: "superseded",
        perceptual_hash: oldHash,
      },
      {
        id: "logo-current",
        name: "Nova Creative Mark (Current)",
        status: "current",
        perceptual_hash: currentHash,
      },
    ];

    const result = await checkVisualConsistency({
      imageBuffer: oldBuf,
      imageAltText: "Old logo test",
      platform: "LinkedIn",
      auditId: "test-audit",
      organisationId: "test-org",
      approvedLogos,
    });

    expect(result.logoStatus).toBe("OUTDATED");
    const logoFinding = result.findings.find((f) => f.id === "FIND-VIS-001");
    expect(logoFinding).toBeDefined();
    expect(logoFinding!.verificationStatus).toBe("OUTDATED");
    expect(logoFinding!.severity).toBe("HIGH");
    expect(logoFinding!.recommendedAction).toContain("Nova Creative Mark");
  });

  it("flags unrecognised artwork → REQUIRES_REVIEW", async () => {
    const bannerBuf = loadTestImage("off-palette-banner.png");
    const currentBuf = loadTestImage("current-logo.png");
    const currentHash = await computeDHash(currentBuf);

    const approvedLogos: DatabaseLogoAsset[] = [
      {
        id: "logo-current",
        name: "Nova Creative Mark (Current)",
        status: "current",
        perceptual_hash: currentHash,
      },
    ];

    const result = await checkVisualConsistency({
      imageBuffer: bannerBuf,
      imageAltText: "Banner test",
      platform: "LinkedIn",
      auditId: "test-audit",
      organisationId: "test-org",
      approvedLogos,
    });

    expect(result.logoStatus).toBe("REQUIRES_REVIEW");
  });
});

describe("Visual Consistency — Colour Palette", () => {
  it("flags off-palette colours in a non-brand banner", async () => {
    const bannerBuf = loadTestImage("off-palette-banner.png");

    const result = await checkVisualConsistency({
      imageBuffer: bannerBuf,
      imageAltText: "Off-palette banner",
      platform: "LinkedIn",
      auditId: "test-audit",
      organisationId: "test-org",
      approvedLogos: [],
      approvedPaletteHexes: ["#16834A", "#B7F28B", "#17251C", "#F4F1E8"],
    });

    const colourFinding = result.findings.find(
      (f) => f.id === "FIND-VIS-002"
    );
    expect(colourFinding).toBeDefined();
    expect(colourFinding!.severity).toBe("MEDIUM");
    expect(result.colorAnalysis.isOffPalette).toBe(true);
    expect(result.colorAnalysis.offPalettePercentage).toBeGreaterThan(15);
  });

  it("does not flag colours in an on-brand banner", async () => {
    const bannerBuf = loadTestImage("on-brand-banner.png");

    const result = await checkVisualConsistency({
      imageBuffer: bannerBuf,
      imageAltText: "On-brand banner",
      platform: "LinkedIn",
      auditId: "test-audit",
      organisationId: "test-org",
      approvedLogos: [],
      approvedPaletteHexes: ["#16834A", "#B7F28B", "#17251C", "#F4F1E8"],
    });

    const colourFinding = result.findings.find(
      (f) => f.id === "FIND-VIS-002"
    );
    expect(colourFinding).toBeUndefined();
    expect(result.colorAnalysis.isOffPalette).toBe(false);
  });
});

describe("Visual Consistency — Alt Text", () => {
  it("flags missing alt text as MEDIUM", async () => {
    const buf = loadTestImage("current-logo.png");

    const result = await checkVisualConsistency({
      imageBuffer: buf,
      imageAltText: "",
      platform: "LinkedIn",
      auditId: "test-audit",
      organisationId: "test-org",
      approvedLogos: [],
    });

    const altFinding = result.findings.find(
      (f) => f.id === "FIND-VIS-005"
    );
    expect(altFinding).toBeDefined();
    expect(altFinding!.severity).toBe("MEDIUM");
  });

  it("does not flag when alt text is provided", async () => {
    const buf = loadTestImage("current-logo.png");

    const result = await checkVisualConsistency({
      imageBuffer: buf,
      imageAltText: "Official Nova Creative brand logo",
      platform: "LinkedIn",
      auditId: "test-audit",
      organisationId: "test-org",
      approvedLogos: [],
    });

    const altFinding = result.findings.find(
      (f) => f.id === "FIND-VIS-005"
    );
    expect(altFinding).toBeUndefined();
  });
});

describe("Visual Consistency — Scoring", () => {
  it("visual score is null when visual is not in checkedDimensions", () => {
    const findings: AuditFindingRecord[] = [];
    const dims: AuditDimension[] = ["voice", "claims", "terminology", "accessibility"];
    const scores = calculateAuditScores(findings, dims);
    expect(scores.visual).toBeNull();
  });

  it("visual score is computed when visual is in checkedDimensions", () => {
    const findings: AuditFindingRecord[] = [
      {
        id: "v1",
        category: "visual",
        severity: "MEDIUM",
        excerpt: "[Off palette]",
        startIndex: 0,
        endIndex: 0,
        explanation: "off palette",
        recommendedAction: "fix",
        confidence: "high",
        isResolved: false,
      },
    ];
    const dims: AuditDimension[] = ["voice", "claims", "terminology", "accessibility", "visual"];
    const scores = calculateAuditScores(findings, dims);
    expect(scores.visual).not.toBeNull();
    expect(scores.visual).toBe(92); // 100 - 8 (MEDIUM deduction)
  });

  it("REQUIRES_REVIEW caps visual score at 82", () => {
    const findings: AuditFindingRecord[] = [
      {
        id: "v1",
        category: "visual",
        severity: "INFO",
        excerpt: "[No logo]",
        startIndex: 0,
        endIndex: 0,
        explanation: "requires review",
        verificationStatus: "REQUIRES_REVIEW",
        recommendedAction: "review",
        confidence: "high",
        isResolved: false,
      },
    ];
    const dims: AuditDimension[] = ["voice", "claims", "terminology", "accessibility", "visual"];
    const scores = calculateAuditScores(findings, dims);
    expect(scores.visual).not.toBeNull();
    expect(scores.visual!).toBeLessThanOrEqual(82);
  });
});

describe("Visual Consistency — Required Scenarios", () => {
  it("identical old logo = OUTDATED (with current logo alternative provided)", async () => {
    // Generate hashes exactly as seed.ts
    const seedOldPng = await sharp(Buffer.from(SEED_OLD_LOGO_SVG)).png().toBuffer();
    const seedOldHash = await computeDHash(seedOldPng);

    const seedCurrentPng = await sharp(Buffer.from(SEED_CURRENT_LOGO_SVG)).png().toBuffer();
    const seedCurrentHash = await computeDHash(seedCurrentPng);

    const approvedLogos: DatabaseLogoAsset[] = [
      {
        id: "logo-old-seeded",
        name: "Nova Corp Legacy Mark (2021)",
        status: "superseded",
        perceptual_hash: seedOldHash,
      },
      {
        id: "logo-current-seeded",
        name: "Nova Creative Primary Mark (Current)",
        status: "current",
        perceptual_hash: seedCurrentHash,
      },
    ];

    // Upload old-logo.png from test-assets
    const uploadedOldBuf = loadTestImage("old-logo.png");
    const result = await checkVisualConsistency({
      imageBuffer: uploadedOldBuf,
      imageAltText: "Legacy 2021 logo mark",
      platform: "LinkedIn",
      auditId: "test-audit-old",
      organisationId: "test-org",
      approvedLogos,
    });

    expect(result.logoStatus).toBe("OUTDATED");
    const outdatedFinding = result.findings.find(
      (f) => f.category === "visual" && f.verificationStatus === "OUTDATED"
    );
    expect(outdatedFinding).toBeDefined();
    expect(outdatedFinding!.severity).toBe("HIGH");
    expect(outdatedFinding!.recommendedAction).toContain("Nova Creative Primary Mark (Current)");
    expect(result.currentLogoAlternative?.name).toBe("Nova Creative Primary Mark (Current)");
  });

  it("identical current logo = verified (positive result)", async () => {
    const seedCurrentPng = await sharp(Buffer.from(SEED_CURRENT_LOGO_SVG)).png().toBuffer();
    const seedCurrentHash = await computeDHash(seedCurrentPng);

    const approvedLogos: DatabaseLogoAsset[] = [
      {
        id: "logo-current-seeded",
        name: "Nova Creative Primary Mark (Current)",
        status: "current",
        perceptual_hash: seedCurrentHash,
      },
    ];

    const uploadedCurrentBuf = loadTestImage("current-logo.png");
    const result = await checkVisualConsistency({
      imageBuffer: uploadedCurrentBuf,
      imageAltText: "Current Nova Creative Logo",
      platform: "LinkedIn",
      auditId: "test-audit-current",
      organisationId: "test-org",
      approvedLogos,
    });

    expect(result.logoStatus).toBe("VERIFIED");
    const verifiedFinding = result.findings.find(
      (f) => f.category === "visual" && f.verificationStatus === "VERIFIED"
    );
    expect(verifiedFinding).toBeDefined();
    expect(verifiedFinding!.severity).toBe("INFO");
    expect(verifiedFinding!.explanation).toContain("Verified official brand mark");
  });

  it("unrelated image = requires review", async () => {
    const seedCurrentPng = await sharp(Buffer.from(SEED_CURRENT_LOGO_SVG)).png().toBuffer();
    const seedCurrentHash = await computeDHash(seedCurrentPng);

    const approvedLogos: DatabaseLogoAsset[] = [
      {
        id: "logo-current-seeded",
        name: "Nova Creative Primary Mark (Current)",
        status: "current",
        perceptual_hash: seedCurrentHash,
      },
    ];

    // Unrelated image (off-palette banner without logo)
    const unrelatedBuf = loadTestImage("off-palette-banner.png");
    const result = await checkVisualConsistency({
      imageBuffer: unrelatedBuf,
      imageAltText: "Generic banner image",
      platform: "LinkedIn",
      auditId: "test-audit-unrelated",
      organisationId: "test-org",
      approvedLogos,
    });

    expect(result.logoStatus).toBe("REQUIRES_REVIEW");
    const reviewFinding = result.findings.find(
      (f) => f.category === "visual" && f.verificationStatus === "REQUIRES_REVIEW"
    );
    expect(reviewFinding).toBeDefined();
    expect(reviewFinding!.explanation).toContain("REQUIRES REVIEW: no approved logo detected");
    // Verify score capped at 82
    expect(result.visualScore).toBeLessThanOrEqual(82);
  });

  it("off-palette image = colour finding", async () => {
    const offPaletteBuf = loadTestImage("off-palette-banner.png");
    const result = await checkVisualConsistency({
      imageBuffer: offPaletteBuf,
      imageAltText: "Summer sale promotional graphic",
      platform: "LinkedIn",
      auditId: "test-audit-palette",
      organisationId: "test-org",
      approvedLogos: [],
      approvedPaletteHexes: ["#16834A", "#B7F28B", "#17251C", "#F4F1E8"],
    });

    const colourFinding = result.findings.find(
      (f) => f.category === "visual" && f.severity === "MEDIUM" && f.excerpt.includes("Off-Palette")
    );
    expect(colourFinding).toBeDefined();
    expect(colourFinding!.explanation).toContain("off-palette pixels");
    expect(result.colorAnalysis.isOffPalette).toBe(true);
    expect(result.colorAnalysis.offPalettePercentage).toBeGreaterThan(15);
  });
});
