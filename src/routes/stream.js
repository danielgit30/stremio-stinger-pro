const axios = require('axios');
const { CACHE_TTL_SUCCESS, CACHE_TTL_ERROR, axiosConfig, CINEMETA_TIMEOUT, SCRAPER_TIMEOUT } = require('../config');
const { streamCache, cinemetaCache } = require('../cache/memory');
const redisCache = require('../cache/redis');
const { sanitizeError } = require('../utils/network');
const scrapers = require('../scrapers');
const { formatMessage } = require('../utils/formatter');
const { log } = require('../utils/logger');

// Lightweight Telemetry
const telemetry = {
    cacheHits: 0,
    cacheMisses: 0,
    requestedIds: new Map(),
    getStats: () => ({
        cacheHits: telemetry.cacheHits,
        cacheMisses: telemetry.cacheMisses,
        topIds: [...telemetry.requestedIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    }),
};

const activeRequests = new Map();

const trackTelemetry = (id) => {
    const count = telemetry.requestedIds.get(id) || 0;

    // Bounded LRU logic
    const hasId = telemetry.requestedIds.delete(id);
    if (telemetry.requestedIds.size >= 1000 && !hasId) {
        telemetry.requestedIds.delete(telemetry.requestedIds.keys().next().value);
    }

    telemetry.requestedIds.set(id, count + 1);
};

const parseRequestConfig = (req) => {
    let rawStyle = req.params.style || req.params.p1 || 'colorful';
    let apiKey =
        req.params.apiKey ||
        (req.params.p1 && !req.params.p1.includes('simple') && !req.params.p1.includes('colorful')
            ? req.params.p1
            : null);

    if (rawStyle.length > 50) rawStyle = 'colorful';
    if (apiKey && apiKey.length > 100) apiKey = null;

    const styleConfig = {
        style: rawStyle.replace(/-nosource|-bloopers|-sequel/g, ''),
        showSource: !rawStyle.includes('-nosource'),
        showBloopers: rawStyle.includes('-bloopers'),
        showSequel: rawStyle.includes('-sequel'),
    };

    return { rawStyle, apiKey, styleConfig };
};

const getCachedStream = async (cacheKey) => {
    // Check Memory Cache
    const memCached = streamCache.get(cacheKey);
    if (memCached && Date.now() < memCached.expiresAt) {
        log(`[Stream] Cache HIT (Memory). Resolving from memory.`);
        telemetry.cacheHits++;
        return memCached.stream;
    } else if (memCached) {
        streamCache.delete(cacheKey);
    }

    // Check Redis Cache
    if (redisCache.isRedisEnabled()) {
        const redisData = await redisCache.getCache(cacheKey);
        if (redisData) {
            log(`[Stream] Cache HIT (Redis). Resolving from Redis.`);
            telemetry.cacheHits++;
            streamCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_SUCCESS, stream: redisData }); // Warm memory cache
            return redisData;
        }
    }

    return null;
};

