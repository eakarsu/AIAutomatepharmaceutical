-- Fix document_audit_log: add created_at alias column if timestamp column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_audit_log' AND column_name = 'timestamp'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_audit_log' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE document_audit_log ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    UPDATE document_audit_log SET created_at = "timestamp" WHERE created_at IS NULL;
  END IF;
END $$;

-- Add created_at index on audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON document_audit_log(created_at);

-- ai_results table for persisting structured AI outputs
CREATE TABLE IF NOT EXISTS ai_results (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  analysis_type VARCHAR(80) NOT NULL,
  model VARCHAR(120),
  raw_output TEXT,
  parsed_output JSONB,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  user_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_results_document_id ON ai_results(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_results_analysis_type ON ai_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_results_created_at ON ai_results(created_at);

-- Documents index for full-text search across all categories
CREATE INDEX IF NOT EXISTS idx_documents_title_description ON documents USING GIN(to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'')));
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);
