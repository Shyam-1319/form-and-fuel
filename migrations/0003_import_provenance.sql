ALTER TABLE records ADD COLUMN source_account TEXT;
CREATE INDEX records_source_account ON records(user_id,source_account) WHERE source_account IS NOT NULL;
INSERT INTO schema_version VALUES (3);
