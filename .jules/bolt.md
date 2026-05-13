## 2024-05-24 - Optimizing RegExp evaluations in scraping routines
**Learning:** In highly repetitive scraping tasks (like iterating over rows or matching large blocks of text), using `String.prototype.match()` just to check for the presence of a pattern creates unnecessary overhead because it constructs array objects. Furthermore, compiling regex within tight loops is costly.
**Action:** Always prefer `RegExp.prototype.test()` over `.match()` when you only need a boolean response. Pre-compile `RegExp` objects outside of iteration blocks to avoid compiling the same pattern repeatedly.
## 2024-05-19 - The Criticality of Connection Pooling in Aggregators
**Learning:** In a multi-tiered aggregator architecture that fires concurrent HTTP requests (e.g., `checkAfterCredits`, `checkMediaStinger`, `checkTmdb`), establishing new TCP/TLS connections for every single request creates severe tail latency bottlenecks (almost halving the throughput). The `stremio-stinger-pro` app was previously not pooling connections for Axios, leading to >600ms times just for setting up the parallel handshakes.
**Action:** When working on Node.js apps that frequently poll external services, always verify that `http.Agent` and `https.Agent` are instantiated with `{ keepAlive: true }` and passed to the HTTP client (like Axios) to enable connection reuse.
## 2024-05-12 - Regex Pre-compilation Optimization
**Learning:** Pre-compiling regexes used in loops or frequently avoids redundant instantiation and compilation in JavaScript, which can measurably improve performance in hot code paths.
**Action:** Always move static regex patterns out of loops or frequently called functions to the top-level scope as constants.
## 2024-05-12 - Extracted Target Title String Cleaning from Inner Loop
**Learning:** String operations such as regex replacements and trimming can be expensive when executed in a tight loop. Refactoring code to lift constant computations out of a loop body drastically improves execution time. In this case, cleaning the target title inside the `isTitleMatch` function meant it was re-cleaned repeatedly during `.each` loops traversing scraped links.
**Action:** When comparing a dynamically iterated list against a static value, pre-process and normalize the static value outside the loop so that the function acting inside the loop does fewer redundant string computations.

## 2024-05-13 - Extracted Set Instantiation in isTitleMatch
**Learning:** Instantiating a `Set` on every function call inside a loop iterating over DOM elements is a noticeable performance hit.
**Action:** Always move `Set` or `RegExp` declarations and their helper functions to the outer module scope to ensure they are created only once and reused across all function invocations.
