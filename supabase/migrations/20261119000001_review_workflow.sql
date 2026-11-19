-- Migration: 20261119000001_review_workflow.sql
-- Review workflow database functions for submission, status transition, reviewer assignment, comments, and critical approval block.

-- 1. Function: submit_for_review
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
  v_role TEXT;
  v_audit_status TEXT;
  v_assigned_reviewer UUID;
  v_new_status TEXT;
  v_title TEXT;
BEGIN
  -- Verify content item exists and caller is an org member
  SELECT organisation_id, status, title INTO v_org_id, v_current_status, v_title
  FROM content_items WHERE id = p_content_item_id;

  IF v_org_id IS NULL OR NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Access denied or content item not found';
  END IF;

  -- Verify caller role: only Creator, Brand Manager, or Admin may submit content
  v_role := public.org_role(v_org_id);
  IF v_role NOT IN ('creator', 'brand_manager', 'admin') THEN
    RAISE EXCEPTION 'Access denied: only Creators, Brand Managers, and Admins can submit content for review';
  END IF;

  -- Verify that audit has been run and is COMPLETED
  SELECT a.status INTO v_audit_status
  FROM audits a
  WHERE a.content_item_id = p_content_item_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_audit_status IS NULL OR v_audit_status != 'COMPLETED' THEN
    RAISE EXCEPTION 'Cannot submit for review: audit sequence must be COMPLETED first';
  END IF;

  -- Validate allowed status transition
  -- Valid starting statuses: DRAFT, AUDIT_COMPLETE, REVISION_REQUIRED
  IF v_current_status NOT IN ('DRAFT', 'AUDIT_COMPLETE', 'REVISION_REQUIRED') THEN
    RAISE EXCEPTION 'Invalid status transition: content with status % has already been submitted or completed', v_current_status;
  END IF;

  -- Check if a reviewer is already assigned
  SELECT reviewer_id INTO v_assigned_reviewer
  FROM review_assignments
  WHERE content_item_id = p_content_item_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_assigned_reviewer IS NOT NULL THEN
    v_new_status := 'IN_REVIEW';
  ELSE
    v_new_status := 'READY_FOR_REVIEW';
  END IF;

  -- Update status
  UPDATE content_items
  SET status = v_new_status,
      updated_at = now()
  WHERE id = p_content_item_id;

  -- Append-only activity log
  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    v_org_id, v_user_id, 'submitted_for_review', 'content_item', p_content_item_id::text,
    jsonb_build_object(
      'previous_status', v_current_status,
      'new_status', v_new_status,
      'actor_role', v_role
    )
  );

  -- Create notifications for reviewers / brand managers in organisation
  INSERT INTO notifications (
    organisation_id, user_id, title, message, type, link, is_read
  )
  SELECT 
    v_org_id,
    om.user_id,
    'New Submission Ready for Review',
    'Content "' || COALESCE(v_title, 'Draft') || '" has been submitted for brand review.',
    'SUBMISSION_FOR_REVIEW',
    '/reviews/' || p_content_item_id::text,
    false
  FROM organisation_members om
  WHERE om.organisation_id = v_org_id
    AND om.role IN ('reviewer', 'brand_manager', 'admin')
    AND om.user_id != v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'previous_status', v_current_status
  );
END;
$$;


-- 2. Function: record_approval_decision
-- Server-enforced rule:
-- Rejects approval while any CRITICAL finding is unresolved.
-- Only an Admin may override, with a confirmation checkbox and a reason of at least 15 characters.
-- Writes immutable activity_logs and notifications.
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
  v_creator_id UUID;
  v_title TEXT;
  v_current_version_id UUID;
  v_latest_audit_id UUID;
  v_unresolved_critical_count INT := 0;
  v_new_status TEXT;
  v_decision_id UUID;
