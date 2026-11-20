/**
 * Tests for Change-Impact Tracking and Guideline-Clarity Suggestions.
 *
 * Requirements tested:
 * 1. Editing a fact creates an impact for an approved item using it and none for an unrelated item.
 * 2. A repeated impact is not duplicated (idempotency).
 * 3. Clarity suggestions appear only above thresholds (>= 3 findings, >= 2 dismissals/challenges).
 */
import { describe, it, expect } from "vitest";
import {
  findAffectedContentItems,
  createImpactRecords,
} from "@/lib/impact/tracker";
import { computeClaritySuggestions } from "@/lib/clarity/suggestions";

// Helper to create a mock Supabase client
function createMockSupabase(overrides: {
  evidenceMatches?: Array<{ audit_id: string; approved_fact_id: string; organisation_id: string }>;
  audits?: Array<{ id: string; content_item_id: string; organisation_id: string }>;
  contentItems?: Array<{ id: string; status: string; organisation_id: string }>;
  impactTable?: any[];
  terminologyRules?: Array<{ id: string; disallowed_term: string; approved_term: string; organisation_id?: string }>;
  brandGuidelines?: Array<{ id: string; title: string; status: string; organisation_id?: string }>;
  auditFindings?: Array<{ id: string; category: string; guideline_reference: string; is_resolved: boolean; created_at: string; organisation_id: string }>;
  findingChallenges?: Array<{ id: string; finding_id: string; challenge_decisions?: Array<{ decision: string }> }>;
}) {
  const store: Record<string, any[]> = {
    evidence_matches: overrides.evidenceMatches || [],
    audits: overrides.audits || [],
    content_items: overrides.contentItems || [],
    fact_change_impacts: overrides.impactTable || [],
    terminology_rules: overrides.terminologyRules || [],
    brand_guidelines: overrides.brandGuidelines || [],
    audit_findings: overrides.auditFindings || [],
    finding_challenges: overrides.findingChallenges || [],
  };

  const client: any = {
    from: (tableName: string) => {
      let filteredData = [...(store[tableName] || [])];

      const queryBuilder: any = {
        select: (_fields?: string) => queryBuilder,
        eq: (col: string, val: any) => {
          filteredData = filteredData.filter((r) => r[col] === val);
          return queryBuilder;
        },
        neq: (col: string, val: any) => {
          filteredData = filteredData.filter((r) => r[col] !== val);
          return queryBuilder;
        },
        in: (col: string, vals: any[]) => {
          filteredData = filteredData.filter((r) => vals.includes(r[col]));
          return queryBuilder;
        },
        ilike: (col: string, pattern: string) => {
          const match = pattern.replace(/%/g, "").toLowerCase();
          filteredData = filteredData.filter((r) =>
            String(r[col] || "").toLowerCase().includes(match)
          );
          return queryBuilder;
        },
        gte: (_col: string, _val: any) => queryBuilder,
        not: (_col: string, _op: string, _val: any) => queryBuilder,
        order: () => queryBuilder,
        limit: () => queryBuilder,
        upsert: async (records: any[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
          const arr = Array.isArray(records) ? records : [records];
          for (const rec of arr) {
            // Check conflict on fact_id, content_item_id, change_type
            const conflict = (store[tableName] || []).find(
              (existing) =>
                existing.fact_id === rec.fact_id &&
                existing.content_item_id === rec.content_item_id &&
                existing.change_type === rec.change_type
            );
            if (!conflict) {
              store[tableName].push({ id: `imp-${Date.now()}-${Math.random()}`, ...rec });
            }
          }
          return { error: null, data: store[tableName] };
        },
        insert: async (records: any[]) => {
          const arr = Array.isArray(records) ? records : [records];
          store[tableName].push(...arr);
          return { error: null, data: arr };
        },
        then: (resolve: (val: any) => void) => {
          // Pass a clone of filteredData so subsequent queries to the same table get fresh data
          resolve({ data: [...filteredData], error: null });
        },
      };

      return queryBuilder;
    },
  };

  return { client, store };
}

describe("Change-Impact Tracking", () => {
  const orgId = "org-test-123";
  const factId = "fact-target";
  const approvedItemId = "item-approved-1";
  const unrelatedItemId = "item-unrelated-2";
  const auditApprovedId = "audit-1";
  const auditUnrelatedId = "audit-2";

  it("creates an impact for an approved item using the fact and NONE for an unrelated item", async () => {
    const { client, store } = createMockSupabase({
      // evidence_matches: only auditApprovedId used factId
      evidenceMatches: [
        { audit_id: auditApprovedId, approved_fact_id: factId, organisation_id: orgId },
        { audit_id: auditUnrelatedId, approved_fact_id: "other-fact", organisation_id: orgId },
      ],
      audits: [
        { id: auditApprovedId, content_item_id: approvedItemId, organisation_id: orgId },
        { id: auditUnrelatedId, content_item_id: unrelatedItemId, organisation_id: orgId },
      ],
      contentItems: [
        { id: approvedItemId, status: "APPROVED", organisation_id: orgId },
        { id: unrelatedItemId, status: "APPROVED", organisation_id: orgId },
      ],
    });

    const affected = await findAffectedContentItems(client, orgId, factId);
    expect(affected).toEqual([approvedItemId]);
    expect(affected).not.toContain(unrelatedItemId);

    const count = await createImpactRecords(
      client,
      orgId,
      factId,
      "value_changed",
      "18%",
      "22%",
      "Benchmark revised"
    );

    expect(count).toBe(1);
    expect(store.fact_change_impacts.length).toBe(1);
    expect(store.fact_change_impacts[0].content_item_id).toBe(approvedItemId);
    expect(store.fact_change_impacts[0].old_value).toBe("18%");
    expect(store.fact_change_impacts[0].new_value).toBe("22%");
  });

  it("does not create an impact for items that are DRAFT or REJECTED", async () => {
    const draftItemId = "item-draft";
    const auditDraftId = "audit-draft";

    const { client } = createMockSupabase({
      evidenceMatches: [
        { audit_id: auditDraftId, approved_fact_id: factId, organisation_id: orgId },
      ],
      audits: [{ id: auditDraftId, content_item_id: draftItemId, organisation_id: orgId }],
      contentItems: [{ id: draftItemId, status: "DRAFT", organisation_id: orgId }],
    });

    const affected = await findAffectedContentItems(client, orgId, factId);
    expect(affected).toHaveLength(0);
  });

  it("does not duplicate repeated impacts for the same fact, item, and change type", async () => {
    const { client, store } = createMockSupabase({
      evidenceMatches: [
        { audit_id: auditApprovedId, approved_fact_id: factId, organisation_id: orgId },
      ],
      audits: [{ id: auditApprovedId, content_item_id: approvedItemId, organisation_id: orgId }],
      contentItems: [{ id: approvedItemId, status: "APPROVED", organisation_id: orgId }],
      impactTable: [
        {
          id: "existing-imp-1",
          organisation_id: orgId,
          fact_id: factId,
          content_item_id: approvedItemId,
          change_type: "value_changed",
          status: "OPEN",
        },
      ],
    });

    // Run impact creation again
    await createImpactRecords(
      client,
      orgId,
      factId,
      "value_changed",
      "18%",
      "25%",
      "Second update"
    );

    // Should still only have 1 record
    expect(store.fact_change_impacts.length).toBe(1);
  });
});

describe("Guideline Clarity Suggestions", () => {
  const orgId = "org-test-123";

  it("creates a suggestion when a rule exceeds the thresholds (>=3 findings, >=2 dismissals or challenges)", async () => {
    const { client } = createMockSupabase({
      terminologyRules: [
        { id: "rule-1", disallowed_term: "synergy", approved_term: "collaboration", organisation_id: orgId },
      ],
      brandGuidelines: [],
      auditFindings: [
        { id: "f-1", category: "terminology", guideline_reference: "Disallowed: synergy", is_resolved: true, created_at: new Date().toISOString(), organisation_id: orgId },
        { id: "f-2", category: "terminology", guideline_reference: "Disallowed: synergy", is_resolved: true, created_at: new Date().toISOString(), organisation_id: orgId },
        { id: "f-3", category: "terminology", guideline_reference: "Disallowed: synergy", is_resolved: false, created_at: new Date().toISOString(), organisation_id: orgId },
      ],
      // 3 findings, 2 dismissed (is_resolved = true) => meets >=3 findings, >=2 friction
      findingChallenges: [],
    });

    const suggestions = await computeClaritySuggestions(client, orgId);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].rule_label).toBe("synergy → collaboration");
    expect(suggestions[0].findings_count).toBe(3);
    expect(suggestions[0].dismissed_count).toBe(2);
    expect(suggestions[0].suggestion_text).toContain("synergy → collaboration");
  });

  it("does NOT create a suggestion if findings < 3", async () => {
    const { client } = createMockSupabase({
      terminologyRules: [
        { id: "rule-2", disallowed_term: "ninja", approved_term: "specialist", organisation_id: orgId },
      ],
      auditFindings: [
        { id: "f-1", category: "terminology", guideline_reference: "Disallowed: ninja", is_resolved: true, created_at: new Date().toISOString(), organisation_id: orgId },
        { id: "f-2", category: "terminology", guideline_reference: "Disallowed: ninja", is_resolved: true, created_at: new Date().toISOString(), organisation_id: orgId },
      ],
      findingChallenges: [],
    });

    const suggestions = await computeClaritySuggestions(client, orgId);
    expect(suggestions).toHaveLength(0);
  });

  it("does NOT create a suggestion if dismissals + challenges < 2 even if findings >= 3", async () => {
    const { client } = createMockSupabase({
      brandGuidelines: [
        { id: "g-1", title: "Tone of Voice", status: "published", organisation_id: orgId },
      ],
      auditFindings: [
        { id: "f-1", category: "voice", guideline_reference: "Tone of Voice guideline", is_resolved: false, created_at: new Date().toISOString(), organisation_id: orgId },
        { id: "f-2", category: "voice", guideline_reference: "Tone of Voice guideline", is_resolved: false, created_at: new Date().toISOString(), organisation_id: orgId },
        { id: "f-3", category: "voice", guideline_reference: "Tone of Voice guideline", is_resolved: true, created_at: new Date().toISOString(), organisation_id: orgId },
      ],
      // 3 findings, but only 1 dismissed and 0 challenges => friction = 1 < 2
      findingChallenges: [],
    });

    const suggestions = await computeClaritySuggestions(client, orgId);
    expect(suggestions).toHaveLength(0);
  });
});
