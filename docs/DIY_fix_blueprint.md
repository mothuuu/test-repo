# DIY Plan Fix Blueprint

This document outlines the design steps to align the DIY plan implementation with the expected user flow, without applying code changes.

## 1) Scan limits double-counting
- **Current behavior:** Scan usage is incremented in `checkScanLimit` middleware and again after scan completion in `backend/routes/scan.js`, causing double counting for both primary and competitor scans.
- **Files/modules to touch:**
  - `backend/middleware/usageLimits.js` (middleware increments and limit checks)
  - `backend/routes/scan.js` (post-scan quota increments and quota checks)
  - Potentially `backend/routes/ai-testing.js` (secondary scan entry point with its own limit logic)
- **Recommended target behavior:** A single source of truth increments usage exactly once per successful scan (primary vs competitor) while enforcing DIY limits of 25 primary scans/month and 2 competitor scans/month.
- **Step-by-step blueprint:**
  1. Centralize quota mutation in a dedicated service (e.g., `usage-tracker`), exposing `reserveScan({ userId, isCompetitor })` and `commitScan()` semantics to prevent double updates.
  2. Remove the increment from `checkScanLimit` and keep it as a read-only guard that attaches plan limits and the pre-scan usage snapshot.
  3. In `backend/routes/scan.js`, after the scan succeeds, call the centralized tracker to increment the correct counter; ensure competitor scans use `competitor_scans_used_this_month` and primary scans use `scans_used_this_month`.
  4. Align `backend/routes/ai-testing.js` to call the same tracker service or shared helper so both routes enforce the same limits.
  5. Add an idempotency guard so failed scans do not increment usage, and reruns after errors reuse the pre-reserved slot if needed.

## 2) Recommendations resetting on every scan (no persistence)
- **Current behavior:** Each scan insertion (`scans` row) generates a fresh recommendation set; `user_progress` and `scan_recommendations` are keyed to the new scan ID, so rescans for the same domain/page set do not reuse the previous active set.
- **Files/modules to touch:**
  - `backend/routes/scan.js` (scan creation and recommendation generation entry point)
  - `backend/services/refresh-cycle-service.js` (cycle metadata per scan)
  - `backend/utils/replacement-engine.js` (replacement logic tied to scan IDs)
- **Recommended target behavior:** Within a 5-day window, rescans of the same user/domain/page set reuse the existing active recommendation pool (up to 5 actives) instead of creating new `scan_recommendations` records.
- **Step-by-step blueprint:**
  1. Define a stable key (e.g., `{user_id, primary_domain, page_set_hash}`) computed from the primary domain and normalized selected pages.
  2. Before creating a new scan row, look up the most recent `scans` record for that key within the last 5 days that has an active refresh cycle; if found, link the new scan to the existing recommendation context.
  3. Reuse the existing `scan_recommendations` active rows and `user_progress` by associating the new scan ID to the prior context (e.g., via a `source_scan_id` column or by avoiding regeneration when a reusable context is found).
  4. Only regenerate recommendations when no active cycle exists for the key or when the 5-day window has elapsed; new recs should seed a new refresh cycle and progress record.
  5. Ensure competitor scans bypass this reuse logic to keep their quotas isolated.

## 3) “Mark as Implemented” missing for users
- **Current behavior:** Skipping is exposed via `POST /api/recommendations/:id/skip`, but user-driven implementation relies on auto-detection; there is no explicit API for a manual “implemented” action that updates status and timestamps.
- **Files/modules to touch:**
  - `backend/routes/recommendations.js` (actions endpoints)
  - `backend/services/refresh-cycle-service.js` (uses `status` and refresh dates to replace implemented/skipped items)
- **Recommended target behavior:** Provide a user-facing endpoint to mark a recommendation as implemented, updating status and timing so the refresh engine can replace it on the next cycle.
- **Step-by-step blueprint:**
  1. Add `POST /api/recommendations/:id/implement` in `backend/routes/recommendations.js` that mirrors the authorization checks in `skip` but sets `status = 'implemented'`, `implemented_at = NOW()`, and `unlock_state = 'active'` (not archived yet).
  2. Update `user_progress` counters to decrement active, increment `recommendations_implemented`, and stamp `last_activity_date`.
  3. Ensure `RefreshCycleService.processRefreshCycle` already filters `status IN ('implemented','skipped')`; confirm new manual status transitions are picked up and archived at the next 5-day cycle.
  4. Add idempotent handling so re-implementing an already implemented item is a no-op with a friendly response.

