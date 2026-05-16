## 2024-05-16 - Cheerio loop early break
 **Learning:** In Cheerio's `.each()` loop, iterating over all matches when only the first one is needed causes unnecessary execution time, particularly in scraping loops where performance is critical. Returning `false` short-circuits the loop.
 **Action:** Always review Cheerio and jQuery-style `.each()` iterations to verify whether all elements must be traversed. Apply `return false;` when subsequent matches are irrelevant to improve throughput and save CPU cycles.
