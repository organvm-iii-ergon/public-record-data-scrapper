// This suite uses isolated unit-test adapters. Database integration tests live
// in database/__tests__ and own real connections and rollback boundaries.
// Global TRUNCATE cleanup cannot isolate immutable audit tables and must never
// run merely because a developer or CI runner has DATABASE_URL configured.
export {}
