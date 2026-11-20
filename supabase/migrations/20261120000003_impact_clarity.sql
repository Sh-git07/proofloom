-- =========================================================================
-- Impact Tracking & Guideline Clarity Suggestions Migration
-- Additive only: new tables, no changes to existing tables or constraints.
-- =========================================================================

-- 1. fact_change_impacts: one record per (fact, content_item) pair when a
--    fact used as evidence changes in a material way.
CREATE TABLE IF NOT EXISTS fact_change_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL REFERENCES approved_facts(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL
    CHECK (change_type IN ('value_changed', 'unit_changed', 'expiry_changed', 'superseded', 'expired', 'archived')),
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'RESOLVED')),
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Prevent double records for the same fact + content item + change type combination
  UNIQUE (fact_id, content_item_id, change_type)
);

CREATE INDEX IF NOT EXISTS idx_fact_change_impacts_org    ON fact_change_impacts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_fact_change_impacts_status ON fact_change_impacts(status);
CREATE INDEX IF NOT EXISTS idx_fact_change_impacts_fact   ON fact_change_impacts(fact_id);

-- 2. clarity_suggestions: rule-based suggestions for guideline / terminology rule wording.
CREATE TABLE IF NOT EXISTS clarity_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  -- Either a guideline or a terminology rule is linked, never both.
  guideline_id UUID REFERENCES brand_guidelines(id) ON DELETE CASCADE,
  terminology_rule_id UUID REFERENCES terminology_rules(id) ON DELETE CASCADE,
  rule_label TEXT NOT NULL,         -- human-readable label: guideline title or disallowed→approved
  findings_count INT NOT NULL DEFAULT 0,
  dismissed_count INT NOT NULL DEFAULT 0,
  challenged_count INT NOT NULL DEFAULT 0,
  reversed_count INT NOT NULL DEFAULT 0,
  suggestion_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACCEPTED', 'REJECTED')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Linked draft guideline note created when accepted
  draft_guideline_id UUID REFERENCES brand_guidelines(id) ON DELETE SET NULL,
  window_start TIMESTAMPTZ NOT NULL,  -- start of the 90-day window this was computed over
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- One open suggestion per rule per 90-day window
  UNIQUE (organisation_id, guideline_id, terminology_rule_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_clarity_suggestions_org    ON clarity_suggestions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_clarity_suggestions_status ON clarity_suggestions(status);
