-- PROOFLOOM Initial Schema Migration
-- Numbered Migration: 20261115000001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organisations
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Profiles (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Organisation Members
CREATE TABLE IF NOT EXISTS organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'brand_manager', 'creator', 'reviewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organisation_id, user_id)
);

-- 4. Content Items
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  audience TEXT,
  department TEXT,
  campaign_context TEXT,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'AUDIT_IN_PROGRESS', 'AUDIT_COMPLETE', 'REVISION_REQUIRED', 'READY_FOR_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'READY_TO_PUBLISH')),
  current_version_no INT NOT NULL DEFAULT 1,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Content Versions (Immutable)
CREATE TABLE IF NOT EXISTS content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  version_no INT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('original', 'ai_rewrite', 'manual_edit')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (content_item_id, version_no)
);

-- 6. Content Attachments
CREATE TABLE IF NOT EXISTS content_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  alt_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Audits
CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  content_version_id UUID NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REQUIRES_REVIEW')),
  mode TEXT NOT NULL DEFAULT 'demo' CHECK (mode IN ('live_ai', 'demo')),
  overall_score INT,
  scores JSONB DEFAULT '{}'::jsonb,
  checked_dimensions JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Audit Stages
CREATE TABLE IF NOT EXISTS audit_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  stage_number INT NOT NULL,
  stage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REQUIRES REVIEW')),
  detail TEXT,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Extracted Claims
CREATE TABLE IF NOT EXISTS extracted_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('factual', 'numerical', 'comparative', 'promotional', 'opinion')),
  numeric_value NUMERIC,
  unit TEXT,
  metric TEXT,
  start_offset INT,
  end_offset INT,
  confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  verification_status TEXT NOT NULL DEFAULT 'UNSUPPORTED' CHECK (verification_status IN ('VERIFIED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'OUTDATED', 'HUMAN_VERIFICATION_REQUIRED', 'UNSUPPORTED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Evidence Sources (Documents)
CREATE TABLE IF NOT EXISTS evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  category TEXT NOT NULL,
  owner TEXT,
  approval_status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'EXPIRED', 'ARCHIVED')),
  last_verified_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  storage_path TEXT,
  summary TEXT,
  raw_text TEXT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Approved Facts
CREATE TABLE IF NOT EXISTS approved_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  numeric_value NUMERIC,
  unit TEXT,
  metric TEXT,
  description TEXT,
  source_id UUID REFERENCES evidence_sources(id) ON DELETE SET NULL,
  source_version TEXT,
  approval_status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('DRAFT', 'APPROVED', 'EXPIRED', 'ARCHIVED')),
  owner TEXT,
  verified_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES approved_facts(id) ON DELETE SET NULL,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Evidence Matches
CREATE TABLE IF NOT EXISTS evidence_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES extracted_claims(id) ON DELETE CASCADE,
  approved_fact_id UUID REFERENCES approved_facts(id) ON DELETE SET NULL,
  evidence_source_id UUID REFERENCES evidence_sources(id) ON DELETE SET NULL,
  excerpt TEXT,
  comparison JSONB DEFAULT '{}'::jsonb,
  result TEXT NOT NULL CHECK (result IN ('VERIFIED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'OUTDATED', 'HUMAN_VERIFICATION_REQUIRED', 'UNSUPPORTED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Audit Findings
CREATE TABLE IF NOT EXISTS audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_code TEXT NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('claim_reliability', 'voice', 'terminology', 'accessibility', 'visual')),
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
  excerpt TEXT NOT NULL,
  start_offset INT,
  end_offset INT,
  explanation TEXT NOT NULL,
  guideline_reference TEXT,
  verification_status TEXT,
  recommended_action TEXT NOT NULL,
  suggested_replacement TEXT,
  confidence TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  confidence_note TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by_version_id UUID REFERENCES content_versions(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES extracted_claims(id) ON DELETE SET NULL,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Brand Guidelines
CREATE TABLE IF NOT EXISTS brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'voice',
  version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  tone_attributes JSONB DEFAULT '[]'::jsonb,
  rules JSONB DEFAULT '[]'::jsonb,
  prohibited_terms JSONB DEFAULT '[]'::jsonb,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Terminology Rules
CREATE TABLE IF NOT EXISTS terminology_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  disallowed_term TEXT NOT NULL,
  approved_term TEXT NOT NULL,
  context TEXT,
  case_sensitive BOOLEAN DEFAULT false,
  required_disclaimer TEXT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Approved Assets
CREATE TABLE IF NOT EXISTS approved_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  storage_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Review Assignments
CREATE TABLE IF NOT EXISTS review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_REVIEW', 'COMPLETED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 18. Review Comments
CREATE TABLE IF NOT EXISTS review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  finding_id UUID REFERENCES audit_findings(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. Approval Decisions (Immutable)
CREATE TABLE IF NOT EXISTS approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  content_version_id UUID NOT NULL REFERENCES content_versions(id) ON DELETE CASCADE,
  decider_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED', 'REVISION_REQUESTED')),
  reason TEXT,
  is_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 20. Finding Challenges
CREATE TABLE IF NOT EXISTS finding_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
  challenger_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  context TEXT,
  attachment_path TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DECIDED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 21. Challenge Decisions (Immutable)
CREATE TABLE IF NOT EXISTS challenge_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES finding_challenges(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  decider_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('UPHOLD', 'REVERSE', 'ACCEPT_AS_EXCEPTION', 'REQUEST_EVIDENCE', 'PROPOSE_GUIDELINE_CHANGE')),
  rationale TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 22. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 23. Activity Logs (Immutable)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 24. Drift Insights
CREATE TABLE IF NOT EXISTS drift_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  frequency INT DEFAULT 1,
  affected_departments JSONB DEFAULT '[]'::jsonb,
  recommendation TEXT,
  is_seeded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 25. Organisation Settings
CREATE TABLE IF NOT EXISTS organisation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID UNIQUE NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ai_external_allowed BOOLEAN DEFAULT true,
  scoring_weights JSONB DEFAULT '{"voice": 25, "claims": 35, "terminology": 20, "accessibility": 10, "visual": 10}'::jsonb,
  scoring_deductions JSONB DEFAULT '{"CRITICAL": 25, "HIGH": 15, "MEDIUM": 8, "LOW": 3, "INFO": 0}'::jsonb,
  claim_tolerance_percentage NUMERIC DEFAULT 5.0,
  retention_days INT DEFAULT 365,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 26. Rate Limits
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, bucket, window_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organisation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_content_items_org_created ON content_items(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_audits_org_created ON audits(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_version ON audits(content_version_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_sev ON audit_findings(audit_id, severity);
CREATE INDEX IF NOT EXISTS idx_extracted_claims_audit ON extracted_claims(audit_id);
CREATE INDEX IF NOT EXISTS idx_evidence_matches_audit ON evidence_matches(audit_id);
CREATE INDEX IF NOT EXISTS idx_evidence_sources_org ON evidence_sources(organisation_id);
CREATE INDEX IF NOT EXISTS idx_approved_facts_org ON approved_facts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created ON activity_logs(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
