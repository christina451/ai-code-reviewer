-- Enable the pgcrypto extension for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS reviews (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      TEXT        NOT NULL,
  language      TEXT        NOT NULL,
  line_count    INTEGER     NOT NULL,
  -- Full AnalysisResult JSON. Stored as JSONB so Postgres parses it on
  -- insert and returns it already-parsed on select — no JSON.parse needed.
  analysis_result JSONB     NOT NULL,
  -- Accumulated LLM output. NULL while status = 'pending'.
  review_text   TEXT,
  -- 'pending' → streaming in progress
  -- 'complete' → review_text is populated
  -- 'error'    → error_message is populated
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'complete', 'error')),
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- Most common query: list recent reviews ordered by creation time.
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews (created_at DESC);

-- Secondary: filter by filename for the history page.
CREATE INDEX IF NOT EXISTS reviews_filename_idx ON reviews (filename);