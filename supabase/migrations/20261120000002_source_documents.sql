-- =========================================================================
-- Source Documents Migration
-- Additive only: adds source_documents, document_candidates tables;
-- extends approved_facts with document provenance fields.
-- =========================================================================

-- 1. Source Documents table
CREATE TABLE IF NOT EXISTS source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  category TEXT NOT NULL DEFAULT 'General',
  owner TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  extracted_text TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  expiry_date TIMESTAMPTZ,
  last_verified_date TIMESTAMPTZ,
  page_count INT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_documents_org ON source_documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_source_documents_status ON source_documents(status);

-- 2. Document Candidates (rule-based extraction proposals)
CREATE TABLE IF NOT EXISTS document_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  value TEXT NOT NULL,
  numeric_value NUMERIC,
  unit TEXT,
  excerpt TEXT NOT NULL,
  page_number INT,
  review_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_fact_id UUID REFERENCES approved_facts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_candidates_doc ON document_candidates(document_id);
CREATE INDEX IF NOT EXISTS idx_document_candidates_status ON document_candidates(review_status);

-- 3. Extend approved_facts with document provenance (additive only)
ALTER TABLE approved_facts
  ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES source_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_document_version TEXT,
  ADD COLUMN IF NOT EXISTS source_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS source_page INT;
