import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractClaimsDeterministic,
  claimsExtractionResponseSchema,
  GEMINI_CLAIMS_RESPONSE_SCHEMA,
} from "./claim-extraction";
import { verifyClaimAgainstEvidence, DatabaseFact } from "./evidence";
import {
  checkBrandVoiceDeterministic,
  voiceAnalysisResponseSchema,
  GEMINI_VOICE_RESPONSE_SCHEMA,
} from "./brand-voice";
import { checkTerminologyDeterministic, DatabaseTermRule } from "./terminology";
import { checkAccessibilityDeterministic } from "./accessibility";
import { checkVisualConsistency } from "@/lib/visual/checker";
import { calculateAuditScores } from "./scoring";
import { AuditFindingRecord, AuditSeverity, AuditDimension } from "./types";
import { generateStructured } from "@/lib/ai";
import { deriveEngineModeLabel, AIStageOutcome } from "./labelling";
import { z } from "zod";

export const TEXT_STAGE_NAMES = [
  "[01] CONTENT INGESTION",
  "[02] CLAIM EXTRACTION",
  "[03] SOURCE VERIFICATION",
  "[04] BRAND VOICE ANALYSIS",
  "[05] TERMINOLOGY INSPECTION",
  "[06] ACCESSIBILITY CHECK",
  "[07] FINAL RISK ASSESSMENT",
] as const;

export const VISUAL_STAGE_NAMES = [
  "[01] CONTENT INGESTION",
  "[02] CLAIM EXTRACTION",
  "[03] SOURCE VERIFICATION",
  "[04] BRAND VOICE ANALYSIS",
  "[05] TERMINOLOGY INSPECTION",
  "[06] ACCESSIBILITY CHECK",
  "[07] VISUAL CONSISTENCY",
  "[08] FINAL RISK ASSESSMENT",
] as const;

export const STAGE_NAMES = TEXT_STAGE_NAMES;

/**
 * Initializes an audit and all stages in QUEUED state within Supabase.
 */
export async function initializeAudit({
  organisationId,
  contentItemId,
  contentVersionId,
  mode = "live_ai",
  hasImage = false,
}: {
  organisationId: string;
  contentItemId: string;
  contentVersionId: string;
  mode?: "live_ai" | "demo";
  hasImage?: boolean;
}) {
  const supabase = createAdminClient();

  const checkedDimensions: AuditDimension[] = hasImage
    ? ["voice", "claims", "terminology", "accessibility", "visual"]
    : ["voice", "claims", "terminology", "accessibility"];

  // Create audit record
  const { data: audit, error: auditErr } = await supabase
    .from("audits")
    .insert({
      organisation_id: organisationId,
      content_item_id: contentItemId,
      content_version_id: contentVersionId,
      status: "QUEUED",
      mode,
      checked_dimensions: checkedDimensions,
    })
    .select("id")
    .single();

  if (auditErr || !audit) {
    throw new Error(`Failed to create audit row: ${auditErr?.message || "Unknown error"}`);
  }

  // Create audit_stages rows with QUEUED status
  const stageList = hasImage ? VISUAL_STAGE_NAMES : TEXT_STAGE_NAMES;
  const stageRows = stageList.map((name, idx) => ({
    audit_id: audit.id,
    stage_number: idx + 1,
    stage_key: name,
    status: "QUEUED",
  }));

  const { error: stagesErr } = await supabase.from("audit_stages").insert(stageRows);

  if (stagesErr) {
    throw new Error(`Failed to initialize audit stages: ${stagesErr.message}`);
  }

  return audit.id;
}

/**
 * Executes the next queued stage for an audit row.
 * Serverless safe: runs one stage per invocation (maxDuration = 60).
 */
