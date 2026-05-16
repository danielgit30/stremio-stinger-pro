## 2026-05-16 - Fix Cache Stampede in Wikipedia Scraper
 **Learning:** I learned that async operations like Wikipedia scraping in a multi-tiered aggregator can suffer from cache stampedes if they are not guarded correctly. When a single cached entry expires, multiple concurrent requests for the same piece of information could trigger a thundering herd problem.
 **Action:** By tracking the `Promise` of an inflight data fetch operation and immediately returning that Promise to concurrent callers, we prevent cache stampedes effectively.
