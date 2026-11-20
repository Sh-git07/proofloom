import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { checkVisualConsistency, DatabaseLogoAsset } from "../src/lib/visual/checker";
import { computeDHash, computeMultiRegionDHashes } from "../src/lib/visual/dhash";
import { calculateAuditScores } from "../src/lib/audit/scoring";
import { AuditFindingRecord, AuditDimension } from "../src/lib/audit/types";

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