export async function executeNextStage(auditId: string) {
  const supabase = createAdminClient();

  // 1. Fetch audit details (include checked_dimensions and content_version image fields)
  const { data: audit, error: auditErr } = await supabase
    .from("audits")
    .select(`
      id,
      organisation_id,
      content_item_id,
      content_version_id,
      mode,
      status,
      checked_dimensions,
      content_versions(body, image_storage_path, image_alt_text),
      content_items(title, content_type, platform, department)
    `)
    .eq("id", auditId)
    .single();

  if (auditErr || !audit) {
    throw new Error(`Audit not found: ${auditErr?.message || "Unknown error"}`);
  }

  // 2. Fetch stages
  const { data: stages, error: stagesErr } = await supabase
    .from("audit_stages")
    .select("*")
    .eq("audit_id", auditId)
    .order("stage_number", { ascending: true });

  if (stagesErr || !stages) {
    throw new Error(`Failed to fetch audit stages: ${stagesErr?.message || "Unknown error"}`);
  }

  // Find next stage: prioritize QUEUED, then FAILED, then stalled PROCESSING stages (recovers aborted invocations)
  const nextStage =
    stages.find((s) => s.status === "QUEUED") ||
    stages.find((s) => s.status === "FAILED") ||
    stages.find((s) => s.status === "PROCESSING");
  if (!nextStage) {
    return { completed: true, stage: null, auditStatus: audit.status };
  }

  const stageId = nextStage.id;
  const stageNum = nextStage.stage_number;
  const stageKey: string = nextStage.stage_key || nextStage.stage_name || "";
  const totalStages = stages.length;
  const isFinalStage = stageNum === totalStages || stageKey.includes("FINAL RISK ASSESSMENT");
  const isVisualStage = stageKey.includes("VISUAL CONSISTENCY");
  const checkedDimensions = (audit.checked_dimensions as AuditDimension[]) || [
    "voice", "claims", "terminology", "accessibility",
  ];

  const contentVersionRow = audit.content_versions as unknown as {
    body: string;
    image_storage_path?: string | null;
    image_alt_text?: string | null;
  };
  const contentBody = contentVersionRow?.body || "";
  const orgId = audit.organisation_id;
  const mode = audit.mode as "live_ai" | "demo";

  // Mark stage as PROCESSING
  await supabase
    .from("audit_stages")
    .update({
      status: "PROCESSING",
      started_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", stageId);

  await supabase.from("audits").update({ status: "PROCESSING" }).eq("id", auditId);

  try {
    let findingsCount = 0;
    let stageDetail = "";

    // Execute stage-specific logic — route by stageKey for 7 or 8-stage pipelines
    if (isVisualStage) {
      // ============================================================
      // [07] VISUAL CONSISTENCY (8-stage pipeline with image)
      // ============================================================
      // Re-fetch image_storage_path directly from content_versions in case the
      // audit join did not populate it (Supabase PostgREST join requires the FK
      // column to be named consistently; direct fetch is the safest fallback).
      const contentVersionId = audit.content_version_id as string | null;
      let imageStoragePath = contentVersionRow?.image_storage_path as string | null | undefined;
      let imageAltText = contentVersionRow?.image_alt_text as string | null | undefined;

      if (!imageStoragePath && contentVersionId) {
        const { data: cvRow } = await supabase
          .from("content_versions")
          .select("image_storage_path, image_alt_text")
          .eq("id", contentVersionId)
          .single();
        imageStoragePath = cvRow?.image_storage_path;
        imageAltText = cvRow?.image_alt_text;
      }

      console.log(JSON.stringify({
        tag: "VISUAL_STAGE_LOG",
        step: "init",
        auditId,
        orgId,
        contentVersionId,
        imageStoragePath: imageStoragePath || null,
        imageAltText: imageAltText ? "[present]" : null,
      }));

      if (!imageStoragePath) {
        stageDetail = "AI: not used • No image attachment found; stage skipped";
        findingsCount = 0;
      } else {
        // Wrap the entire visual check in try/catch — NEVER fail silently
        try {
          const { data: imageData, error: storageErr } = await supabase.storage
            .from("content-uploads")
            .download(imageStoragePath);

          console.log(JSON.stringify({
            tag: "VISUAL_STAGE_LOG",
            step: "image_download",
            storageErr: storageErr?.message || null,
            hasData: !!imageData,
          }));

          if (storageErr || !imageData) {
            // Store a WARNING finding so it shows in the report
            const warnMsg = `Image could not be downloaded from storage: ${storageErr?.message || "Unknown error"}`;
            await supabase.from("audit_findings").insert({
              finding_code: "FND-VIS-ERR-1",
              audit_id: auditId,
              organisation_id: orgId,
              category: "visual",
              severity: "MEDIUM",
              excerpt: "[Visual Check Warning]",
              start_offset: 0,
              end_offset: 0,
              explanation: warnMsg,
              guideline_reference: "Visual Brand Consistency Pipeline",
              recommended_action: "Re-upload the image and re-run the audit to complete visual consistency checks.",
              verification_status: "REQUIRES_REVIEW",
              confidence: "high",
              confidence_note: "Rule",
              is_resolved: false,
            });
            findingsCount = 1;
            stageDetail = `AI: not used • REQUIRES REVIEW: image download failed — ${storageErr?.message || "unknown"}`;
          } else {
            const imageBuffer = Buffer.from(await imageData.arrayBuffer());

            console.log(JSON.stringify({
              tag: "VISUAL_STAGE_LOG",
              step: "image_received",
              bytes: imageBuffer.length,
            }));

            const { data: rawAssets, error: assetsErr } = await supabase
              .from("approved_assets")
              .select("id, name, asset_type, status, perceptual_hash, storage_path, colour_palette")
              .eq("organisation_id", orgId)
              .in("asset_type", ["logo", "palette", "color_palette"]);

            console.log(JSON.stringify({
              tag: "VISUAL_STAGE_LOG",
              step: "assets_loaded",
              assetsErr: assetsErr?.message || null,
              totalAssets: (rawAssets || []).length,
              logoAssets: (rawAssets || []).filter((a) => a.asset_type === "logo").map((a) => ({
                id: a.id,
                name: a.name,
                status: a.status,
                hasHash: !!a.perceptual_hash,
              })),
            }));

            const approvedLogos = (rawAssets || []).filter(
              (a) => a.asset_type === "logo" && a.perceptual_hash
            );
            const paletteAsset = (rawAssets || []).find(
              (a) => a.asset_type === "palette" || a.asset_type === "color_palette"
            );
            const approvedPaletteHexes: string[] | undefined = paletteAsset?.colour_palette
              ? (paletteAsset.colour_palette as string[])
              : undefined;

            const itemData2 = audit.content_items as unknown as { platform?: string } | null;
            const visualPlatform = itemData2?.platform || "LinkedIn";

            const visualResult = await checkVisualConsistency({
              imageBuffer,
              imageAltText,
              platform: visualPlatform,
              auditId,
              organisationId: orgId,
              approvedLogos,
              approvedPaletteHexes,
            });

            console.log(JSON.stringify({
              tag: "VISUAL_STAGE_LOG",
              step: "check_complete",
              logoStatus: visualResult.logoStatus,
              findingsCount: visualResult.findings.length,
              colorIsOffPalette: visualResult.colorAnalysis.isOffPalette,
              offPalettePercentage: visualResult.colorAnalysis.offPalettePercentage,
              resolution: visualResult.resolution,
            }));

            if (visualResult.findings.length > 0) {
              const rows = visualResult.findings.map((f, idx) => ({
                finding_code: `FND-VIS-${idx + 1}`,
                audit_id: auditId,
                organisation_id: orgId,
                category: "visual",
                severity: f.severity,
                excerpt: f.excerpt,
                start_offset: f.startIndex,
                end_offset: f.endIndex,
                explanation: f.explanation,
                guideline_reference: f.guidelineReference,
                recommended_action: f.recommendedAction,
                suggested_replacement: f.suggestedReplacement,
                verification_status: f.verificationStatus || null,
                evidence_source_id: f.evidenceSourceId || null,
                confidence: (f.confidence as "high" | "medium" | "low") || "high",
                confidence_note: "Rule",
                is_resolved: false,
              }));
              const { error: insertErr } = await supabase.from("audit_findings").insert(rows);
              console.log(JSON.stringify({
                tag: "VISUAL_STAGE_LOG",
                step: "findings_saved",
                count: rows.length,
                insertErr: insertErr?.message || null,
              }));
            }

            findingsCount = visualResult.findings.length;
            stageDetail = `AI: not used • Visual consistency checks complete: ${findingsCount} findings (logo: ${visualResult.logoStatus})`;
          }
        } catch (visualErr: unknown) {
          // NEVER FAIL SILENTLY: on any error, record a WARNING finding
          const errMsg = visualErr instanceof Error ? visualErr.message : String(visualErr);
          console.error(JSON.stringify({
            tag: "VISUAL_STAGE_LOG",
            step: "error",
            error: errMsg,
          }));
          try {
            await supabase.from("audit_findings").insert({
              finding_code: "FND-VIS-ERR-1",
              audit_id: auditId,
              organisation_id: orgId,
              category: "visual",
              severity: "MEDIUM",
              excerpt: "[Visual Check Error]",
              start_offset: 0,
              end_offset: 0,
              explanation: `Visual consistency check could not complete: ${errMsg}. Manual review required.`,
              guideline_reference: "Visual Brand Consistency Pipeline",
              recommended_action: "Re-upload the image and re-run the audit. If the error persists, contact support.",
              verification_status: "REQUIRES_REVIEW",
              confidence: "high",
              confidence_note: "Rule",
              is_resolved: false,
            });
          } catch {
            // Ignore secondary insert error
          }
          findingsCount = 1;
          stageDetail = `AI: not used • REQUIRES REVIEW: visual check error — ${errMsg}`;
        }
      }
    } else if (isFinalStage) {
      // ============================================================
      // FINAL RISK ASSESSMENT (stage 7 in text-only, stage 8 with image)
      // ============================================================
      const { data: allFindings } = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", auditId);

      const findingRecords: AuditFindingRecord[] = (allFindings || []).map((f) => ({
        id: f.id,
        category: (f.category === "claim_reliability" ? "claims" : f.category) as AuditDimension,
        severity: f.severity as AuditSeverity,
        excerpt: f.excerpt,
        startIndex: f.start_offset ?? 0,
        endIndex: f.end_offset ?? 0,
        explanation: f.explanation,
        guidelineReference: f.guideline_reference,
        evidenceSourceId: f.evidence_source_id,
        verificationStatus: f.verification_status,
        recommendedAction: f.recommended_action,
        suggestedReplacement: f.suggested_replacement,
        confidence: f.confidence as "high" | "medium" | "low",
        isResolved: f.is_resolved,
      }));

      const scores = calculateAuditScores(findingRecords, checkedDimensions);

      const hasCritical = findingRecords.some((f) => f.severity === "CRITICAL" && !f.isResolved);
      const finalStatus = hasCritical ? "REVISION_REQUIRED" : "COMPLETED";

      const { data: priorStages } = await supabase
        .from("audit_stages")
        .select("stage_number, detail, error")
        .eq("audit_id", auditId);

      const engineModeLabel = deriveEngineModeLabel(
        mode,
        (priorStages || []).map((s) => ({
          stage_number: s.stage_number,
          detail: s.detail,
        }))
      );

      const hasAIFailure =
        mode === "live_ai" &&
        (priorStages || []).some(
          (s) => (s.detail && s.detail.includes("AI: failed, rules only")) || s.error
        );

      stageDetail = `AI: not used • Final score: ${scores.overall}/100`;

      // Update audit record with final scores
      await supabase
        .from("audits")
        .update({
          overall_score: scores.overall,
          scores: {
            voice: scores.voice,
            claims: scores.claims,
            terminology: scores.terminology,
            accessibility: scores.accessibility,
            visual: scores.visual,
            ai_warning: hasAIFailure,
            engine_mode: engineModeLabel,
          },
          status: "COMPLETED",
        })
        .eq("id", auditId);

      // Update content item status
      await supabase
        .from("content_items")
        .update({
          status: finalStatus === "REVISION_REQUIRED" ? "REVISION_REQUIRED" : "READY_FOR_REVIEW",
        })
        .eq("id", audit.content_item_id);

      // Write immutable activity log
      await supabase.from("activity_logs").insert({
        organisation_id: orgId,
        action: "AUDIT_COMPLETED",
        target_type: "audit",
        target_id: auditId,
        details: {
          score: scores.overall,
          criticalCount: findingRecords.filter((f) => f.severity === "CRITICAL").length,
          findingsTotal: findingRecords.length,
        },
      });

      findingsCount = findingRecords.length;
    } else {
      // ============================================================
      // Text pipeline stages — dispatched by stageNum
      // ============================================================
      switch (stageNum) {
      case 1: {
        // [01] CONTENT INGESTION: Sanitize and compute basic metrics
        findingsCount = 0;
        stageDetail = "AI: not used • Content ingested successfully";
        break;
      }

      case 2: {
        // [02] CLAIM EXTRACTION
        const extracted = extractClaimsDeterministic(contentBody);
        let aiClaimsOutcome: AIStageOutcome = "AI: not used";

        // Augment with AI if live mode enabled
        if (mode === "live_ai") {
          try {
            const aiClaims = await generateStructured({
              task: "claim_extraction",
              system:
                "You are a brand verification specialist. Extract specific factual, numerical, and comparative claims from the provided text. Return JSON with a claims array: { \"claims\": [ { \"claim_text\": string, \"claim_type\": \"numerical\" | \"factual\" | \"comparative\" | \"promotional\" | \"opinion\", \"confidence\": \"high\" | \"medium\" | \"low\" } ] }. Every claim_text MUST be an exact literal substring of the provided text.",
              prompt: contentBody,
              schema: claimsExtractionResponseSchema,
              responseSchema: GEMINI_CLAIMS_RESPONSE_SCHEMA,
              organisationId: orgId,
              throwOnError: true,
            });

            if (aiClaims && aiClaims.data && Array.isArray(aiClaims.data.claims)) {
              for (const c of aiClaims.data.claims) {
                if (!c.claim_text || typeof c.claim_text !== "string") continue;
                const idx = contentBody.indexOf(c.claim_text);
                // Validate that excerpt is an exact literal substring of the content
                if (idx !== -1 && !extracted.some((e) => e.text === c.claim_text)) {
                  extracted.push({
                    text: c.claim_text,
                    startIndex: idx,
                    endIndex: idx + c.claim_text.length,
                    claimType: c.claim_type,
                  });
                }
              }
              aiClaimsOutcome = aiClaims.isFallback
                ? "AI: used (fallback model)"
                : "AI: used (primary model)";
            } else {
              aiClaimsOutcome = "AI: failed, rules only (invalid structure)";
            }
          } catch (err) {
            console.warn("AI claim extraction fallback:", err);
            const reason = err instanceof Error ? err.message : String(err);
            aiClaimsOutcome = `AI: failed, rules only (${reason})`;
          }
        }

        // Persist extracted claims to extracted_claims table
        if (extracted.length > 0) {
          const rows = extracted.map((c) => ({
            audit_id: auditId,
            organisation_id: orgId,
            claim_text: c.text,
            claim_type:
              c.claimType === "numerical" ||
              c.claimType === "factual" ||
              c.claimType === "comparative" ||
              c.claimType === "promotional" ||
              c.claimType === "opinion"
                ? c.claimType
                : "factual",
            start_offset: c.startIndex,
            end_offset: c.endIndex,
            verification_status: "UNSUPPORTED",
            confidence: "high",
          }));

          await supabase.from("extracted_claims").insert(rows);
        }
        findingsCount = extracted.length;

        stageDetail = `${aiClaimsOutcome} • Completed with ${findingsCount} claims`;
        break;
      }

      case 3: {
        // [03] SOURCE VERIFICATION
        const { data: storedClaims } = await supabase
          .from("extracted_claims")
          .select("*")
          .eq("audit_id", auditId);

        const { data: facts } = await supabase
          .from("approved_facts")
          .select("*, source_documents(id, status, expiry_date, version)")
          .eq("organisation_id", orgId);

        // Map raw facts to include document provenance fields
        const rawFacts = (facts as any[]) || [];
        const mappedFacts: DatabaseFact[] = rawFacts.map((f) => {
          const srcDoc = f.source_documents as {
            id?: string;
            status?: string;
            expiry_date?: string;
            version?: string;
          } | null;
          return {
            ...f,
            source_document_id: f.source_document_id ?? null,
            source_document_status: srcDoc?.status ?? null,
            source_document_expiry: srcDoc?.expiry_date ?? null,
            source_document_version: srcDoc?.version ?? f.source_document_version ?? null,
          } as DatabaseFact;
        });

        const { data: settings } = await supabase
          .from("organisation_settings")
          .select("audit_tolerance_percent")
          .eq("organisation_id", orgId)
          .single();

        const tolerance = settings?.audit_tolerance_percent ?? 5.0;
        const rawClaims = extractClaimsDeterministic(contentBody);

        const newFindings: Array<{
          finding_code: string;
          audit_id: string;
          organisation_id: string;
          category: string;
          severity: AuditSeverity;
          excerpt: string;
          start_offset: number;
          end_offset: number;
          explanation: string;
          guideline_reference: string;
          verification_status: string;
          recommended_action: string;
          suggested_replacement?: string;
          confidence: "high" | "medium" | "low";
          confidence_note?: string;
          is_resolved: boolean;
          claim_id?: string;
        }> = [];

        if (storedClaims && storedClaims.length > 0) {
          let idx = 0;
          for (const claim of storedClaims) {
            idx++;
            const raw = rawClaims.find((r) => r.text === claim.claim_text) || {
              text: claim.claim_text,
              startIndex: claim.start_offset ?? 0,
              endIndex: claim.end_offset ?? claim.claim_text.length,
              claimType: claim.claim_type as
                | "numerical"
                | "factual"
                | "comparative"
                | "promotional"
                | "opinion",
            };

            const verified = verifyClaimAgainstEvidence(
              raw,
              mappedFacts,
              tolerance
            );

            // Update extracted_claims row status
            await supabase
              .from("extracted_claims")
              .update({
                verification_status: verified.status,
              })
              .eq("id", claim.id);

            // If matched with an approved fact, record evidence match
            if (verified.matchedFact) {
              await supabase.from("evidence_matches").insert({
                organisation_id: orgId,
                audit_id: auditId,
                claim_id: claim.id,
                approved_fact_id: verified.matchedFact.id,
                excerpt: raw.text,
                result: verified.status,
                comparison: {
                  explanation: verified.explanation,
                  variance_percent: verified.variancePercent || null,
                },
              });
            }

            // If not verified, create an audit finding
            if (verified.status !== "VERIFIED") {
              const severity: AuditSeverity =
                verified.status === "CONTRADICTED"
                  ? "CRITICAL"
                  : verified.status === "OUTDATED" || verified.status === "UNSUPPORTED"
                  ? "HIGH"
                  : "MEDIUM";

              let suggestedReplacement: string | undefined;
              if (verified.status === "CONTRADICTED" && verified.matchedFact) {
                // Grammatical replacement for only the flagged span with no duplicated pilot text
                const isPercentClaim = ("unit" in raw && raw.unit === "%") || raw.text.endsWith("%");
                if (isPercentClaim) {
                  const num = verified.matchedFact.numeric_value ?? 18;
                  const surrounding = contentBody.slice(
                    Math.max(0, raw.startIndex - 50),
                    Math.min(contentBody.length, raw.endIndex + 50)
                  ).toLowerCase();
                  const alreadyMentionsPilot = surrounding.includes("pilot");
                  suggestedReplacement = alreadyMentionsPilot ? `${num}%` : `${num}% in an internal pilot`;
                } else {
                  let factVal = verified.matchedFact.value || "";
                  factVal = factVal.replace(/\s*\((?:in\s+)?internal\s+pilot\)/gi, "").trim();
                  suggestedReplacement = factVal;
                }
              } else if (verified.status === "OUTDATED" && verified.currentFact) {
                suggestedReplacement = verified.currentFact.value;
              }

              newFindings.push({
                finding_code: `FND-CLM-${idx}`,
                audit_id: auditId,
                organisation_id: orgId,
                category: "claim_reliability",
                severity,
                excerpt: raw.text,
                start_offset: raw.startIndex,
                end_offset: raw.endIndex,
                explanation: verified.explanation,
                guideline_reference: (() => {
                  const mf = verified.matchedFact;
                  if (!mf) return "Claim Provenance & Evidence Standard §2.1";
                  let ref = `Approved Fact: ${mf.name}`;
                  if (mf.source_document_id) {
                    const srcDoc = rawFacts.find((f: any) => f.id === mf.id)
                      ?.source_documents as { id?: string; status?: string } | null;
                    const docName = mf.source_citation?.split(",")[0] || "Source Document";
                    const ver = mf.source_document_version ? ` v${mf.source_document_version}` : "";
                    const pg = mf.source_page ? `, p.${mf.source_page}` : "";
                    ref += ` | Source: ${docName}${ver}${pg}`;
                    if (mf.source_excerpt) {
                      ref += ` | Excerpt: "${mf.source_excerpt.slice(0, 80)}${mf.source_excerpt.length > 80 ? "…" : ""}"`;
                    }
                  }
                  return ref;
                })(),
                verification_status: verified.status,
                recommended_action:
                  verified.status === "CONTRADICTED"
                    ? `Align claim with approved benchmark: ${verified.matchedFact?.value}.`
                    : verified.status === "OUTDATED"
                    ? `Update to latest approved figure: ${verified.currentFact?.value}.`
                    : "Attach authoritative evidence source or remove numerical claim.",
                suggested_replacement: suggestedReplacement,
                confidence: "high",
                confidence_note: "Rule",
                is_resolved: false,
                claim_id: claim.id,
              });
            }
          }
        }

        if (newFindings.length > 0) {
          await supabase.from("audit_findings").insert(newFindings);
        }
        findingsCount = newFindings.length;
        stageDetail = `AI: not used • Completed with ${findingsCount} findings`;
        break;
      }

      case 4: {
        // [04] BRAND VOICE ANALYSIS
        const { data: termRules } = await supabase
          .from("terminology_rules")
          .select("*")
          .eq("organisation_id", orgId);

        const voiceFindings = checkBrandVoiceDeterministic(
          contentBody,
          (termRules as unknown as DatabaseTermRule[]) || []
        );

        let aiVoiceOutcome: AIStageOutcome = "AI: not used";

        // Augment with Live AI if enabled
        if (mode === "live_ai") {
          try {
            // Fetch published guidelines for the organisation
            const { data: dbGuidelines } = await supabase
              .from("brand_guidelines")
              .select("title, category, body, rules, prohibited_terms")
              .eq("organisation_id", orgId)
              .eq("status", "published");

            const itemData = audit.content_items as unknown as {
              platform?: string;
              audience?: string;
              content_type?: string;
              department?: string;
            } | null;

            const platform = itemData?.platform || "General";
            const audience = itemData?.audience || "General Audience";

            // Compact relevant guideline excerpts only (Requirement 3: SPEED)
            const guidelinesSummary = (dbGuidelines || [])
              .slice(0, 4)
              .map((g) => ({
                title: g.title,
                rules: Array.isArray(g.rules) ? g.rules.slice(0, 4) : g.rules,
              }));

            const userPrompt = JSON.stringify({
              content: contentBody,
              platform,
              audience,
              guidelines:
                guidelinesSummary.length > 0
                  ? guidelinesSummary
                  : [
                      {
                        title: "Brand Voice Standard",
                        body: "Clear, professional, human, approachable. Avoid aggressive, coercive hype or ungrounded urgency.",
                        rules: [
                          "No aggressive, coercive, or high-pressure FOMO sales language.",
                          "Preserve clarity and speak to creators and managers with respect and professional rigor.",
                          "Avoid casual slang, ungrounded urgency, and colloquial pressure.",
                        ],
                      },
                    ],
            });

            const systemPrompt =
              "You are an authoritative brand voice auditor. Evaluate the submitted text against the organization's published brand voice guidelines, target audience, and distribution platform. Identify spans of text that violate brand tone, style, professionalism, or guidelines. Return JSON with a findings array containing: excerpt (must be an EXACT literal substring from the text), severity (CRITICAL, HIGH, MEDIUM, LOW, or INFO), explanation, guideline_cited, suggested_replacement.";

            const aiRes = await generateStructured({
              task: "voice_analysis",
              system: systemPrompt,
              prompt: userPrompt,
              schema: voiceAnalysisResponseSchema,
              responseSchema: GEMINI_VOICE_RESPONSE_SCHEMA,
              organisationId: orgId,
              throwOnError: true,
            });

            let addedAICount = 0;
            if (aiRes && aiRes.data && Array.isArray(aiRes.data.findings)) {
              const normalizedDisallowed = new Set(
                (termRules || []).map((r) => r.disallowed_term.trim().toLowerCase())
              );

              for (const f of aiRes.data.findings) {
                if (!f.excerpt || typeof f.excerpt !== "string") continue;

                // Locate excerpt in contentBody
                let idx = contentBody.indexOf(f.excerpt);
                let endIndex = 0;
                if (idx !== -1) {
                  endIndex = idx + f.excerpt.length;
                } else {
                  // Try trimmed match or case-insensitive match
                  const trimmed = f.excerpt.trim();
                  const trimIdx = contentBody.indexOf(trimmed);
                  if (trimIdx !== -1) {
                    idx = trimIdx;
                    endIndex = trimIdx + trimmed.length;
                  } else {
                    // Fallback: If an AI finding's excerpt cannot be located in the text,
                    // still list it in the findings list (just without a highlight, offsets 0)
                    idx = 0;
                    endIndex = 0;
                  }
                }

                const lowerExcerpt = f.excerpt.trim().toLowerCase();
                // Skip if "number one" or matches a terminology rule
                if (lowerExcerpt === "number one" || lowerExcerpt === "#1") continue;
                if (normalizedDisallowed.has(lowerExcerpt)) continue;

                // Deduplicate: if an existing voice finding covers this exact span, skip
                if (
                  idx > 0 &&
                  voiceFindings.some(
                    (vf) => vf.startIndex === idx && vf.endIndex === endIndex
                  )
                ) {
                  continue;
                }
                if (
                  idx === 0 &&
                  voiceFindings.some(
                    (vf) => vf.excerpt.toLowerCase() === f.excerpt.toLowerCase()
                  )
                ) {
                  continue;
                }

                voiceFindings.push({
                  id: `FIND-AI-${String(addedAICount + 1).padStart(3, "0")}`,
                  category: "voice",
                  severity: f.severity,
                  excerpt: f.excerpt,
                  startIndex: idx,
                  endIndex,
                  explanation: f.explanation,
                  guidelineReference:
                    f.guideline_cited || "Brand Voice Guidelines: Tone, Style & Hype Reduction",
                  recommendedAction: f.suggested_replacement
                    ? `Replace with: "${f.suggested_replacement}"`
                    : f.explanation,
                  suggestedReplacement: f.suggested_replacement,
                  confidence: "high",
                  isResolved: false,
                });
                addedAICount++;
              }

              aiVoiceOutcome = aiRes.isFallback
                ? "AI: used (fallback model)"
                : "AI: used (primary model)";
            } else {
              aiVoiceOutcome = "AI: failed, rules only (invalid structure)";
            }
          } catch (err) {
            console.warn("AI voice analysis failed:", err);
            const reason = err instanceof Error ? err.message : String(err);
            aiVoiceOutcome = `AI: failed, rules only (${reason})`;
          }
        }

        if (voiceFindings.length > 0) {
          const rows = voiceFindings.map((f, idx) => ({
            finding_code: `FND-VOI-${idx + 1}`,
            audit_id: auditId,
            organisation_id: orgId,
            category: "voice",
            severity: f.severity,
            excerpt: f.excerpt,
            start_offset: f.startIndex,
            end_offset: f.endIndex,
            explanation: f.explanation,
            guideline_reference: f.guidelineReference,
            recommended_action: f.recommendedAction,
            suggested_replacement: f.suggestedReplacement,
            confidence: (f.confidence as "high" | "medium" | "low") || "high",
            confidence_note: f.id.includes("AI") ? "AI" : "Rule",
            is_resolved: false,
          }));

          await supabase.from("audit_findings").insert(rows);
        }
        findingsCount = voiceFindings.length;

        stageDetail = `${aiVoiceOutcome} • Completed with ${findingsCount} findings`;
        break;
      }

      case 5: {
        // [05] TERMINOLOGY INSPECTION
        const { data: termRules } = await supabase
          .from("terminology_rules")
          .select("*")
          .eq("organisation_id", orgId);

        // Check if content has performance claims (percentages or numbers)
        const hasPerformance = /\b(\d+(?:\.\d+)?%|productivity|task completion|faster)\b/i.test(contentBody);

        const termFindings = checkTerminologyDeterministic(
          contentBody,
          (termRules as unknown as DatabaseTermRule[]) || [],
          hasPerformance
        );

        if (termFindings.length > 0) {
          const rows = termFindings.map((f, idx) => ({
            finding_code: `FND-TRM-${idx + 1}`,
            audit_id: auditId,
            organisation_id: orgId,
            category: "terminology",
            severity: f.severity || "MEDIUM",
            excerpt: f.excerpt,
            start_offset: f.startIndex,
            end_offset: f.endIndex,
            explanation: f.explanation,
            guideline_reference: f.guidelineReference,
            recommended_action: f.recommendedAction,
            suggested_replacement: f.suggestedReplacement,
            confidence: (f.confidence as "high" | "medium" | "low") || "high",
            confidence_note: "Rule",
            is_resolved: false,
          }));

          await supabase.from("audit_findings").insert(rows);
        }
        findingsCount = termFindings.length;
        stageDetail = `AI: not used • Completed with ${findingsCount} findings`;
        break;
      }

      case 6: {
        // [06] ACCESSIBILITY CHECK
        const { findings: a11yFindings } = checkAccessibilityDeterministic(contentBody);

        if (a11yFindings.length > 0) {
          const rows = a11yFindings.map((f, idx) => ({
            finding_code: `FND-A11Y-${idx + 1}`,
            audit_id: auditId,
            organisation_id: orgId,
            category: "accessibility",
            severity: f.severity,
            excerpt: f.excerpt,
            start_offset: f.startIndex,
            end_offset: f.endIndex,
            explanation: f.explanation,
            guideline_reference: f.guidelineReference,
            recommended_action: f.recommendedAction,
            confidence: (f.confidence as "high" | "medium" | "low") || "high",
            confidence_note: "Rule",
            is_resolved: false,
          }));

          await supabase.from("audit_findings").insert(rows);
        }
        findingsCount = a11yFindings.length;
        stageDetail = `AI: not used • Completed with ${findingsCount} findings`;
        break;
      }

      case 7: {
        // [07] FINAL RISK ASSESSMENT & SCORING (text-only 7-stage pipeline)
        // This case is only reached in text-only pipelines; 8-stage routes through isFinalStage above.
        const { data: allFindingsRaw } = await supabase
          .from("audit_findings")
          .select("*")
          .eq("audit_id", auditId);

        const findingRecords: AuditFindingRecord[] = (allFindingsRaw || []).map((f) => ({
          id: f.id,
          category: (f.category === "claim_reliability" ? "claims" : f.category) as AuditDimension,
          severity: f.severity as AuditSeverity,
          excerpt: f.excerpt,
          startIndex: f.start_offset ?? 0,
          endIndex: f.end_offset ?? 0,
          explanation: f.explanation,
          guidelineReference: f.guideline_reference,
          evidenceSourceId: f.evidence_source_id,
          verificationStatus: f.verification_status,
          recommendedAction: f.recommended_action,
          suggestedReplacement: f.suggested_replacement,
          confidence: f.confidence as "high" | "medium" | "low",
          isResolved: f.is_resolved,
        }));

        const checkedDims: AuditDimension[] = ["voice", "claims", "terminology", "accessibility"];
        const scores = calculateAuditScores(findingRecords, checkedDims);

        const hasCritical = findingRecords.some((f) => f.severity === "CRITICAL" && !f.isResolved);
        const finalStatus = hasCritical ? "REVISION_REQUIRED" : "COMPLETED";

        const { data: priorStages } = await supabase
          .from("audit_stages")
          .select("stage_number, detail, error")
          .eq("audit_id", auditId);

        const engineModeLabel = deriveEngineModeLabel(
          mode,
          (priorStages || []).map((s) => ({
            stage_number: s.stage_number,
            detail: s.detail,
          }))
        );

        const hasAIFailure =
          mode === "live_ai" &&
          (priorStages || []).some(
            (s) => (s.detail && s.detail.includes("AI: failed, rules only")) || s.error
          );

        stageDetail = `AI: not used • Final score: ${scores.overall}/100`;

        await supabase
          .from("audits")
          .update({
            overall_score: scores.overall,
            scores: {
              voice: scores.voice,
              claims: scores.claims,
              terminology: scores.terminology,
              accessibility: scores.accessibility,
              visual: scores.visual,
              ai_warning: hasAIFailure,
              engine_mode: engineModeLabel,
            },
            status: "COMPLETED",
          })
          .eq("id", auditId);

        await supabase
          .from("content_items")
          .update({
            status: finalStatus === "REVISION_REQUIRED" ? "REVISION_REQUIRED" : "READY_FOR_REVIEW",
          })
          .eq("id", audit.content_item_id);

        await supabase.from("activity_logs").insert({
          organisation_id: orgId,
          action: "AUDIT_COMPLETED",
          target_type: "audit",
          target_id: auditId,
          details: {
            score: scores.overall,
            criticalCount: findingRecords.filter((f) => f.severity === "CRITICAL").length,
            findingsTotal: findingRecords.length,
          },
        });

        findingsCount = findingRecords.length;
        break;
      }
      } // end switch (text-only stages)
    } // end else (text pipeline)

    // Mark stage as COMPLETED
    await supabase
      .from("audit_stages")
      .update({
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        detail: stageDetail || `Completed with ${findingsCount} findings`,
      })
      .eq("id", stageId);

    let finalAuditFindings: any[] | undefined;
    if (isFinalStage) {
      const { data: dbFindings } = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", auditId)
        .order("created_at", { ascending: true });

      finalAuditFindings = (dbFindings || []).map((f) => ({
        id: f.id,
        category: (f.category === "claim_reliability" ? "claims" : f.category) as
          | "voice"
          | "claims"
          | "terminology"
          | "accessibility"
          | "visual",
        severity: f.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
        excerpt: f.excerpt,
        start_index: f.start_offset ?? 0,
        end_index: f.end_offset ?? 0,
        explanation: f.explanation,
        guideline_reference: f.guideline_reference,
        verification_status: f.verification_status,
        recommended_action: f.recommended_action,
        suggested_replacement: f.suggested_replacement,
        confidence: f.confidence as "high" | "medium" | "low",
        confidence_note: f.confidence_note,
        source: (f.confidence_note === "AI" ||
        f.id?.includes("AI") ||
        f.finding_code?.includes("AI")
          ? "AI"
          : "Rule") as "Rule" | "AI",
        is_resolved: f.is_resolved,
      }));
    }

    return {
      completed: isFinalStage,
      findings: finalAuditFindings,
      stage: {
        number: stageNum,
        name: nextStage.stage_key || nextStage.stage_name,
        status: "COMPLETED",
        findingsCount,
        detail: stageDetail || `Completed with ${findingsCount} findings`,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("audit_stages")
      .update({
        status: "FAILED",
        error: errorMsg,
        detail: `Failed: ${errorMsg}`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", stageId);

    await supabase.from("audits").update({ status: "FAILED" }).eq("id", auditId);

    throw new Error(`Stage ${stageNum} failed: ${errorMsg}`);
  }
}
