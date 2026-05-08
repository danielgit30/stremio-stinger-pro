![logo](/icon.png)

# Stremio Stinger Pro
**Version 1.4.0**

Stremio Stinger Pro is a high-performance metadata addon for Stremio. It automates the detection of mid-credits and post-credits scenes for feature films, providing users with immediate, actionable advice on whether to stay seated or if it is safe to stop playback.

`https://stremio-addons.net/addons/stremio-stinger-pro-1.4`

---

## Table of Contents
* [⚙️ How It Works (Under the Hood)](#️-how-it-works-under-the-hood)
* [📡 Data Sources](#-data-sources)
* [🌍 Configuration and Installation](#-configuration-and-installation)
* [🚀 Deployment Details](#-deployment-details)

[Latest Release: v1.4.0](#release-v140)

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
3. **The Movie Database (TMDB):** Tertiary fallback. Scans movie metadata for specific stinger keywords (`duringcreditsstinger`, `aftercreditsstinger`). The addon utilizes a community API key by default, but users can provide a personal v3 API key for dedicated rate limits.

## 🌍 Configuration and Installation
The addon can be installed directly or configured with a personal TMDB API key to ensure stability if the community key reaches its rate limit.

**Configuration Portal:**
`https://stremio-stinger-pro.onrender.com/configure`

## 🚀 Deployment Details
* **Hosting:** Deployed via a continuous Node.js container on Render (Free Tier).
* **Keep-Alive:** The server is maintained in an active state via scheduled Cronjobs to prevent cold-start delays.

## Release: v1.4.0
* **Feature:** Implemented parallel source racing logic to bypass slow target servers.
* **Feature:** Added a fallback community TMDB API key.
* **Feature:** Added an in-memory caching layer (Max: 1000 items, TTL: 6 hours) to prevent OOM crashes and optimize speed.
* **Fix:** Relaxed strict title matching to resolve false negatives on AfterCredits.
* **Fix:** Updated UI stream titles to standard nomenclature for better UX.
