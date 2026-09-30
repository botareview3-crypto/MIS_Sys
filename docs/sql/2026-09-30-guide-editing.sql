-- Run ONCE against the production database (e.g. Render Postgres -> Shell / psql)
-- before using "Edit guide" in the app. Safe to re-run.
CREATE TABLE IF NOT EXISTS guide_contents (
  guide      VARCHAR(30) PRIMARY KEY,
  steps      JSONB       NOT NULL,
  updated_at TIMESTAMP   NOT NULL DEFAULT now(),
  updated_by INTEGER
);

CREATE TABLE IF NOT EXISTS guide_images (
  id         SERIAL PRIMARY KEY,
  mime_type  VARCHAR(50) NOT NULL,
  image_data TEXT        NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT now()
);
