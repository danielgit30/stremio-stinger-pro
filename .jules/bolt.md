## 2024-05-11 - Node.js Concurrent Await Optimization
**Learning:** For a Node.js scraper app that cascades multiple HTTP fetch tasks, using `await a(); await b();` introduces cumulative latency and causes requests to wait sequentially. By starting all requests simultaneously (`const pa = a(); const pb = b();`), and then `await`ing them in priority order, you can drastically reduce the "tail latency" while maintaining priority cascading logic.
**Action:** Use concurrent Promise initialization before awaiting sequentially when prioritizing cascade-style network requests.
