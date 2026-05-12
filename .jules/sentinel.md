## 2024-05-11 - Unbounded Cache DoS and Input Validation Risks
**Vulnerability:** The application used an unbounded `Map()` for caching streaming metadata, allowing an attacker to quickly exhaust server memory by querying non-existent or random IDs (Cache Exhaustion DoS). The `id` from URL params was also unvalidated before being appended to the upstream `v3-cinemeta.strem.io` API, presenting a Server-Side Request Forgery (SSRF) risk.
**Learning:** Naive in-memory caches without TTL cleanup checks per-request or eviction policies (LRU/FIFO) are a massive vulnerability for external-facing web apps. Even though the cache used TTLs via expiration objects, standard `Map` does not automatically purge old records until they are explicitly checked/deleted on next retrieval. Additionally, URL parameters injected into external axios requests without validation or sanitization are highly prone to injection vulnerabilities.
**Prevention:** Bound in-memory structures by overriding the `set` logic or using libraries like `lru-cache`. Always perform whitelist-style validation for URL parameters (`^tt\d+$`) before relying on them to construct API calls, and encode API key/ID values defensively (`encodeURIComponent`).

## 2026-05-12 - ReDoS Vulnerability in Title Matcher
**Vulnerability:** Regular Expression Denial of Service (ReDoS) in `safeSuffixes` regex inside `isTitleMatch`.
**Learning:** The regex `/^(blooper|bloopers|outtake|outtakes|extra|extras|and|or|with|scene|scenes|credit|credits|stinger|stingers|review|reviews|post|mid|after|end|during|the|is|a|an|there|are|movie|film|\s)+$/` suffers from catastrophic backtracking due to overlapping alternative groups and the trailing `+`. The repeated string test `"blooper ".repeat(30) + "X"` shows exponential time growth, exposing the service to DoS attacks.
**Prevention:** Avoid unbounded quantifiers (`+`, `*`) on alternation groups containing overlapping elements or generic whitespaces. Use strict string splitting or non-backtracking patterns for simple word matching.

## 2024-05-12 - Cross-Site Scripting (XSS) via innerHTML
**Vulnerability:** A potential XSS vulnerability existed in `index.html` where UI updates used `previewText.innerHTML` to inject DOM elements (such as `<br>`) mixed with variables.
**Learning:** Even if the string components are currently hardcoded, `innerHTML` is inherently unsafe and a risky pattern for inserting data into the DOM. If any of those string components ever incorporated user input in the future, it would result in a direct cross-site scripting attack.
**Prevention:** Use safe DOM manipulation APIs like `textContent` and `document.createElement()` instead of assigning strings directly to `innerHTML`.
