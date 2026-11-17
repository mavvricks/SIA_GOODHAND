CREATE TABLE IF NOT EXISTS goodhand.auth_throttle(
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_throttle_reset ON goodhand.auth_throttle(reset_at);
