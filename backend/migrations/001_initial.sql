-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

-- Document audit log
CREATE TABLE IF NOT EXISTS document_audit_log (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Document versions
CREATE TABLE IF NOT EXISTS document_versions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  changed_by VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_document_id ON document_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON document_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id ON document_versions(document_id);
