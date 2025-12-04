# Recommendation Persistence Check

## Context
Re-verified whether recommendation sets now persist across rescans instead of regenerating on every scan after the reported fix.

## Findings
- **New scan record per request with no reuse path:** The authenticated scan handler still inserts a fresh `scans` row for every request, then only looks up `user_progress` by that new `scan.id`, so a rescan of the same domain starts with a brand-new scan identifier and cannot reuse an earlier progress record. 【F:backend/routes/scan.js†L275-L295】
- **Recommendations saved against the new scan ID without reuse logic:** After each analysis, the flow unconditionally calls `saveHybridRecommendations` for the current `scan.id`, which inserts a new batch of recommendations; the helper only writes fresh rows and does not check for an existing active set keyed by user/domain or a 5-day window. 【F:backend/routes/scan.js†L388-L409】【F:backend/utils/hybrid-recommendation-helper.js†L52-L140】
- **Refresh/replacement cycles scoped to the new scan ID:** The replacement check fetches progress strictly by `scan_id` and runs the cycle for that `scanId`, so each new scan initializes and uses its own cycle rather than continuing a prior one for the same site. 【F:backend/routes/scan.js†L636-L655】【F:backend/utils/replacement-engine.js†L19-L82】

## Conclusion
The implemented changes do not make recommendation sets persist. Each rescan still creates a new scan record, saves recommendations for that new ID, and runs refresh logic scoped to that ID, so active recommendations reset on every scan instead of persisting for the 5-day window.
