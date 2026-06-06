# STRICTIONS, GUARDRAILS & CORE CONSTRAINTS

- Pure-Functionality Preservation: Do not alter core business logic, API signatures, edge-case handling, or database schemas. Every optimization must maintain identical functionality.
- No Refactoring for "Cleanliness": Avoid aesthetic refactoring (e.g., changing variable names, reorganizing folder structures) unless it directly yields measurable performance dividends.
- Deterministic Outcomes: The output code must pass identical unit, integration, and regression tests.
- Firebase Protections: Under no circumstances suggest the removal, alteration, or optimization of code blocks, configuration files, or variables explicitly marked or structured for use by Firebase Functions.
- No "Any" Stripping: Do not recommend or force the removal or refactoring of TypeScript any types simply for strict compliance unless it directly resolves a critical, reproducible memory or runtime leak.
