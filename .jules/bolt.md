## 2024-05-24 - Optimizing RegExp evaluations in scraping routines
**Learning:** In highly repetitive scraping tasks (like iterating over rows or matching large blocks of text), using `String.prototype.match()` just to check for the presence of a pattern creates unnecessary overhead because it constructs array objects. Furthermore, compiling regex within tight loops is costly.
**Action:** Always prefer `RegExp.prototype.test()` over `.match()` when you only need a boolean response. Pre-compile `RegExp` objects outside of iteration blocks to avoid compiling the same pattern repeatedly.
## 2024-05-19 - The Criticality of Connection Pooling in Aggregators
**Learning:** In a multi-tiered aggregator architecture that fires concurrent HTTP requests (e.g., `checkAfterCredits`, `checkMediaStinger`, `checkTmdb`), establishing new TCP/TLS connections for every single request creates severe tail latency bottlenecks (almost halving the throughput). The `stremio-stinger-pro` app was previously not pooling connections for Axios, leading to >600ms times just for setting up the parallel handshakes.
**Action:** When working on Node.js apps that frequently poll external services, always verify that `http.Agent` and `https.Agent` are instantiated with `{ keepAlive: true }` and passed to the HTTP client (like Axios) to enable connection reuse.
## 2024-05-11 - Cheerio Re-parsing Performance Trap
**Learning:** Instantiating new Cheerio instances `cheerio.load()` within a loop or repeatedly per request to simply extract text from HTML is extremely slow.
**Action:** Use regex `.replace(/<[^>]*>/g, ' ')` to strip HTML tags when we only need raw text for keyword matching, avoiding expensive DOM re-parsing.
