/** Atomic fixed-window quota admission on D1's primary database. */
export interface QuotaDatabase {
  prepare(sql: string): {
    bind(...values: unknown[]): { first<T>(): Promise<T | null> }
  }
}

export const ADMIT_QUOTA_SQL = `
  INSERT INTO rate_limit_counters (bucket, window_minute, request_count)
  VALUES (?, ?, 1)
  ON CONFLICT(bucket) DO UPDATE SET
    window_minute = excluded.window_minute,
    request_count = CASE
      WHEN excluded.window_minute > rate_limit_counters.window_minute THEN 1
      ELSE rate_limit_counters.request_count + 1
    END
  WHERE excluded.window_minute > rate_limit_counters.window_minute
     OR (excluded.window_minute = rate_limit_counters.window_minute
         AND rate_limit_counters.request_count < ?)
  RETURNING request_count
`

/** One statement both tests and consumes capacity; no read/modify/write race. */
export async function admitQuota(
  db: QuotaDatabase,
  bucket: string,
  windowMinute: number,
  limit: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (
    typeof bucket !== 'string' ||
    bucket.length === 0 ||
    bucket.length > 256 ||
    !Number.isSafeInteger(windowMinute) ||
    windowMinute < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1
  ) {
    throw new Error('Invalid rate-limit admission parameters')
  }
  const row = await db
    .prepare(ADMIT_QUOTA_SQL)
    .bind(bucket, windowMinute, limit)
    .first<{ request_count: number }>()

  if (row === null) return { allowed: false, remaining: 0 }
  if (
    !Number.isSafeInteger(row.request_count) ||
    row.request_count < 1 ||
    row.request_count > limit
  ) {
    throw new Error('Invalid rate-limit counter result')
  }
  return { allowed: true, remaining: limit - row.request_count }
}
