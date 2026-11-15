-- PROOFLOOM Functions, RLS, Immutability Triggers, and Storage Setup
-- Numbered Migration: 20261115000002_functions_and_rls.sql

-- Helper function: is_org_member
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
      AND user_id = auth.uid()
  );
$$;

-- Helper function: org_role
CREATE OR REPLACE FUNCTION public.org_role(check_org_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.organisation_members
  WHERE organisation_id = check_org_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

-- Immutability enforcement trigger function
CREATE OR REPLACE FUNCTION public.prevent_update_or_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is immutable. UPDATE and DELETE operations are prohibited.', TG_TABLE_NAME;
END;
$$;

-- Apply immutability triggers
DROP TRIGGER IF EXISTS trg_immutable_content_versions ON content_versions;
CREATE TRIGGER trg_immutable_content_versions
BEFORE UPDATE OR DELETE ON content_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_update_or_delete();

DROP TRIGGER IF EXISTS trg_immutable_approval_decisions ON approval_decisions;
CREATE TRIGGER trg_immutable_approval_decisions
BEFORE UPDATE OR DELETE ON approval_decisions
FOR EACH ROW EXECUTE FUNCTION public.prevent_update_or_delete();

DROP TRIGGER IF EXISTS trg_immutable_challenge_decisions ON challenge_decisions;
CREATE TRIGGER trg_immutable_challenge_decisions
BEFORE UPDATE OR DELETE ON challenge_decisions
FOR EACH ROW EXECUTE FUNCTION public.prevent_update_or_delete();

DROP TRIGGER IF EXISTS trg_immutable_activity_logs ON activity_logs;
CREATE TRIGGER trg_immutable_activity_logs
BEFORE UPDATE OR DELETE ON activity_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_update_or_delete();

-- ----------------------------------------------------
-- Enable RLS on every table
-- ----------------------------------------------------
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminology_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- RLS Policies
-- ----------------------------------------------------

-- Profiles
CREATE POLICY "Profiles are readable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles can be inserted for auth user"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Organisations
CREATE POLICY "Org members can view organisation"
  ON organisations FOR SELECT
  TO authenticated
  USING (public.is_org_member(id));

CREATE POLICY "Admins can update organisation"
  ON organisations FOR UPDATE
  TO authenticated
  USING (public.org_role(id) = 'admin')
  WITH CHECK (public.org_role(id) = 'admin');

-- Organisation Members
CREATE POLICY "Org members can view other members"
  ON organisation_members FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Admins can manage organisation members"
  ON organisation_members FOR ALL
  TO authenticated
  USING (public.org_role(organisation_id) = 'admin')
  WITH CHECK (public.org_role(organisation_id) = 'admin');

-- Content Items
CREATE POLICY "Org members can view content items"
  ON content_items FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organisation_id) AND (
      public.org_role(organisation_id) IN ('admin', 'brand_manager')
      OR creator_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM review_assignments ra
        WHERE ra.content_item_id = content_items.id AND ra.reviewer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Creators and above can insert content"
  ON content_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organisation_id) AND
    public.org_role(organisation_id) IN ('admin', 'brand_manager', 'creator')
  );

CREATE POLICY "Creators and above can update content"
  ON content_items FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(organisation_id) AND (
      public.org_role(organisation_id) IN ('admin', 'brand_manager')
      OR creator_id = auth.uid()
    )
  );

-- Content Versions
CREATE POLICY "Org members can view content versions"
  ON content_versions FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Creators and managers can insert content versions"
  ON content_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organisation_id) AND
    public.org_role(organisation_id) IN ('admin', 'brand_manager', 'creator')
  );

-- Content Attachments
CREATE POLICY "Org members can view attachments"
  ON content_attachments FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Creators and managers can insert attachments"
  ON content_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organisation_id) AND
    public.org_role(organisation_id) IN ('admin', 'brand_manager', 'creator')
  );

-- Audits & Stages
CREATE POLICY "Org members can view audits"
  ON audits FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can insert audits"
  ON audits FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY "Org members can update audits"
  ON audits FOR UPDATE
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can view audit stages"
  ON audit_stages FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_stages.audit_id AND public.is_org_member(a.organisation_id)));

