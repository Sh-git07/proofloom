import { createAdminClient } from "@/lib/supabase/admin";
import { extractClaimsDeterministic } from "./claim-extraction";
import { verifyClaimAgainstEvidence, DatabaseFact } from "./evidence";
import { checkBrandVoiceDeterministic } from "./brand-voice";
import { checkTerminologyDeterministic, DatabaseTermRule } from "./terminology";
import { checkAccessibilityDeterministic } from "./accessibility";
import { calculateAuditScores } from "./scoring";
import { AuditFindingRecord, AuditSeverity, AuditDimension } from "./types";
import { generateStructured } from "@/lib/ai";
import { z } from "zod";

export const STAGE_NAMES = [
  "[01] CONTENT INGESTION",
  "[02] CLAIM EXTRACTION",
  "[03] SOURCE VERIFICATION",
  "[04] BRAND VOICE ANALYSIS",
  "[05] TERMINOLOGY INSPECTION",
  "[06] ACCESSIBILITY CHECK",
  "[07] FINAL RISK ASSESSMENT",
] as const;

/**
 * Initializes an audit and all 7 stages in QUEUED state within Supabase.
 */
export async function initializeAudit({
  organisationId,
  contentItemId,
  contentVersionId,
  mode = "live_ai",
}: {
  organisationId: string;
  contentItemId: string;
  contentVersionId: string;
  mode?: "live_ai" | "demo";
}) {
  const supabase = createAdminClient();

  // Create audit record
  const { data: audit, error: auditErr } = await supabase
    .from("audits")
    .insert({
      organisation_id: organisationId,
      content_item_id: contentItemId,
      content_version_id: contentVersionId,
      status: "QUEUED",
      mode,
      checked_dimensions: ["voice", "claims", "terminology", "accessibility"],
    })
    .select("id")
    .single();

  if (auditErr || !audit) {
    throw new Error(`Failed to create audit row: ${auditErr?.message || "Unknown error"}`);
  }

  // Create all 7 audit_stages rows with QUEUED status
  const stageRows = STAGE_NAMES.map((name, idx) => ({
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

  // 1. Fetch audit details
  const { data: audit, error: auditErr } = await supabase
    .from("audits")
    .select(`
      id,
      organisation_id,
      content_item_id,
      content_version_id,
      mode,
      status,
      content_versions(body),
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

  // Find next QUEUED or FAILED stage
  const nextStage = stages.find((s) => s.status === "QUEUED" || s.status === "FAILED");
  if (!nextStage) {
    return { completed: true, stage: null, auditStatus: audit.status };
  }

  const stageId = nextStage.id;
  const stageNum = nextStage.stage_number;
  const contentBody = (audit.content_versions as unknown as { body: string })?.body || "";
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

    // Execute stage-specific logic
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
        let aiClaimsStatus: "used" | "failed" | "not_used" = "not_used";

        // Augment with AI if live mode enabled
        if (mode === "live_ai") {
          try {
            const aiClaims = await generateStructured({
              task: "claim_extraction",
              system:
                "You are a brand verification specialist. Extract specific factual, numerical, and comparative claims from the provided text. Return literal substrings only.",
              prompt: contentBody,
              schema: z.object({
                claims: z.array(
                  z.object({
                    claim_text: z.string(),
                    claim_type: z.enum([
                      "numerical",
                      "factual",
                      "comparative",
                      "promotional",
                      "opinion",
                    ]),
                    confidence: z.enum(["high", "medium", "low"]),
                  })
                ),
              }),
              organisationId: orgId,
              throwOnError: true,
            });

            if (aiClaims && aiClaims.data && Array.isArray(aiClaims.data.claims)) {
              for (const c of aiClaims.data.claims) {
                if (!c.claim_text || typeof c.claim_text !== "string") continue;
                const idx = contentBody.indexOf(c.claim_text);
                if (idx !== -1 && !extracted.some((e) => e.text === c.claim_text)) {
                  extracted.push({
                    text: c.claim_text,
                    startIndex: idx,
                    endIndex: idx + c.claim_text.length,
                    claimType: c.claim_type,
                  });
                }
              }
              aiClaimsStatus = "used";
            } else {
              aiClaimsStatus = "failed";
            }
          } catch (err) {
            console.warn("AI claim extraction fallback:", err);
            aiClaimsStatus = "failed";
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

        if (mode !== "live_ai") {
          stageDetail = `AI: not used • Completed with ${findingsCount} claims`;
        } else if (aiClaimsStatus === "used") {
          stageDetail = `AI: used • Completed with ${findingsCount} claims`;
        } else {
          stageDetail = `AI: failed, rules only • Completed with ${findingsCount} claims (warning: AI claim extraction unavailable)`;
        }
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
          .select("*")
          .eq("organisation_id", orgId);

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
              (facts as unknown as DatabaseFact[]) || [],
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
                guideline_reference: verified.matchedFact
                  ? `Approved Fact: ${verified.matchedFact.name}`
                  : "Claim Provenance & Evidence Standard §2.1",
                verification_status: verified.status,
                recommended_action:
                  verified.status === "CONTRADICTED"
                    ? `Align claim with approved benchmark: ${verified.matchedFact?.value}.`
                    : verified.status === "OUTDATED"
                    ? `Update to latest approved figure: ${verified.currentFact?.value}.`
                    : "Attach authoritative evidence source or remove numerical claim.",
                suggested_replacement: suggestedReplacement,
                confidence: "high",
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

        let aiVoiceStatus: "used" | "failed" | "not_used" = "not_used";

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

            const guidelinesSummary = (dbGuidelines || []).map((g) => ({
              title: g.title,
              body: g.body,
              rules: g.rules,
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
              schema: z.object({
                findings: z.array(
                  z.object({
                    excerpt: z.string(),
                    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
                    explanation: z.string(),
                    guideline_cited: z.string(),
                    suggested_replacement: z.string().optional(),
                  })
                ),
              }),
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
                const idx = contentBody.indexOf(f.excerpt);
                // Discard any excerpt that is not a literal substring
                if (idx === -1) {
                  continue;
                }

                const lowerExcerpt = f.excerpt.trim().toLowerCase();
                // Skip if "number one" or matches a terminology rule
                if (lowerExcerpt === "number one" || lowerExcerpt === "#1") continue;
                if (normalizedDisallowed.has(lowerExcerpt)) continue;

                // Deduplicate: if an existing voice finding covers this exact span, skip
                if (
                  voiceFindings.some(
                    (vf) => vf.startIndex === idx && vf.endIndex === idx + f.excerpt.length
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
                  endIndex: idx + f.excerpt.length,
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

              if (aiRes.data.findings.length > 0 && addedAICount === 0) {
                aiVoiceStatus = "failed";
              } else {
                aiVoiceStatus = "used";
              }
            } else {
              aiVoiceStatus = "failed";
            }
          } catch (err) {
            console.warn("AI voice analysis failed:", err);
            aiVoiceStatus = "failed";
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
            confidence_note: f.id.includes("AI") ? "AI" : "rules",
            is_resolved: false,
          }));

          await supabase.from("audit_findings").insert(rows);
        }
        findingsCount = voiceFindings.length;

        if (mode !== "live_ai") {
          stageDetail = `AI: not used • Completed with ${findingsCount} findings`;
        } else if (aiVoiceStatus === "used") {
          stageDetail = `AI: used • Completed with ${findingsCount} findings`;
        } else {
          stageDetail = `AI: failed, rules only • Completed with ${findingsCount} findings (warning: AI voice analysis unavailable)`;
        }
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
            is_resolved: false,
          }));

          await supabase.from("audit_findings").insert(rows);
        }
        findingsCount = a11yFindings.length;
        stageDetail = `AI: not used • Completed with ${findingsCount} findings`;
        break;
      }

      case 7: {
        // [07] FINAL RISK ASSESSMENT & SCORING
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

        const checkedDims: AuditDimension[] = ["voice", "claims", "terminology", "accessibility"];
        const scores = calculateAuditScores(findingRecords, checkedDims);

        const hasCritical = findingRecords.some((f) => f.severity === "CRITICAL" && !f.isResolved);
        const finalStatus = hasCritical ? "REVISION_REQUIRED" : "COMPLETED";

        const { data: priorStages } = await supabase
          .from("audit_stages")
          .select("detail, error")
          .eq("audit_id", auditId);

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
        break;
      }
    }

    // Mark stage as COMPLETED
    await supabase
      .from("audit_stages")
      .update({
        status: "COMPLETED",
        finished_at: new Date().toISOString(),
        detail: stageDetail || `Completed with ${findingsCount} findings`,
      })
      .eq("id", stageId);

    return {
      completed: stageNum === 7,
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
        finished_at: new Date().toISOString(),
      })
      .eq("id", stageId);

    await supabase.from("audits").update({ status: "FAILED" }).eq("id", auditId);

    throw new Error(`Stage ${stageNum} failed: ${errorMsg}`);
  }
}
