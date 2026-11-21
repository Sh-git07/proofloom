-- Migration: 20261121000001_onboarding.sql
-- Description: Add onboarding jsonb to profiles table and shell/checklist helper functions

-- 1. Add onboarding column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Shell RPC: return current user profile including onboarding
CREATE OR REPLACE FUNCTION public.get_app_shell_context()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'department', p.department,
    'onboarding', COALESCE(p.onboarding, '{}'::jsonb)
  ) INTO v_result
  FROM public.profiles p
  WHERE p.id = v_user_id;

  RETURN v_result;
END;
$$;

-- 3. Overview checklist RPC: compute completion status for the current user's role
CREATE OR REPLACE FUNCTION public.get_overview_checklist(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_audits_count INT := 0;
  v_rewrites_count INT := 0;
  v_submissions_count INT := 0;
  v_verified_claims_count INT := 0;
  v_facts_count INT := 0;
  v_docs_count INT := 0;
  v_drift_count INT := 0;
  v_resolved_findings INT := 0;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb);
  END IF;

  -- Determine user role in organisation
  SELECT role INTO v_role
  FROM public.organisation_members
  WHERE organisation_id = p_org_id AND user_id = v_user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    v_role := 'creator';
  END IF;

  -- Gather counts from stored data
  SELECT count(*) INTO v_audits_count FROM public.audits WHERE organisation_id = p_org_id;
  SELECT count(*) INTO v_rewrites_count FROM public.activity_logs WHERE organisation_id = p_org_id AND (action ILIKE '%REWRITE%' OR action ILIKE '%rewrite%');
  SELECT count(*) INTO v_submissions_count FROM public.activity_logs WHERE organisation_id = p_org_id AND (action ILIKE '%SUBMIT%' OR action ILIKE '%REVIEW%');
  SELECT count(*) INTO v_verified_claims_count FROM public.extracted_claims WHERE organisation_id = p_org_id AND verification_status = 'VERIFIED';
  SELECT count(*) INTO v_facts_count FROM public.approved_facts WHERE organisation_id = p_org_id;
  SELECT count(*) INTO v_docs_count FROM public.source_documents WHERE organisation_id = p_org_id;
  SELECT count(*) INTO v_drift_count FROM public.drift_insights WHERE organisation_id = p_org_id;
  SELECT count(*) INTO v_resolved_findings FROM public.audit_findings WHERE organisation_id = p_org_id AND is_resolved = true;

  v_result := jsonb_build_object(
    'role', v_role,
    'audits_count', v_audits_count,
    'rewrites_count', v_rewrites_count,
    'submissions_count', v_submissions_count,
    'verified_claims_count', v_verified_claims_count,
    'facts_count', v_facts_count,
    'docs_count', v_docs_count,
    'drift_count', v_drift_count,
    'resolved_findings', v_resolved_findings
  );

  RETURN v_result;
END;
$$;