## 4) 5-day refresh cycle not controlling rescans
- **Current behavior:** The refresh cycle runs via manual endpoint/cron (`RefreshCycleService`) but the normal scan flow generates new recommendation sets per scan without consulting cycle timing, so rescans can reset actives immediately.
- **Files/modules to touch:**
  - `backend/routes/scan.js` (scan execution flow)
  - `backend/services/refresh-cycle-service.js` (cycle timing and replacement)
  - `backend/utils/replacement-engine.js` (existing replacement hook during fetch)
- **Recommended target behavior:** Before generating recommendations during a scan, check the 5-day window for the user/domain/page-set key; reuse actives if <5 days, otherwise invoke refresh-cycle replacement and continue with the existing set.
- **Step-by-step blueprint:**
  1. Insert a pre-scan hook in `backend/routes/scan.js` that queries `recommendation_refresh_cycles` for the active key; if `next_cycle_date` is in the future, reuse the current active recommendations and skip regeneration.
  2. If `next_cycle_date` is due or missing, call `RefreshCycleService.processRefreshCycle` to replace implemented/skipped items, then proceed; only when no cycle exists should a new recommendation set be generated.
  3. Update `replacement-engine` integration so it defers to the new pre-scan check rather than running ad hoc during fetch.
  4. Persist the linking metadata (e.g., `refresh_cycle_id` or `context_key`) so multiple scans within the window map to the same active set and cycle schedule.

## 5) Score updates vs recommendation history
- **Current behavior:** Each scan recalculates scores and writes a new `scans` row, but because recommendations are re-generated per scan, there is no stable mapping to validate that improvements correspond to previously active items.
- **Files/modules to touch:**
  - `backend/routes/scan.js` (score updates and recommendation generation)
  - `backend/services/auto-detection-service.js` (compares current vs previous scans for active recs)
  - `backend/services/refresh-cycle-service.js` (ties replacements to scan IDs)
- **Recommended target behavior:** Continue recalculating scores on every scan while preserving the same active recommendation set during the 5-day window, enabling validation of improvements against stable recommendation IDs.
- **Step-by-step blueprint:**
  1. Use the stable context key (user/domain/page set) to associate each new scan with the existing active recommendation set when within the 5-day window.
  2. Store a `context_id` or `source_scan_id` on new scans so `AutoDetectionService` can compare the current scan’s scores against the scan that seeded the active recommendations, not just the immediately previous scan ID.
  3. When the 5-day refresh runs, archive replaced recommendations but maintain their IDs in a history table linked to the scans that validated their implementation.
  4. Update auto-detection to reference the preserved active set and mark recommendations implemented when score deltas align, keeping the link between score improvements and specific recommendation IDs.

## 6) Elite Mode gating for paid vs free
- **Current behavior:** Mode transitions in `backend/utils/mode-manager.js` depend solely on score thresholds (>=850) without checking plan, so free users can enter Elite; competitor routes also assume Elite mode without plan gating.
- **Files/modules to touch:**
  - `backend/utils/mode-manager.js` (mode transition rules)
  - `backend/routes/scan.js` (current mode lookup before generation)
  - `backend/routes/competitors.js` and any Elite-only routes that rely on `current_mode`
- **Recommended target behavior:** Elite mode activates only for paid plans (DIY and above) when the score is ≥850; free users at ≥850 should stay in optimization mode and receive an upsell prompt.
- **Step-by-step blueprint:**
  1. Add plan awareness to `checkAndUpdateMode` by fetching the user’s plan and gating `targetMode === 'elite'` on `plan !== 'free'` (or an allowlist of paid plans).
  2. When a free user meets the score threshold, keep `targetMode = 'optimization'` and return an `upgrade_required` flag/message so the UI can upsell instead of enabling Elite.
  3. Ensure `backend/routes/scan.js` passes plan info into the mode manager or that the manager queries it directly.
  4. Enforce the same gating in Elite-only routes like `backend/routes/competitors.js`, returning an upsell response if the user is free even when `current_mode` is set to elite.