const fetchCinemeta = async (id, cinemetaConfig) => {
    const cachedCinemeta = cinemetaCache.get(id);
    if (cachedCinemeta && Date.now() < cachedCinemeta.expiresAt) {
        log(`[Stream] Cinemeta Cache HIT (Memory) for ID: ${id}`);
        return { title: cachedCinemeta.title, year: cachedCinemeta.year, moviedbId: cachedCinemeta.moviedbId };
    }

    try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`, cinemetaConfig);
        const title = metaRes.data?.meta?.name;
        const year = metaRes.data?.meta?.year;
        const moviedbId = metaRes.data?.meta?.moviedb_id;

        if (title) {
            cinemetaCache.set(id, {
                title,
                year,
                moviedbId,
                expiresAt: Date.now() + CACHE_TTL_SUCCESS,
            });
            return { title, year, moviedbId };
        }
    } catch (e) {
        if (e.name !== 'CanceledError' && e.message !== 'canceled') {
            console.error(`[Stream Error] Cinemeta Lookup Failed: ${sanitizeError(e.message)}`);
        }
    }
    return { title: null, year: null, moviedbId: null };
};

const runScrapers = async (title, year, id, moviedbId, apiKey, scraperConfig, scraperController) => {
    let finalResult = null;
    let bestFallback = null;

    const updateFallback = (resObj) => {
        if (!resObj) return;
        if (resObj.no && (!bestFallback || !bestFallback.no)) {
            bestFallback = resObj;
        } else if (!bestFallback) {
            bestFallback = resObj;
        }
    };

    log(`[Stream] Firing Tier 0 scraper (AfterCredits)...`);

    const pAc = scrapers.checkAfterCredits(title, year, scraperConfig).catch(() => null);

    const checkDefinitive = (promise, name) =>
        promise.then((res) => {
            updateFallback(res);
            if (res && res.definitive) {
                res._sourceName = name; // attach source name for logging
                return res;
            }
            throw new Error('Not definitive');
        });

    try {
        // Tier 0
        finalResult = await checkDefinitive(pAc, 'AfterCredits');
    } catch {
        // Tier 1 - wait for the first definitive result
        log(`[Stream] Tier 0 missed. Firing Tier 1 scrapers (TMDB, Wikipedia)...`);
        const pTmdb = scrapers.checkTmdb(id, moviedbId, apiKey, scraperConfig).catch(() => null);
        const pWiki = scrapers.checkWikipedia(title, scraperConfig).catch(() => null);

        try {
            finalResult = await Promise.any([
                checkDefinitive(pTmdb, 'TMDB'),
                checkDefinitive(pWiki, 'Wikipedia'),
            ]);
        } catch {
            // AggregateError: All promises were rejected (meaning no definitive result)
            // finalResult remains what it was initialized/set to (null)
        }
    }

    if (finalResult) {
        const definitiveName = finalResult._sourceName || 'Unknown';
        delete finalResult._sourceName;
        log(
            `[Stream] Definitive state found by ${definitiveName}.${definitiveName !== 'Wikipedia' ? ' Aborting others...' : ''}`
        );
        if (definitiveName !== 'Wikipedia') scraperController.abort();
    }

    return { finalResult, bestFallback };
};

const processScrapingSequence = async (id, apiKey, cacheKey, styleConfig) => {
    const cinemetaController = new AbortController();
    const cinemetaTimeoutId = setTimeout(() => cinemetaController.abort(), CINEMETA_TIMEOUT);
    const cinemetaConfig = { ...axiosConfig, timeout: CINEMETA_TIMEOUT, signal: cinemetaController.signal };

    const { title, year, moviedbId } = await fetchCinemeta(id, cinemetaConfig);

    // Cleanup timeouts to avoid memory leak if aborted or completed
    clearTimeout(cinemetaTimeoutId);
    cinemetaController.abort();

    if (!title) {
        log(`[Stream] Cinemeta lookup failed or timed out. Returning empty streams.`);
        log(`=================================
`);
        return null;
    }

    log(`[Stream] Target: "${title}" (${year})`);

    const scraperController = new AbortController();
    const scraperTimeoutId = setTimeout(() => scraperController.abort(), SCRAPER_TIMEOUT);
    const scraperConfig = { ...axiosConfig, timeout: SCRAPER_TIMEOUT, signal: scraperController.signal };

    try {
        const { finalResult, bestFallback } = await runScrapers(
            title,
            year,
            id,
            moviedbId,
            apiKey,
            scraperConfig,
            scraperController
        );

        const isAggregatedError = !finalResult && !bestFallback;
        const resolvedResult = finalResult ||
            bestFallback || {
                mid: false,
                post: false,
                no: false,
                bloopers: false,
                sequel: false,
                url: `https://aftercredits.com/?s=${encodeURIComponent(year ? `${title} ${year}` : title).replace(/%20/g, '+')}`,
                source: 'Aggregated',
            };

        log(`[Stream] Final Resolution -> Source Used: ${resolvedResult.source}`);

        const stream = {
            name: 'After-Credits Scenes',
            title: `${formatMessage(styleConfig, resolvedResult)}${
                styleConfig.showSource
                    ? `
Source: ${resolvedResult.source}`
                    : ''
            }`,
            url:
                resolvedResult.url ||
                `https://aftercredits.com/?s=${encodeURIComponent(year ? `${title} ${year}` : title).replace(/%20/g, '+')}`,
        };

        const cacheDuration = CACHE_TTL_SUCCESS;
        streamCache.set(cacheKey, { expiresAt: Date.now() + cacheDuration, stream });
        if (redisCache.isRedisEnabled()) {
            redisCache.setCache(cacheKey, stream, Math.floor(CACHE_TTL_SUCCESS / 1000));
        }

        log(`[Stream] Payload generated and cached. Sequence complete.`);
        log(`=================================
`);
        return stream;
    } catch (e) {
        if (e.name !== 'CanceledError' && e.message !== 'canceled') {
            console.error(`[Stream Error] Scrapers block failed: ${sanitizeError(e.message)}`);
        }
        return null;
    } finally {
        clearTimeout(scraperTimeoutId);
        scraperController.abort();
    }
};

const streamHandler = async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');

    const { type, id } = req.params;
    if (type !== 'movie') return res.json({ streams: [] });
    if (!id || !/^tt\d+$/.test(id)) {
        console.warn(`[Stream] Invalid ID format: ${sanitizeError(id)}`);
        return res.json({ streams: [] });
    }

    log(`
========== NEW REQUEST ==========`);
    log(`[Stream] Request Type: ${type} | ID: ${id}`);

    trackTelemetry(id);

    const { rawStyle, apiKey, styleConfig } = parseRequestConfig(req);
    const cacheKey = `${id}_${rawStyle}`;

    const cachedStream = await getCachedStream(cacheKey);
    if (cachedStream) {
        return res.json({ streams: [cachedStream] });
    }

    telemetry.cacheMisses++;

    if (activeRequests.has(cacheKey)) {
        log(`[Stream] Cache MISS. Concurrent request detected for key: ${cacheKey}. Coalescing...`);
        try {
            const stream = await activeRequests.get(cacheKey);
            return res.json({ streams: stream ? [stream] : [] });
        } catch {
            return res.json({ streams: [] });
        }
    }

    const scrapePromise = processScrapingSequence(id, apiKey, cacheKey, styleConfig);
    activeRequests.set(cacheKey, scrapePromise);

    try {
        const stream = await scrapePromise;
        return res.json({ streams: stream ? [stream] : [] });
    } catch {
        return res.json({ streams: [] });
    } finally {
        activeRequests.delete(cacheKey);
    }
};

module.exports = { streamHandler, telemetry };
