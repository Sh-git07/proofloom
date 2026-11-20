-- =========================================================================
-- Visual Brand Consistency Checks Migration
-- Additive only: Adds status, perceptual_hash, and colour_palette to approved_assets;
-- adds image_storage_path and image_alt_text to content_versions;
-- adds content_version_id to content_attachments.
-- =========================================================================

-- 1. Extend approved_assets for visual verification
ALTER TABLE approved_assets
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('current', 'superseded', 'expired')) DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS perceptual_hash TEXT,
  ADD COLUMN IF NOT EXISTS colour_palette JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS file_size_bytes INT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Create index for perceptual hash lookup
CREATE INDEX IF NOT EXISTS idx_approved_assets_hash ON approved_assets(perceptual_hash) WHERE perceptual_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approved_assets_status ON approved_assets(status);

-- 2. Extend content_versions for image linkage
ALTER TABLE content_versions
  ADD COLUMN IF NOT EXISTS image_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS image_alt_text TEXT,
  ADD COLUMN IF NOT EXISTS image_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS image_file_size INT;

-- 3. Extend content_attachments to associate with specific content_versions
ALTER TABLE content_attachments
  ADD COLUMN IF NOT EXISTS content_version_id UUID REFERENCES content_versions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_content_attachments_version ON content_attachments(content_version_id);
