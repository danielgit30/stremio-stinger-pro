# STRICTIONS, GUARDRAILS & CORE CONSTRAINTS

- Pure-Functionality Preservation: Do not alter core business logic, API signatures, edge-case handling, or database schemas. Every optimization must maintain identical functionality.
- No Refactoring for "Cleanliness": Avoid aesthetic refactoring (e.g., changing variable names, reorganizing folder structures) unless it directly yields measurable performance dividends.
- Deterministic Outcomes: The output code must pass identical unit, integration, and regression tests.
- Firebase Protections: Under no circumstances suggest the removal, alteration, or optimization of code blocks, configuration files, or variables explicitly marked or structured for use by Firebase Functions.
- No "Any" Stripping: Do not recommend or force the removal or refactoring of TypeScript any types simply for strict compliance unless it directly resolves a critical, reproducible memory or runtime leak.

## Discovered Optimizations
- **Initial Sweep Results (2026-06-10)**: Conducted a thorough sweep of the codebase for Vector A (Sanitization) and Vector B (Runtime & Resource Optimization). No significant inefficiencies, dead code, unused packages, or CPU/Memory bottlenecks were discovered. The codebase is remarkably clean and functions as an enterprise-grade MVP.
- **Potential Edge Cases**: Minor telemetry and connection resilience opportunities were identified (GCP Error Reporting, Redis exponential backoff).

## Previously Suggested
- **[2026-06-10] Phase 1: Google Cloud Error Reporting Integration**: Suggested integrating `@google-cloud/error-reporting` in `src/utils/logger.js` and `src/app.js` to proactively track crashes without manual log digging.
- **[2026-06-10] Phase 1: Redis Connection Resilience**: Suggested implementing exponential backoff for Redis reconnections in `src/cache/redis.js` to prevent database hammering during outages.

## Approved and Implemented
*(None in this sweep)*

## Denied or Not Implemented
- **[2026-06-10] Phase 1: Google Cloud Error Reporting Integration**: Skipped by user feedback.
- **[2026-06-10] Phase 1: Redis Connection Resilience**: Skipped by user feedback.
