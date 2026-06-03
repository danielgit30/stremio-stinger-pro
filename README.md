# Stremio Stinger Pro

## Version 2.5.0

![logo](/icon.png)

Stremio Stinger Pro is a high-speed, high-fidelity Stremio addon that detects mid-credit scenes, post-credit scenes, outtakes, and sequel setups. It integrates directly into your stream list with customizable display configurations.

`https://stremio-addons.net/addons/stremio-stinger-pro`

## Latest Optimizations

- **Massive Server-Side Optimization:** Fully sanitized the codebase to eliminate unused dead code.
- **Memory Optimization:** Implemented bounded LRU cache limits (`MAX_CACHE_SIZE = 5000`) and request coalescing limits (1000 maximum active requests) to guarantee protection against exhaustion DoS.
- **Network Egress Optimization:** Brought in `compression` middleware and `keepAlive` Axios agents for HTTP/HTTPS to minimize payloads and latency.
- **Aggressive Caching Strategy:** Introduced `stale-while-revalidate=3600` for public stream responses to offload traffic seamlessly.

---

## Table of Contents

- [⚙️ What It Does](#️-key-features)
- [📡 Data Sources](#-data-sources)
- [⛏️ Core Scraping Logic](#%EF%B8%8F-core-scraping-logic)
- [🌍 Configuration and Installation](#-configuration-and-installation)
- [🚀 Development](#-development)

[Latest Release: v2.5.0](#release-v250)
> [!TIP]
> This release introduces massive server-side optimization including compression and memory guards!

---

## ⚙️ Key Features

- **High-Fidelity Logic:** Queries sources concurrently but follows a priority for results based on the reliability of the source. Resolves instantly the millisecond the highest-priority stinger is confirmed.
- **Outtake Detection:** Automatically distinguishes between narrative stingers and outtake reels. Outtake and blooper flagging is optional and can be configured.
- **Sequel Setup Detection:** Adds the ability to identify and display if a movie sets up a sequel, utilizing metadata directly from AfterCredits. Optional and configurable.
- **Wikipedia Indexing:** Utilizes an auto-updating, O(1) in-memory index of Wikipedia's post-credit database to instantly catch obscure films if primary scrapers fail.
- **Dual Display Modes:** Choose between "Colorful" (emoji-based visual flags) or "Simple" (clean text output).
- **Interactive Configuration:** A web-based `/configure` portal allows users to toggle blooper tracking, hide/show data sources, input custom TMDB API keys, and view a live preview of the stream output.
- **Configuration-Aware Caching:** Stream results are cached efficiently based on your exact URL parameters, preventing conflicting data across different user preferences.

## 📡 Data Sources

The addon queries the following databases simultaneously and posts the best result based on the below priority.

1. **AfterCredits.com**
2. **The Movie Database (TMDB)**
3. **Wikipedia**

> [!NOTE]
>
> - TMDB is configured to use a community API key by default, but users can provide a personal v3 API key for dedicated rate limits.
> - Wikipedia doesn't classify after-credit scenes as mid- or post-credits scenes explicitly and relies on regex. You may see some results tagged as **"Unclassified Scene"**.

## ⛏️ Core Scraping Logic

Executes all scrapers concurrently to drastically reduce tail latency. If a higher priority scraper finds a definitive result, the AbortController in the final block will cancel the pending lower-priority requests.

```javascript
        // Await them in priority order, so we can short-circuit
            let acResult = await pAc;
            if (acResult && acResult.definitive) {
                finalResult = acResult;
                console.log(`[Stream] Definitive state found by AfterCredits. Aborting others...`);
                controller.abort();
            } else {
                updateFallback(acResult);

                let tmdbResult = await pTmdb;
                    if (tmdbResult && tmdbResult.definitive) {
                        finalResult = tmdbResult;
                        console.log(`[Stream] Definitive state found by TMDB. Aborting others...`);
                        controller.abort();
                    } else {
                        updateFallback(tmdbResult);

                        let wikiResult = await pWiki;
                        if (wikiResult && wikiResult.definitive) {
                            finalResult = wikiResult;
                            console.log(`[Stream] Definitive state found by Wikipedia.`);
                        } else {
                            updateFallback(wikiResult);
```

## 🌍 Configuration and Installation

1. Navigate to `https://stremio-stinger-pro.onrender.com/configure`
2. Select your preferred display style (Colorful or Simple).
3. Toggle the checkboxes to include/exclude source attribution and bloopers.
4. (Optional) Enter your personal TMDB API key.
5. Click **Install** to open Stremio and add the configuration, or copy the generated Manifest URL to add it manually.

> [!CAUTION]
> Using the community TMDB key could lead to rate limiting.

## 🚀 Development

### Tech Stack

- **Node.js / Express:** Core server framework.
- **Axios:** HTTP client for API and HTML fetching.
- **Cheerio:** High-speed DOM parsing for web scraping.

### Deployment

- **Hosting:** Deployed via a continuous Node.js container on Render (Free Tier).
- **Keep-Alive:** The server is maintained in an active state via scheduled Cronjobs to prevent cold-start delays.

### Maintenance

- **Jules:** Jules is connected to this repository to constantly improve the code and UX of the addon.

---

## Release: v2.5.0

- **Feature:** Massive server-side architecture optimization.
- **Performance:** Implemented bounded LRU caching (max size 5000) and request coalescing to prevent OOM crashes and resolve concurrent request spikes.
- **Performance:** Added `compression` middleware, aggressive `Cache-Control` headers (`stale-while-revalidate`), and HTTP keep-alive agents to drastically reduce network egress and latency.
- **Maintenance:** Conducted a definitive codebase sanitization, completely removing legacy/dead code and minimizing redundant operations.

## Release: v2.1.0

- **Feature:** Removed MediaStinger scraper completely as the source website has shut down.
- **Performance:** Tightened global scraper timeout from 35s to 10s and network request timeout to 15s to drastically improve worst-case latency.

## Release: v2.0.5

- **Feature:** Optimized TMDB scraper by utilizing `moviedb_id` from Cinemeta.
- **Performance:** Reduced network latency by ~100ms by skipping redundant TMDB API lookups.

## Release: v2.0.1

- **Fix:** Refactored deeply nested promise resolution logic.
- **Fix:** Added CORS protection to fix infinite loading on LG and Samsung TVs.
- **Fix:** Improved code readability and maintainability.

## Release: v2.0.0

- **Feature:** Added sequel setup detection configuration option, which works specifically when the source is AfterCredits.
- **Feature:** Added dynamic updating preview for sequel setup configuration in the configuration portal.
- **Fix:** Fixed boolean flags to integrate the `sequel` data across all scraping strategies.

## Release: v1.7.0

- **Feature:** Significant rewrite of scraping and fallback logic - tuned for accuracy over speed. Should properly match more titles.
- **Feature:** Tweaked the abort condition to improve speed of the new logic without compromising on accuracy.
- **Feature:** Improved parsing of Wikipedia entries. If a scene is explicity tagged, it should show mid- or post-credits properly instead of always showing unknown scene.
- **Fix:** Inreased timeout to accommodate new logic.
- **Fix:** Implemented focus styles over pop-up in configuration page for less friction.
- **Fix:** TMDB API key is now an environment variable.

## Release: v1.6.5

- **Feature:** Added more preview options.
- **Fix:** Redefined core scraping and fallback logic.

## Release: v1.6.0

- **Feature:** Added configuration checkboxes to toggle the detection of Bloopers/Outtakes (-bloopers).
- **Feature:** Added Wikipedia's "List of films with post-credits scenes" as a new data source. It uses a blazing-fast O(1) in-memory indexer that pre-compiles every 24 hours, acting as a highly efficient fallback for post-credit detection without slowing down the server.
- **Feature:** Updated the high-speed "Positive-First" promise racing architecture to resolve instantly upon finding a true stinger, but safely holds Blooper/Outtake data as a fallback while waiting for slower sources to finish.
- **Feature:** The internal streamCache now generates composite keys based on the user's specific URL suffix (e.g., tt0120812_colorful-bloopers). This prevents users with different settings from polluting each other's cache.
- **Feature:** Added strict Cache-Control HTTP headers (max-age=0, no-cache) to the /stream/ endpoints. This forces the Stremio client to pull fresh data immediately when users update their configuration URL, bypassing Stremio's aggressive local caching.
- **Fix:** Decoupled bloopers from mid-credit scenes. If a blooper reel or outtake is detected by any scraper, the "Mid-Credits" flag is forcefully stripped to prevent outtakes from masquerading as narrative stingers.
- **Fix:** Fixed lexical matching bugs that caused false negatives for movies with leading/trailing articles or punctuation (e.g., The Cannonball Run vs Cannonball Run, The).
- **Fix:** Fixed a logical fallacy where the addon assumed a lack of TMDB keywords meant a movie definitely had no stinger. TMDB is now correctly treated as a positive-tag-only database.

## Release: v1.5.0

- **Feature:** Added a dropdown to the /configure portal allowing users to select their preferred stream display style:
- **Feature:** Added a dynamic preview container to the /configure portal that instantly updates to show exactly how the stream will look in Stremio based on selected settings.
- **Feature:** Added a checkbox option allowing users to hide or show the data source attribution (e.g., "Source: TMDB") in the Stremio UI.
- **Fix:** Implemented a backward-compatible URL "style suffix" architecture (-nosource) to pass boolean toggle states to the server without breaking existing client API integrations or routing layers.
- **Fix:** Removed hardcoded UI strings from the scraping functions. Scrapers now return strict, raw boolean states (mid, post, no).
- **Fix:** The streamHandler now interpolates the final output string at runtime based on the user's requested display style.
- **Fix:** Updated the in-memory streamCache to store the raw boolean objects rather than pre-compiled strings, preventing cross-configuration memory leakage between "simple" and "colorful" users.
- **Fix:** Expanded Express routes to dynamically handle compound parameters (/:style/:apiKey/manifest.json) alongside legacy URL structures.

## Release: v1.4.0

- **Feature:** Implemented parallel source racing logic to bypass slow target servers.
- **Feature:** Added a fallback community TMDB API key.
- **Feature:** Added an in-memory caching layer (Max: 1000 items, TTL: 6 hours) to prevent OOM crashes and optimize speed.
- **Fix:** Relaxed strict title matching to resolve false negatives on AfterCredits.
- **Fix:** Updated UI stream titles to standard nomenclature for better UX.