BEGIN
  -- 1. Check content item and membership
  SELECT organisation_id, creator_id, title INTO v_org_id, v_creator_id, v_title
  FROM content_items WHERE id = p_content_item_id;

  IF v_org_id IS NULL OR NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Access denied or content item not found';
  END IF;

  -- 2. Verify caller role (reviewer, brand_manager, admin)
  v_role := public.org_role(v_org_id);
  IF v_role NOT IN ('admin', 'brand_manager', 'reviewer') THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to record review decision';
  END IF;

  -- 3. Get latest content version
  SELECT id INTO v_current_version_id
  FROM content_versions
  WHERE content_item_id = p_content_item_id
  ORDER BY version_no DESC
  LIMIT 1;

  -- 4. Evaluate decision
  IF p_decision = 'APPROVED' THEN
    -- Find latest audit for this content item
    SELECT a.id INTO v_latest_audit_id
    FROM audits a
    WHERE a.content_item_id = p_content_item_id
    ORDER BY a.created_at DESC
    LIMIT 1;

    IF v_latest_audit_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_unresolved_critical_count
      FROM audit_findings
      WHERE audit_id = v_latest_audit_id
        AND severity = 'CRITICAL'
        AND is_resolved = false;
    END IF;

    -- CRITICAL FINDING BLOCK
    IF v_unresolved_critical_count > 0 THEN
      -- Only an Admin may override with confirmation and reason >= 15 chars
      IF v_role != 'admin' THEN
        RAISE EXCEPTION 'Approval blocked: content has % unresolved CRITICAL finding(s). Only an Administrator can override critical findings.', v_unresolved_critical_count;
      ELSIF NOT (p_is_override = true AND length(trim(COALESCE(p_override_reason, ''))) >= 15) THEN
        RAISE EXCEPTION 'Approval blocked: content has % unresolved CRITICAL finding(s). Requires admin override confirmation and a reason of at least 15 characters.', v_unresolved_critical_count;
      ELSE
        -- Admin override verified: record immutable override activity log (actor, time, reason)
        INSERT INTO activity_logs (
          organisation_id, actor_id, action, target_type, target_id, details
        ) VALUES (
          v_org_id, v_user_id, 'critical_override', 'content_item', p_content_item_id::text,
          jsonb_build_object(
            'actor_role', 'admin',
            'critical_count', v_unresolved_critical_count,
            'override_reason', trim(p_override_reason),
            'version_id', v_current_version_id,
            'timestamp', now()
          )
        );
      END IF;
    END IF;

    -- Approved items move to APPROVED, then READY_TO_PUBLISH
    v_new_status := 'READY_TO_PUBLISH';

  ELSIF p_decision = 'REJECTED' THEN
    IF length(trim(COALESCE(p_reason, ''))) < 5 THEN
      RAISE EXCEPTION 'A documented reason is required to reject content.';
    END IF;
    v_new_status := 'REJECTED';

  ELSIF p_decision = 'REVISION_REQUESTED' THEN
    IF length(trim(COALESCE(p_reason, ''))) < 5 THEN
      RAISE EXCEPTION 'A documented reason is required to request changes.';
    END IF;
    v_new_status := 'REVISION_REQUIRED';

  ELSE
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  -- 5. Insert immutable approval decision
  INSERT INTO approval_decisions (
    organisation_id, content_item_id, content_version_id, decider_id,
    decision, reason, is_override, override_reason
  ) VALUES (
    v_org_id, p_content_item_id, v_current_version_id, v_user_id,
    p_decision, trim(COALESCE(p_reason, '')), p_is_override, p_override_reason
  ) RETURNING id INTO v_decision_id;

  -- 6. Update content item status
  UPDATE content_items
  SET status = v_new_status,
      updated_at = now()
  WHERE id = p_content_item_id;

  -- 7. Insert standard activity log
  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    v_org_id, v_user_id, 'decision_recorded', 'content_item', p_content_item_id::text,
    jsonb_build_object(
      'decision', p_decision,
      'status', v_new_status,
      'is_override', p_is_override,
      'decision_id', v_decision_id,
      'reason', trim(COALESCE(p_reason, ''))
    )
  );

  -- 8. Notify the creator
  IF v_creator_id IS NOT NULL AND v_creator_id != v_user_id THEN
    INSERT INTO notifications (
      organisation_id, user_id, title, message, type, link, is_read
    ) VALUES (
      v_org_id,
      v_creator_id,
      CASE 
        WHEN p_decision = 'APPROVED' THEN 'Content Approved for Publication'
        WHEN p_decision = 'REJECTED' THEN 'Content Rejected by Reviewer'
        ELSE 'Changes Requested on Submission'
      END,
      'Your submission "' || COALESCE(v_title, 'Draft') || '" was marked ' || p_decision || 
      CASE WHEN p_is_override THEN ' (Admin Override).' ELSE '.' END ||
      CASE WHEN length(trim(COALESCE(p_reason, ''))) > 0 THEN ' Reason: ' || trim(p_reason) ELSE '' END,
      'REVIEW_DECISION',
      '/reviews/' || p_content_item_id::text,
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'decision_id', v_decision_id,
    'status', v_new_status,
    'is_override', p_is_override
  );
END;
$$;


