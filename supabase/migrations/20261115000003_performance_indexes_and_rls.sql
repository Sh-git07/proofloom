-- PROOFLOOM Performance Indexes and RLS Optimization
-- Numbered Migration: 20261115000003_performance_indexes_and_rls.sql

-- 1. Optimize Helper Functions with STABLE SECURITY DEFINER and (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE organisation_id = check_org_id
      AND user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.org_role(check_org_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.organisation_members
  WHERE organisation_id = check_org_id
    AND user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

-- 2. Break RLS recursion on organisation_members via SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS TABLE(org_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organisation_id FROM public.organisation_members
  WHERE user_id = (SELECT auth.uid());
$$;

ALTER FUNCTION public.get_user_org_ids() OWNER TO postgres;

DROP POLICY IF EXISTS "Org members can view other members" ON public.organisation_members;
CREATE POLICY "Org members can view other members"
  ON public.organisation_members FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR organisation_id IN (SELECT public.get_user_org_ids())
  );

-- 3. Additional Performance Indexes
-- Content Items & Versions
CREATE INDEX IF NOT EXISTS idx_content_items_org_status ON content_items(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_content_versions_item_version ON content_versions(content_item_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_content_versions_org ON content_versions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_content_attachments_item ON content_attachments(content_item_id);

-- Audits & Findings
CREATE INDEX IF NOT EXISTS idx_audits_content_item ON audits(content_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_org_status ON audits(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_findings_org_resolved ON audit_findings(organisation_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_audit_findings_org_sev_resolved ON audit_findings(organisation_id, severity, is_resolved);
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_resolved ON audit_findings(audit_id, is_resolved);

-- Claims & Evidence
CREATE INDEX IF NOT EXISTS idx_extracted_claims_org_status ON extracted_claims(organisation_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_evidence_matches_claim ON evidence_matches(claim_id);
CREATE INDEX IF NOT EXISTS idx_evidence_matches_source ON evidence_matches(evidence_source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_matches_fact ON evidence_matches(approved_fact_id);
CREATE INDEX IF NOT EXISTS idx_approved_facts_org_status ON approved_facts(organisation_id, approval_status);

-- Reviews, Assignments & Challenges
CREATE INDEX IF NOT EXISTS idx_review_assignments_item ON review_assignments(content_item_id);
CREATE INDEX IF NOT EXISTS idx_review_assignments_reviewer ON review_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_finding_challenges_org_created ON finding_challenges(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finding_challenges_finding ON finding_challenges(finding_id);

-- Drift Insights, Activity Logs, Notifications
CREATE INDEX IF NOT EXISTS idx_drift_insights_org ON drift_insights(organisation_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_target ON activity_logs(organisation_id, target_type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Organisation Settings
CREATE INDEX IF NOT EXISTS idx_org_settings_org ON organisation_settings(organisation_id);
