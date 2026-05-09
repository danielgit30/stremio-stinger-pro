![logo](/icon.png)

# Stremio Stinger Pro
**Version 1.6.0**

Stremio Stinger Pro is a high-performance metadata addon for Stremio. It automates the detection of mid-credits and post-credits scenes for feature films, providing users with immediate, actionable advice on whether to stay seated or if it is safe to stop playback.

`https://stremio-addons.net/addons/stremio-stinger-pro`

## Upcoming Features
- [ ] Nothing for now.

---

## Table of Contents
* [⚙️ How It Works (Under the Hood)](#️-how-it-works-under-the-hood)
* [📡 Data Sources](#-data-sources)
* [🌍 Configuration and Installation](#-configuration-and-installation)
* [🚀 Deployment Details](#-deployment-details)

[Latest Release: v1.6.0](#release-v160)

---

## ⚙️ How It Works (Under the Hood)
Unlike traditional sequential web scrapers, Version 1.3+ utilizes a custom parallel execution architecture designed for maximum speed and accuracy.

* **Parallel Source Racing:** When a movie is selected, the addon simultaneously queries three different databases. It uses "Positive-First" race logic: the moment any source confirms a bonus scene, it immediately resolves and delivers the result to Stremio. If a source reports "No Scene", it waits for the remaining sources to finish verifying before officially declaring the movie clear.
* **Fuzzy Title Matching:** The scraping engine dynamically cleans string inputs, stripping punctuation and handling edge cases like appended release years to ensure high match rates across crowdsourced databases.
* **In-Memory Caching:** Successful queries are written to a localized server cache with a 6-hour Time-To-Live (TTL). Repeated requests for popular movies bypass the scraping engines entirely, resulting in near-instant load times.
* **Smart Fallbacks:** If all automated sources fail to find a definitive answer, the addon dynamically generates a manual search link to AfterCredits for the specific movie title.

## 📡 Data Sources
The addon queries the following databases simultaneously. Results are prioritized based on the fidelity of the data provided:

1. **AfterCredits.com:** Primary source. Provides explicit confirmation of mid/post-credit scenes via direct web scraping.
2. **MediaStinger.com:** Secondary source. Provides binary yes/no confirmations.
3. **The Movie Database (TMDB):** Tertiary source. Scans movie metadata for specific stinger keywords (`duringcreditsstinger`, `aftercreditsstinger`). The addon utilizes a community API key by default, but users can provide a personal v3 API key for dedicated rate limits.
4. **Wikipedia:** Ultimate fallback. Built a lightning-fast, auto-updating Wikipedia index. If the primary scrapers can't find info on an obscure movie, the Wikipedia fallback kicks in instantly as a final safety net. Wikipedia doesn't classify post-credit scenes as mid- or post-credits scenes and hence results from Wikipedia will be called out exclusively.

## 🌍 Configuration and Installation
The addon can be installed directly or configured with a personal TMDB API key to ensure stability if the community key reaches its rate limit.

**Configuration Portal:**
`https://stremio-stinger-pro.onrender.com/configure`

## 🚀 Deployment Details
* **Hosting:** Deployed via a continuous Node.js container on Render (Free Tier).
* **Keep-Alive:** The server is maintained in an active state via scheduled Cronjobs to prevent cold-start delays.

---

## Release: v1.6.0
* **Feature:** Added configuration checkboxes to toggle the detection of Bloopers/Outtakes (-bloopers).
* **Feature:** Added Wikipedia's "List of films with post-credits scenes" as a new data source. It uses a blazing-fast O(1) in-memory indexer that pre-compiles every 24 hours, acting as a highly efficient fallback for post-credit detection without slowing down the server.
* **Feature:** Updated the high-speed "Positive-First" promise racing architecture to resolve instantly upon finding a true stinger, but safely holds Blooper/Outtake data as a fallback while waiting for slower sources to finish.
* **Feature:** The internal streamCache now generates composite keys based on the user's specific URL suffix (e.g., tt0120812_colorful-bloopers). This prevents users with different settings from polluting each other's cache.
* **Feature:** Added strict Cache-Control HTTP headers (max-age=0, no-cache) to the /stream/ endpoints. This forces the Stremio client to pull fresh data immediately when users update their configuration URL, bypassing Stremio's aggressive local caching.
* **Fix:** Decoupled bloopers from mid-credit scenes. If a blooper reel or outtake is detected by any scraper, the "Mid-Credits" flag is forcefully stripped to prevent outtakes from masquerading as narrative stingers.
* **Fix:** Upgraded the MediaStinger scraper to navigate to the actual movie payload page (Tier 2) rather than relying on the search page. This stops MediaStinger from blindly flagging blooper reels as "During Credits" scenes.
* **Fix:** Fixed lexical matching bugs that caused false negatives for movies with leading/trailing articles or punctuation (e.g., The Cannonball Run vs Cannonball Run, The).
* **Fix:** Fixed a logical fallacy where the addon assumed a lack of TMDB keywords meant a movie definitely had no stinger. TMDB is now correctly treated as a positive-tag-only database.

---

## Release: v1.5.0
* **Feature:** Added a dropdown to the /configure portal allowing users to select their preferred stream display style:
* **Feature:** Added a dynamic preview container to the /configure portal that instantly updates to show exactly how the stream will look in Stremio based on selected settings.
* **Feature:** Added a checkbox option allowing users to hide or show the data source attribution (e.g., "Source: TMDB") in the Stremio UI.
* **Fix:** Implemented a backward-compatible URL "style suffix" architecture (-nosource) to pass boolean toggle states to the server without breaking existing client API integrations or routing layers.
* **Fix:** Removed hardcoded UI strings from the scraping functions. Scrapers now return strict, raw boolean states (mid, post, no).
* **Fix:** The streamHandler now interpolates the final output string at runtime based on the user's requested display style.
* **Fix:** Updated the in-memory streamCache to store the raw boolean objects rather than pre-compiled strings, preventing cross-configuration memory leakage between "simple" and "colorful" users.
* **Fix:** Expanded Express routes to dynamically handle compound parameters (/:style/:apiKey/manifest.json) alongside legacy URL structures.

---

## Release: v1.4.0
* **Feature:** Implemented parallel source racing logic to bypass slow target servers.
* **Feature:** Added a fallback community TMDB API key.
* **Feature:** Added an in-memory caching layer (Max: 1000 items, TTL: 6 hours) to prevent OOM crashes and optimize speed.
* **Fix:** Relaxed strict title matching to resolve false negatives on AfterCredits.
* **Fix:** Updated UI stream titles to standard nomenclature for better UX.