-- 3. Function: assign_reviewer
CREATE OR REPLACE FUNCTION public.assign_reviewer(
  p_content_item_id UUID,
  p_reviewer_id UUID,
  p_notes TEXT DEFAULT NULL
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
  v_reviewer_role TEXT;
  v_title TEXT;
  v_assignment_id UUID;
BEGIN
  -- Verify content item and caller membership
  SELECT organisation_id, title INTO v_org_id, v_title
  FROM content_items WHERE id = p_content_item_id;

  IF v_org_id IS NULL OR NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Access denied or content item not found';
  END IF;

  -- Caller role must be brand_manager or admin
  v_role := public.org_role(v_org_id);
  IF v_role NOT IN ('admin', 'brand_manager') THEN
    RAISE EXCEPTION 'Access denied: only Brand Managers and Admins can assign reviewers';
  END IF;

  -- Verify target reviewer is a qualified member in this organisation
  SELECT role INTO v_reviewer_role
  FROM organisation_members
  WHERE organisation_id = v_org_id AND user_id = p_reviewer_id;

  IF v_reviewer_role IS NULL OR v_reviewer_role NOT IN ('reviewer', 'brand_manager', 'admin') THEN
    RAISE EXCEPTION 'Target user is not a qualified reviewer in this organisation';
  END IF;

  -- Upsert review assignment
  INSERT INTO review_assignments (
    organisation_id, content_item_id, assigned_by, reviewer_id, status, notes
  ) VALUES (
    v_org_id, p_content_item_id, v_user_id, p_reviewer_id, 'IN_REVIEW', p_notes
  )
  RETURNING id INTO v_assignment_id;

  -- Update content item status to IN_REVIEW if currently READY_FOR_REVIEW
  UPDATE content_items
  SET status = 'IN_REVIEW',
      updated_at = now()
  WHERE id = p_content_item_id
    AND status IN ('READY_FOR_REVIEW', 'DRAFT', 'AUDIT_COMPLETE');

  -- Log activity
  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    v_org_id, v_user_id, 'reviewer_assigned', 'content_item', p_content_item_id::text,
    jsonb_build_object(
      'reviewer_id', p_reviewer_id,
      'assignment_id', v_assignment_id
    )
  );

  -- Notify the assigned reviewer
  INSERT INTO notifications (
    organisation_id, user_id, title, message, type, link, is_read
  ) VALUES (
    v_org_id,
    p_reviewer_id,
    'New Review Assignment',
    'You have been assigned to review brand compliance on "' || COALESCE(v_title, 'Draft') || '".',
    'REVIEW_ASSIGNED',
    '/reviews/' || p_content_item_id::text,
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'status', 'IN_REVIEW'
  );
END;
$$;


-- 4. Function: add_review_comment
CREATE OR REPLACE FUNCTION public.add_review_comment(
  p_content_item_id UUID,
  p_comment TEXT,
  p_finding_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_creator_id UUID;
  v_assigned_reviewer UUID;
  v_comment_id UUID;
  v_title TEXT;
BEGIN
  -- Verify content item and membership
  SELECT organisation_id, creator_id, title INTO v_org_id, v_creator_id, v_title
  FROM content_items WHERE id = p_content_item_id;

  IF v_org_id IS NULL OR NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Access denied or content item not found';
  END IF;

  IF length(trim(COALESCE(p_comment, ''))) < 1 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  -- Insert comment
  INSERT INTO review_comments (
    organisation_id, content_item_id, author_id, finding_id, comment
  ) VALUES (
    v_org_id, p_content_item_id, v_user_id, p_finding_id, trim(p_comment)
  ) RETURNING id INTO v_comment_id;

  -- Insert activity log
  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    v_org_id, v_user_id, 'review_comment_added', 'content_item', p_content_item_id::text,
    jsonb_build_object(
      'comment_id', v_comment_id,
      'finding_id', p_finding_id
    )
  );

  -- Notify assigned reviewer or creator if comment was made by the other party
  SELECT reviewer_id INTO v_assigned_reviewer
  FROM review_assignments
  WHERE content_item_id = p_content_item_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_creator_id IS NOT NULL AND v_creator_id != v_user_id THEN
    INSERT INTO notifications (
      organisation_id, user_id, title, message, type, link, is_read
    ) VALUES (
      v_org_id,
      v_creator_id,
      'New Comment on Submission',
      'A review comment was posted on "' || COALESCE(v_title, 'Draft') || '".',
      'REVIEW_COMMENT',
      '/reviews/' || p_content_item_id::text,
      false
    );
  END IF;

  IF v_assigned_reviewer IS NOT NULL AND v_assigned_reviewer != v_user_id THEN
    INSERT INTO notifications (
      organisation_id, user_id, title, message, type, link, is_read
    ) VALUES (
      v_org_id,
      v_assigned_reviewer,
      'New Comment on Submission',
      'A comment was posted on assigned review "' || COALESCE(v_title, 'Draft') || '".',
      'REVIEW_COMMENT',
      '/reviews/' || p_content_item_id::text,
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'comment_id', v_comment_id
  );
END;
$$;


-- 5. Function: resolve_audit_finding
CREATE OR REPLACE FUNCTION public.resolve_audit_finding(
  p_finding_id UUID,
  p_is_resolved BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_audit_id UUID;
  v_role TEXT;
BEGIN
  SELECT organisation_id, audit_id INTO v_org_id, v_audit_id
  FROM audit_findings WHERE id = p_finding_id;

  IF v_org_id IS NULL OR NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Finding not found or access denied';
  END IF;

  v_role := public.org_role(v_org_id);
  IF v_role NOT IN ('reviewer', 'brand_manager', 'admin') THEN
    RAISE EXCEPTION 'Access denied: only reviewers, brand managers, and admins can mark findings resolved';
  END IF;

  UPDATE audit_findings
  SET is_resolved = p_is_resolved
  WHERE id = p_finding_id;

  INSERT INTO activity_logs (
    organisation_id, actor_id, action, target_type, target_id, details
  ) VALUES (
    v_org_id, v_user_id, 'finding_resolved', 'audit_finding', p_finding_id::text,
    jsonb_build_object(
      'is_resolved', p_is_resolved,
      'audit_id', v_audit_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'finding_id', p_finding_id,
    'is_resolved', p_is_resolved
  );
END;
$$;
