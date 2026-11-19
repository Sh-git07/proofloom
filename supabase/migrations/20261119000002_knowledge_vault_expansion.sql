-- Migration: 20261119000002_knowledge_vault_expansion.sql
-- Expand Brand Knowledge Vault: constraints, columns, disclaimers, and examples

-- 1. approved_facts: add source_citation & support PENDING, REJECTED statuses
ALTER TABLE approved_facts ADD COLUMN IF NOT EXISTS source_citation TEXT;

ALTER TABLE approved_facts DROP CONSTRAINT IF EXISTS approved_facts_approval_status_check;
ALTER TABLE approved_facts ADD CONSTRAINT approved_facts_approval_status_check 
  CHECK (approval_status IN ('DRAFT', 'PENDING', 'PENDING_APPROVAL', 'APPROVED', 'EXPIRED', 'ARCHIVED', 'REJECTED'));

-- 2. terminology_rules: add category, severity, reason
ALTER TABLE terminology_rules ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'brand_standard';
ALTER TABLE terminology_rules ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'MEDIUM';
ALTER TABLE terminology_rules ADD COLUMN IF NOT EXISTS reason TEXT;

-- 3. brand_guidelines: add body, published_at & flexible status check
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE brand_guidelines ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE brand_guidelines DROP CONSTRAINT IF EXISTS brand_guidelines_status_check;
ALTER TABLE brand_guidelines ADD CONSTRAINT brand_guidelines_status_check
  CHECK (LOWER(status) IN ('draft', 'published', 'archived'));

-- 4. brand_disclaimers table
CREATE TABLE IF NOT EXISTS brand_disclaimers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  trigger TEXT NOT NULL,
  disclaimer_text TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE brand_disclaimers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view disclaimers" ON brand_disclaimers;
CREATE POLICY "Org members can view disclaimers"
  ON brand_disclaimers FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "Org members can manage disclaimers" ON brand_disclaimers;
CREATE POLICY "Org members can manage disclaimers"
  ON brand_disclaimers FOR ALL
  TO authenticated
  USING (public.is_org_member(organisation_id));

-- 5. approved_examples table
CREATE TABLE IF NOT EXISTS approved_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  why_it_works TEXT NOT NULL,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE approved_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view examples" ON approved_examples;
CREATE POLICY "Org members can view examples"
  ON approved_examples FOR SELECT
  TO authenticated
  USING (public.is_org_member(organisation_id));

DROP POLICY IF EXISTS "Org members can manage examples" ON approved_examples;
CREATE POLICY "Org members can manage examples"
  ON approved_examples FOR ALL
  TO authenticated
  USING (public.is_org_member(organisation_id));

-- 6. Allow idempotent demo seed cleanup of demo organisations
CREATE OR REPLACE FUNCTION public.prevent_update_or_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_seed_cleanup', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Table % is immutable. UPDATE and DELETE operations are prohibited.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_demo_organisations()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.allow_seed_cleanup', 'on', true);
  DELETE FROM organisations WHERE slug IN ('nova-creative', 'orbit-labs');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

