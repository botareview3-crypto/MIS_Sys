-- Alternative to `npm run prisma:outside-push`: paste this into the SQL editor
-- of the Outside Tasks Neon project (NOT the main database).
-- (Already applied to the mis-outside-tasks Neon project on 2026-11-19.)
CREATE TABLE IF NOT EXISTS outside_tasks (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER      NOT NULL,
  user_full_name VARCHAR(150) NOT NULL,
  customer_name  VARCHAR(150) NOT NULL,
  issue          VARCHAR(120) NOT NULL,
  notes          TEXT,
  logged_at      TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS outside_tasks_user_id_logged_at_idx ON outside_tasks (user_id, logged_at);
CREATE INDEX IF NOT EXISTS outside_tasks_logged_at_idx ON outside_tasks (logged_at);
