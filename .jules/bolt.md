## 2024-05-14 - Skip Redundant TMDB Find API Call
**Learning:** The Cinemeta API response for movies often includes `moviedb_id` inside its `meta` object.
**Action:** By passing this ID directly to the `checkTmdb` function, we can skip the `/3/find/tt...` API call to TMDB entirely, removing a network round-trip from the critical path and saving around ~100ms of latency per uncached stream request, while preserving functionality by keeping the old behavior as a fallback.

## 2026-05-14 - Consolidate Multiple Array Iterations
**Learning:** Sequential calls to `Array.prototype.some()` or `find()` on the same array result in multiple traversals.
**Action:** Consolidate multiple boolean checks into a single `for...of` loop with early exit to reduce CPU time and improve performance on large arrays or high-frequency code paths.
