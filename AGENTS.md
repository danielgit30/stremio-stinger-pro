# STRICTIONS, GUARDRAILS & CORE CONSTRAINTS

- Pure-Functionality Preservation: Do not alter core business logic, API signatures, edge-case handling, or database schemas. Every optimization must maintain identical functionality.
- No Refactoring for "Cleanliness": Avoid aesthetic refactoring (e.g., changing variable names, reorganizing folder structures) unless it directly yields measurable performance dividends.
- Deterministic Outcomes: The output code must pass identical unit, integration, and regression tests.
- Firebase Protections: Under no circumstances suggest the removal, alteration, or optimization of code blocks, configuration files, or variables explicitly marked or structured for use by Firebase Functions.
- No "Any" Stripping: Do not recommend or force the removal or refactoring of TypeScript any types simply for strict compliance unless it directly resolves a critical, reproducible memory or runtime leak.

## Discovered Optimizations

- **Second Sweep Results (2026-06-15)**: Swept the codebase for redundancies and resource leaks. Discovered redundant TMDB API `/find` network requests when resolving TMDB ID from IMDb ID in concurrent scraper runs. Also investigated linter warnings for console.error usage, HTML decoding string creation, and nesting levels.
- **Initial Sweep Results (2026-06-10)**: Conducted a thorough sweep of the codebase for Vector A (Sanitization) and Vector B (Runtime & Resource Optimization). No significant inefficiencies, dead code, unused packages, or CPU/Memory bottlenecks were discovered. The codebase is remarkably clean and functions as an enterprise-grade MVP.
- **Potential Edge Cases**: Minor telemetry and connection resilience opportunities were identified (GCP Error Reporting, Redis exponential backoff).

## Previously Suggested

- **[2026-06-15] Phase 2: TMDB ID Resolution Caching**: Suggested adding an in-memory `LRUCache` wrapper for `resolveTmdbIdFromImdb` to prevent duplicate concurrent network queries to the TMDB API.
- **[2026-06-15] Phase 2: Centralized Logger in Config**: Suggested replacing console.error with logger in `src/config.js:26`.
- **[2026-06-15] Phase 2: AfterCredits HTML Decoding Optimization**: Suggested deferring/optimizing `decodeHtmlString` inside WordPress taxonomy loops.
- **[2026-06-15] Phase 2: Nested Code Blocks Flattening**: Suggested restructuring deeply nested logic (5+ levels) in `redis.js`, `wikipedia.js`, `tmdb.js`, `stream.js`, and `aftercredits.js`.
- **[2026-06-10] Phase 1: Google Cloud Error Reporting Integration**: Suggested integrating `@google-cloud/error-reporting` in `src/utils/logger.js` and `src/app.js` to proactively track crashes without manual log digging.
- **[2026-06-10] Phase 1: Redis Connection Resilience**: Suggested implementing exponential backoff for Redis reconnections in `src/cache/redis.js` to prevent database hammering during outages.

## Approved and Implemented

- **[2026-06-15] Phase 2: TMDB ID Resolution Caching**: Implemented a 24-hour LRU cache for TMDB ID queries in `src/scrapers/tmdb.js`, coalescing concurrent requests and caching resolved IDs to prevent redundant requests.
*(None in this sweep)*

## Denied or Not Implemented

- **[2026-06-15] Phase 2: Centralized Logger in Config**: Denied due to high risk of circular dependency and startup failures.
- **[2026-06-15] Phase 2: AfterCredits HTML Decoding Optimization**: Denied due to micro-optimization with zero measurable performance gains on small tag arrays.
- **[2026-06-15] Phase 2: Nested Code Blocks Flattening**: Denied due to purely aesthetic refactoring containing regression risk without performance benefits.
- **[2026-06-10] Phase 1: Google Cloud Error Reporting Integration**: Skipped by user feedback.
- **[2026-06-10] Phase 1: Redis Connection Resilience**: Skipped by user feedback.