CREATE POLICY "Org members can manage audit stages"
  ON audit_stages FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_stages.audit_id AND public.is_org_member(a.organisation_id)));

-- Extracted Claims, Evidence Matches, Audit Findings
CREATE POLICY "Org members can view claims"
  ON extracted_claims FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can insert claims"
  ON extracted_claims FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY "Org members can update claims"
  ON extracted_claims FOR UPDATE
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can view evidence matches"
  ON evidence_matches FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can insert evidence matches"
  ON evidence_matches FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY "Org members can view findings"
  ON audit_findings FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can insert findings"
  ON audit_findings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY "Org members can update findings"
  ON audit_findings FOR UPDATE
  TO authenticated
  USING (public.is_org_member(organisation_id));

-- Evidence Sources & Approved Facts (Read by all members, managed by admin/brand_manager)
CREATE POLICY "Org members can view evidence sources"
  ON evidence_sources FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Brand managers and admins can manage evidence sources"
  ON evidence_sources FOR ALL
  TO authenticated
  USING (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'))
  WITH CHECK (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'));

CREATE POLICY "Org members can view approved facts"
  ON approved_facts FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Brand managers and admins can manage approved facts"
  ON approved_facts FOR ALL
  TO authenticated
  USING (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'))
  WITH CHECK (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'));

-- Brand Guidelines, Terminology Rules, Approved Assets
CREATE POLICY "Org members can view brand guidelines"
  ON brand_guidelines FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Brand managers and admins can manage brand guidelines"
  ON brand_guidelines FOR ALL
  TO authenticated
  USING (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'))
  WITH CHECK (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'));

CREATE POLICY "Org members can view terminology rules"
  ON terminology_rules FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Brand managers and admins can manage terminology rules"
  ON terminology_rules FOR ALL
  TO authenticated
  USING (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'))
  WITH CHECK (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'));

CREATE POLICY "Org members can view approved assets"
  ON approved_assets FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Brand managers and admins can manage approved assets"
  ON approved_assets FOR ALL
  TO authenticated
  USING (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'))
  WITH CHECK (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'));

-- Review Assignments & Comments
CREATE POLICY "Org members can view review assignments"
  ON review_assignments FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Managers and admins can manage review assignments"
  ON review_assignments FOR ALL
  TO authenticated
  USING (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'))
  WITH CHECK (public.is_org_member(organisation_id) AND public.org_role(organisation_id) IN ('admin', 'brand_manager'));

CREATE POLICY "Org members can view review comments"
  ON review_comments FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can insert review comments"
  ON review_comments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

-- Approval Decisions (Immutable)
CREATE POLICY "Org members can view approval decisions"
  ON approval_decisions FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Reviewers, managers, and admins can insert approval decisions"
  ON approval_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organisation_id) AND
    public.org_role(organisation_id) IN ('admin', 'brand_manager', 'reviewer')
  );

-- Finding Challenges & Challenge Decisions
CREATE POLICY "Org members can view finding challenges"
  ON finding_challenges FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can insert finding challenges"
  ON finding_challenges FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY "Org members can update finding challenges"
  ON finding_challenges FOR UPDATE
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can view challenge decisions"
  ON challenge_decisions FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Reviewers, managers, and admins can insert challenge decisions"
  ON challenge_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organisation_id) AND
    public.org_role(organisation_id) IN ('admin', 'brand_manager', 'reviewer')
  );

-- Notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Activity Logs (Immutable)
CREATE POLICY "Org members can view activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Org members can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

-- Drift Insights
CREATE POLICY "Org members can view drift insights"
  ON drift_insights FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

-- Organisation Settings
CREATE POLICY "Org members can view organisation settings"
  ON organisation_settings FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "Admins can update organisation settings"
  ON organisation_settings FOR UPDATE
  TO authenticated
  USING (public.is_org_member(organisation_id) AND public.org_role(organisation_id) = 'admin')
  WITH CHECK (public.is_org_member(organisation_id) AND public.org_role(organisation_id) = 'admin');

-- Rate Limits
CREATE POLICY "Users can manage their rate limits"
  ON rate_limits FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------
-- Stored Procedures / RPC Functions (Section 6.3)
-- ----------------------------------------------------

-- Function: create_content_with_version
CREATE OR REPLACE FUNCTION public.create_content_with_version(
  p_org_id UUID,
  p_title TEXT,
  p_content_type TEXT,
  p_platform TEXT,
  p_audience TEXT,
  p_department TEXT,
  p_campaign_context TEXT,
  p_objective TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_content_id UUID;
  v_version_id UUID;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Access denied: not an organisation member';
  END IF;

  INSERT INTO content_items (
    organisation_id, creator_id, title, content_type, platform,
    audience, department, campaign_context, objective, status, current_version_no
  ) VALUES (
    p_org_id, v_user_id, p_title, p_content_type, p_platform,
    p_audience, p_department, p_campaign_context, p_objective, 'DRAFT', 1
  ) RETURNING id INTO v_content_id;

  INSERT INTO content_versions (
    organisation_id, content_item_id, version_no, body, source, created_by, change_summary
  ) VALUES (
    p_org_id, v_content_id, 1, p_body, 'original', v_user_id, 'Initial submission'
  ) RETURNING id INTO v_version_id;

  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    p_org_id, v_user_id, 'content_created', 'content_item', v_content_id::text,
    jsonb_build_object('title', p_title, 'version_no', 1)
  );

  RETURN jsonb_build_object('content_item_id', v_content_id, 'version_id', v_version_id);
END;
$$;

-- Function: accept_rewrite
CREATE OR REPLACE FUNCTION public.accept_rewrite(
  p_content_item_id UUID,
  p_finding_id UUID,
  p_new_body TEXT,
  p_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_next_version_no INT;
  v_new_version_id UUID;
BEGIN
  SELECT organisation_id INTO v_org_id FROM content_items WHERE id = p_content_item_id;
  IF v_org_id IS NULL OR NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Access denied or content item not found';
  END IF;

  SELECT COALESCE(MAX(version_no), 0) + 1 INTO v_next_version_no
  FROM content_versions
  WHERE content_item_id = p_content_item_id;

  INSERT INTO content_versions (
    organisation_id, content_item_id, version_no, body, source, created_by, change_summary
  ) VALUES (
    v_org_id, p_content_item_id, v_next_version_no, p_new_body, 'ai_rewrite', v_user_id, p_summary
  ) RETURNING id INTO v_new_version_id;

  UPDATE content_items
  SET current_version_no = v_next_version_no,
      updated_at = now()
  WHERE id = p_content_item_id;

  IF p_finding_id IS NOT NULL THEN
    UPDATE audit_findings
    SET is_resolved = true,
        resolved_by_version_id = v_new_version_id
    WHERE id = p_finding_id;
  END IF;

  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    v_org_id, v_user_id, 'rewrite_accepted', 'content_item', p_content_item_id::text,
    jsonb_build_object('version_no', v_next_version_no, 'finding_id', p_finding_id, 'summary', p_summary)
  );

  RETURN jsonb_build_object('content_item_id', p_content_item_id, 'version_id', v_new_version_id, 'version_no', v_next_version_no);
END;
$$;

-- Function: submit_for_review
CREATE OR REPLACE FUNCTION public.submit_for_review(
  p_content_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_current_status TEXT;
BEGIN
  SELECT organisation_id, status INTO v_org_id, v_current_status
  FROM content_items WHERE id = p_content_item_id;

  IF v_org_id IS NULL OR NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Access denied or content item not found';
  END IF;

  UPDATE content_items
  SET status = 'READY_FOR_REVIEW',
      updated_at = now()
  WHERE id = p_content_item_id;

  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    v_org_id, v_user_id, 'submitted_for_review', 'content_item', p_content_item_id::text,
    jsonb_build_object('previous_status', v_current_status)
  );

  RETURN jsonb_build_object('status', 'READY_FOR_REVIEW');
END;
$$;

-- Function: record_approval_decision
-- Server-enforced rule: Reject approval if unresolved CRITICAL findings exist,
-- unless caller is admin with override=true and reason >= 15 chars.
CREATE OR REPLACE FUNCTION public.record_approval_decision(
  p_content_item_id UUID,
  p_decision TEXT, -- 'APPROVED', 'REJECTED', 'REVISION_REQUESTED'
  p_reason TEXT,
  p_is_override BOOLEAN DEFAULT false,
  p_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_role TEXT;
  v_current_version_id UUID;
  v_latest_audit_id UUID;
  v_unresolved_critical_count INT := 0;
  v_new_status TEXT;
  v_decision_id UUID;
BEGIN
  SELECT organisation_id INTO v_org_id FROM content_items WHERE id = p_content_item_id;
  IF v_org_id IS NULL OR NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Access denied or content item not found';
  END IF;

  v_role := public.org_role(v_org_id);
  IF v_role NOT IN ('admin', 'brand_manager', 'reviewer') THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to record review decision';
  END IF;

  -- Get latest content version
  SELECT id INTO v_current_version_id
  FROM content_versions
  WHERE content_item_id = p_content_item_id
  ORDER BY version_no DESC
  LIMIT 1;

  -- If approving, check for unresolved CRITICAL findings on the latest audit for this version
  IF p_decision = 'APPROVED' THEN
    SELECT a.id INTO v_latest_audit_id
    FROM audits a
    WHERE a.content_version_id = v_current_version_id
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF v_latest_audit_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_unresolved_critical_count
      FROM audit_findings
      WHERE audit_id = v_latest_audit_id
        AND severity = 'CRITICAL'
        AND is_resolved = false;
    END IF;

    IF v_unresolved_critical_count > 0 THEN
      IF NOT (v_role = 'admin' AND p_is_override = true AND length(trim(COALESCE(p_override_reason, ''))) >= 15) THEN
        RAISE EXCEPTION 'Approval blocked: content has % unresolved CRITICAL finding(s). Requires admin override with a valid reason (>= 15 characters).', v_unresolved_critical_count;
      ELSE
        -- Admin override verified: record immutable override activity log
        INSERT INTO activity_logs (
          organisation_id, actor_id, action, target_type, target_id, details
        ) VALUES (
          v_org_id, v_user_id, 'critical_override', 'content_item', p_content_item_id::text,
          jsonb_build_object(
            'critical_count', v_unresolved_critical_count,
            'override_reason', p_override_reason,
            'version_id', v_current_version_id
          )
        );
      END IF;
    END IF;

    v_new_status := 'APPROVED';
  ELSIF p_decision = 'REJECTED' THEN
    v_new_status := 'REJECTED';
  ELSIF p_decision = 'REVISION_REQUESTED' THEN
    v_new_status := 'REVISION_REQUIRED';
  ELSE
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  -- Insert immutable approval decision
  INSERT INTO approval_decisions (
    organisation_id, content_item_id, content_version_id, decider_id,
    decision, reason, is_override, override_reason
  ) VALUES (
    v_org_id, p_content_item_id, v_current_version_id, v_user_id,
    p_decision, p_reason, p_is_override, p_override_reason
  ) RETURNING id INTO v_decision_id;

  -- Update content item status
  UPDATE content_items
  SET status = v_new_status,
      updated_at = now()
  WHERE id = p_content_item_id;

  -- Insert standard activity log
  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    v_org_id, v_user_id, 'decision_recorded', 'content_item', p_content_item_id::text,
    jsonb_build_object(
      'decision', p_decision,
      'status', v_new_status,
      'is_override', p_is_override,
      'decision_id', v_decision_id
    )
  );

  RETURN jsonb_build_object(
    'decision_id', v_decision_id,
    'status', v_new_status,
    'is_override', p_is_override
  );
END;
$$;

-- ----------------------------------------------------
-- Storage Buckets & Policies (Section 6.4)
-- ----------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('content-uploads', 'content-uploads', false),
  ('knowledge-docs', 'knowledge-docs', false),
  ('brand-assets', 'brand-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated org members to read/write within their org prefix
CREATE POLICY "Authenticated members can read org bucket objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('content-uploads', 'knowledge-docs', 'brand-assets')
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Authenticated members can upload org bucket objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('content-uploads', 'knowledge-docs', 'brand-assets')
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );
