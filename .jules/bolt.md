## 2026-05-16 - Fix Cache Stampede in Wikipedia Scraper
 **Learning:** I learned that async operations like Wikipedia scraping in a multi-tiered aggregator can suffer from cache stampedes if they are not guarded correctly. When a single cached entry expires, multiple concurrent requests for the same piece of information could trigger a thundering herd problem.
 **Action:** By tracking the `Promise` of an inflight data fetch operation and immediately returning that Promise to concurrent callers, we prevent cache stampedes effectively.
## 2024-05-16 - Cheerio loop early break
 **Learning:** In Cheerio's `.each()` loop, iterating over all matches when only the first one is needed causes unnecessary execution time, particularly in scraping loops where performance is critical. Returning `false` short-circuits the loop.
 **Action:** Always review Cheerio and jQuery-style `.each()` iterations to verify whether all elements must be traversed. Apply `return false;` when subsequent matches are irrelevant to improve throughput and save CPU cycles.
