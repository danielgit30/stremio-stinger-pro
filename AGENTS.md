# Stremio Stinger Pro - Agent Instructions & Context

Welcome to Stremio Stinger Pro! This file provides the context, structure, and standards for AI coding assistants working on this codebase.

## 🚀 Tech Stack & Core Libraries

- **Runtime:** Node.js
- **Web Framework:** Express.js (v5)
- **Scraping & Parsing:** Cheerio (for HTML parsing) & Axios (for HTTP requests with keep-alive latency optimization)
- **Caching:** Redis (`redis` client) with a fallback In-Memory cache
- **Testing:** Jest & Supertest
- **Linter & Formatter:** ESLint & Prettier

## 📂 Project Architecture & Key Files

- [package.json](file:///c:/stremio-stinger-pro/package.json): Lists all dependencies, npm scripts, and package information.
- [server.js](file:///c:/stremio-stinger-pro/server.js): Entry point of the server; initializes the Wikipedia index and starts listening on the configured port.
- [setup.sh](file:///c:/stremio-stinger-pro/setup.sh): Initialization script to set up environment configurations, install dependencies, and run validation tests.
- [setup.ps1](file:///c:/stremio-stinger-pro/setup.ps1): PowerShell initialization script for Windows environments.
- [src/app.js](file:///c:/stremio-stinger-pro/src/app.js): Configures the Express application, middleware (CORS, rate limiting), and registers endpoints.
- [src/config.js](file:///c:/stremio-stinger-pro/src/config.js): Centralized configuration file specifying timeouts, cache TTLs, rate limits, and network request defaults.

### Routes & Endpoints
- [src/routes/manifest.js](file:///c:/stremio-stinger-pro/src/routes/manifest.js): Defines the Stremio addon manifest details (ID, name, description, catalog info).
- [src/routes/stream.js](file:///c:/stremio-stinger-pro/src/routes/stream.js): Main stream endpoint where concurrent scraping requests are fired and results are formatted and cached.
- [src/routes/ui.js](file:///c:/stremio-stinger-pro/src/routes/ui.js): Serves a simple landing/config page for Stremio addon installation.

### Scrapers
- [src/scrapers/index.js](file:///c:/stremio-stinger-pro/src/scrapers/index.js): Exposes the interface to run all scrapers concurrently.
- [src/scrapers/aftercredits.js](file:///c:/stremio-stinger-pro/src/scrapers/aftercredits.js): Web scraper for AfterCredits.com.
- [src/scrapers/tmdb.js](file:///c:/stremio-stinger-pro/src/scrapers/tmdb.js): Looks up movie titles, years, and checks tags/details using TMDB API.
- [src/scrapers/wikipedia.js](file:///c:/stremio-stinger-pro/src/scrapers/wikipedia.js): Fetches lists of films with after-credits scenes and verifies against Wikipedia page content.

### Cache Layer
- [src/cache/memory.js](file:///c:/stremio-stinger-pro/src/cache/memory.js): A simple in-memory LRU cache fallback.
- [src/cache/redis.js](file:///c:/stremio-stinger-pro/src/cache/redis.js): Redis client wrapper used when `REDIS_URL` is configured.

### Utilities
- [src/utils/formatter.js](file:///c:/stremio-stinger-pro/src/utils/formatter.js): Formats final responses to match the Stremio stream schema.
- [src/utils/network.js](file:///c:/stremio-stinger-pro/src/utils/network.js): Axios HTTP request helpers with safe error recovery.
- [src/utils/strings.js](file:///c:/stremio-stinger-pro/src/utils/strings.js): Functions for cleaning titles, comparing string similarities (Levenshtein distance), and text sanitization.

### Tests
- [tests/app.test.js](file:///c:/stremio-stinger-pro/tests/app.test.js): End-to-end Jest tests for validation of addon endpoints.

## 🛠️ Environment Configuration

The application uses several environment variables defined in `.env` (copied from `.env.example`).
Ensure the following variables are set to enable optional features:
- `PORT`: The port on which the Express server listens (default: `7000`).
- `TMDB_API_KEY`: API key for TMDB to support TMDB scraper resolution (highly recommended).
- `REDIS_URL`: The Redis connection string (e.g. `redis://localhost:6379`). If left blank, the app defaults to the local in-memory cache.

## 🧪 Development Workflow

- **Setup Environment:** Run `./setup.sh` (or `.\setup.ps1` in PowerShell on Windows) to install dependencies and run initial verification.
- **Install Dependencies manually:** `npm install`
- **Start Development Server:** `npm start`
- **Run Verification Tests:** `npm test` or `npm test -- --forceExit`
- **Lint Codebase:** `npm run lint`
- **Format Codebase:** `npm run format`
