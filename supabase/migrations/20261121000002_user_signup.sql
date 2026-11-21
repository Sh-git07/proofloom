-- Migration: 20261121000002_user_signup.sql
-- Description: Server-side Postgres function for real-email sign-up and sample brand data loader

-- 1. Function to create organisation, admin membership, settings, and activity log for the calling user
CREATE OR REPLACE FUNCTION public.create_user_organisation(
  p_full_name TEXT,
  p_org_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_base_slug TEXT;
  v_slug TEXT;
  v_org_id UUID;
  v_clean_name TEXT;
  v_clean_full_name TEXT;
BEGIN
  -- Strict caller verification: only the authenticated user can create their own org
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create an organisation.';
  END IF;

  v_clean_name := trim(p_org_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Organisation name must be at least 2 characters.';
  END IF;

  v_clean_full_name := trim(p_full_name);
  IF v_clean_full_name IS NULL OR length(v_clean_full_name) < 2 THEN
    v_clean_full_name := 'Platform Admin';
  END IF;

  -- Obtain user's email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Ensure profile exists and is updated
  INSERT INTO public.profiles (id, email, full_name, onboarding)
  VALUES (
    v_user_id,
    COALESCE(v_email, ''),
    v_clean_full_name,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name;

  -- Generate unique slug
  v_base_slug := lower(regexp_replace(regexp_replace(v_clean_name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  IF v_base_slug IS NULL OR length(v_base_slug) = 0 THEN
    v_base_slug := 'org';
  END IF;

  v_slug := v_base_slug;
  IF EXISTS (SELECT 1 FROM public.organisations WHERE slug = v_slug) THEN
    v_slug := v_base_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  END IF;

  -- Create organisation (always is_demo = false)
  INSERT INTO public.organisations (name, slug, is_demo)
  VALUES (v_clean_name, v_slug, false)
  RETURNING id INTO v_org_id;

  -- Assign user as admin
  INSERT INTO public.organisation_members (organisation_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'admin');

  -- Create default organisation settings
  INSERT INTO public.organisation_settings (organisation_id)
  VALUES (v_org_id)
  ON CONFLICT (organisation_id) DO NOTHING;

  -- Record activity log entry
  INSERT INTO public.activity_logs (
    organisation_id,
    actor_id,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    v_org_id,
    v_user_id,
    'ORGANISATION_CREATED',
    'organisation',
    v_org_id::text,
    jsonb_build_object(
      'name', v_clean_name,
      'slug', v_slug,
      'created_by', v_user_id
    )
  );

  RETURN jsonb_build_object(
    'organisation_id', v_org_id,
    'name', v_clean_name,
    'slug', v_slug,
    'role', 'admin'
  );
END;
$$;

-- 2. Function to load sample brand data into a specific organisation (only callable by its members)
CREATE OR REPLACE FUNCTION public.load_sample_brand_data(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_member BOOLEAN;
  v_existing_facts INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Verify caller belongs to the target organisation
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE organisation_id = p_org_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Access denied: caller does not belong to this organisation.';
  END IF;

  -- Check if facts already exist
  SELECT count(*) INTO v_existing_facts FROM public.approved_facts WHERE organisation_id = p_org_id;
  IF v_existing_facts > 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Organisation already has brand data.');
  END IF;

  -- 1. Voice guideline
  INSERT INTO public.brand_guidelines (
    organisation_id,
    title,
    category,
    version,
    status,
    tone_attributes,
    rules,
    prohibited_terms,
    is_demo
  ) VALUES (
    p_org_id,
    'Core Brand Voice & Archetype',
    'voice',
    '1.0',
    'published',
    '["Clear", "Confident", "Evidence-based", "Empathetic"]'::jsonb,
    '[{"rule": "Use evidence-based assertions rather than hyperbolic hype.", "dimension": "voice"}]'::jsonb,
    '["game-changer", "revolutionary", "destroy the competition"]'::jsonb,
    false
  );

  -- 2. 18% pilot fact
  INSERT INTO public.approved_facts (
    organisation_id,
    name,
    value,
    numeric_value,
    unit,
    metric,
    description,
    approval_status,
    owner,
    verified_at,
    expires_at,
    is_demo
  ) VALUES (
    p_org_id,
    'Task Completion Pilot Improvement',
    '18%',
    18,
    '%',
    'efficiency',
    'In an internal pilot, teams saw an 18% improvement in task completion time.',
    'APPROVED',
    'Product Marketing',
    now(),
    now() + interval '1 year',
    false
  );

  -- 3. Customer-count fact
  INSERT INTO public.approved_facts (
    organisation_id,
    name,
    value,
    numeric_value,
    unit,
    metric,
    description,
    approval_status,
    owner,
    verified_at,
    expires_at,
    is_demo
  ) VALUES (
    p_org_id,
    'Active Business Customer Benchmark',
    '10,000 businesses',
    10000,
    'businesses',
    'customer_count',
    'Over 10,000 businesses actively rely on Proofloom for commercial brand governance.',
    'APPROVED',
    'Corporate Communications',
    now(),
    now() + interval '1 year',
    false
  );

  -- 4. Terminology rules & mandatory disclaimer
  INSERT INTO public.terminology_rules (
    organisation_id,
    disallowed_term,
    approved_term,
    context,
    required_disclaimer,
    is_demo
  ) VALUES
  (
    p_org_id,
    'destroy the competition',
    'outperform industry benchmarks',
    'Combat-oriented language violates corporate communication standards.',
    NULL,
    false
  ),
  (
    p_org_id,
    'crush inefficiency',
    'streamline workflows',
    'Prefer constructive operational terms over aggressive phrasing.',
    NULL,
    false
  ),
  (
    p_org_id,
    '100% bug-free',
    'enterprise-grade reliability',
    'Absolute perfection claims cannot be substantiated empirically.',
    NULL,
    false
  ),
  (
    p_org_id,
    'unconditional performance',
    'measured productivity',
    'Whenever citing internal pilot efficiency numbers, include the mandatory pilot disclaimer.',
    'Results based on an internal pilot; individual results may vary.',
    false
  );

  -- Log action
  INSERT INTO public.activity_logs (
    organisation_id,
    actor_id,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    p_org_id,
    v_user_id,
    'SAMPLE_DATA_LOADED',
    'organisation',
    p_org_id::text,
    jsonb_build_object('loaded_by', v_user_id)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Sample brand data loaded successfully.');
END;
$$;
