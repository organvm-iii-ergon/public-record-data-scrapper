# Narrative runtime defaults removed

The no-mock requirement extends to generated prose and inferred record fields, not only fixture arrays. NarrativeService previously supplied three years in business, a health score of 50, an intent score of zero, a stable sentiment trend, a revenue confidence of 70, and a star rating calculated from sentiment when no such measurements were recorded.

Those fabricated defaults are removed. Missing health is explicitly described as unavailable; missing business age, rating, default timing, and confidence remain unknown. Recorded zero health is preserved and produces the appropriate low-health risk factor. Health grades use the recorded health score rather than the unrelated prospect priority score. Review counts can appear without an invented star rating. Missing default history no longer creates a recent-default warning.

Validation: three service regression tests pass; changed-file lint passes. A strict server compile on this branch still fails on inherited baseline issues repaired separately in PR #514; it reports no NarrativeService error. This is not a passing full-server receipt, merge receipt, or deployment evidence. The existing broader no-mock evidence and full restoration acceptance requirements remain in force.

The worktree is retained for integration after verification and security repairs. No private records or credentials are included.
