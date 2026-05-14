## 2024-05-14 - Skip Redundant TMDB Find API Call
**Learning:** The Cinemeta API response for movies often includes `moviedb_id` inside its `meta` object.
**Action:** By passing this ID directly to the `checkTmdb` function, we can skip the `/3/find/tt...` API call to TMDB entirely, removing a network round-trip from the critical path and saving around ~100ms of latency per uncached stream request, while preserving functionality by keeping the old behavior as a fallback.
## 2024-05-14 - Skip Redundant TMDB Find API Call
**Learning:** The Cinemeta API response for movies often includes `moviedb_id` inside its `meta` object.
**Action:** By passing this ID directly to the `checkTmdb` function, we can skip the `/3/find/tt...` API call to TMDB entirely, removing a network round-trip from the critical path and saving around ~100ms of latency per uncached stream request, while preserving functionality by keeping the old behavior as a fallback.

## 2024-05-14 - Skip Redundant TMDB Find API Call
**Learning:** The Cinemeta API response for movies often includes `moviedb_id` inside its `meta` object.
**Action:** By passing this ID directly to the `checkTmdb` function, we can skip the `/3/find/tt...` API call to TMDB entirely, removing a network round-trip from the critical path and saving around ~100ms of latency per uncached stream request, while preserving functionality by keeping the old behavior as a fallback.
