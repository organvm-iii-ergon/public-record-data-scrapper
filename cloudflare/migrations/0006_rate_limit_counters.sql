-- One row per authenticated credential/organization, not per minute.
-- Atomic conditional UPSERTs consume capacity on D1's primary database.
CREATE TABLE rate_limit_counters (
  bucket TEXT PRIMARY KEY,
  window_minute INTEGER NOT NULL CHECK (window_minute >= 0),
  request_count INTEGER NOT NULL CHECK (request_count > 0)
);
