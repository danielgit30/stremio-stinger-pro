const axios = require('axios');
const { CACHE_TTL_SUCCESS, CACHE_TTL_ERROR, axiosConfig, CINEMETA_TIMEOUT, SCRAPER_TIMEOUT } = require('../config');
const { streamCache, cinemetaCache, rawScraperCache } = require('../cache/memory');
const redisCache = require('../cache/redis');
const { sanitizeError } = require('../utils/network');
const scrapers = require('../scrapers');
const { formatMessage } = require('../utils/formatter');
const { log } = require('../utils/logger');



const activeRequests = new Map();



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
        return { hit: true, stream: memCached.stream };
    } else if (memCached) {
        streamCache.delete(cacheKey);
    }

    // Check Redis Cache
    if (redisCache.isRedisEnabled()) {
        const redisData = await redisCache.getCache(cacheKey);
        if (redisData !== null) {
            log(`[Stream] Cache HIT (Redis). Resolving from Redis.`);
            
            let stream = redisData;
            if (redisData.isCachedWrapper) {
                stream = redisData.stream;
            }
            
            const ttl = stream === null ? CACHE_TTL_ERROR : CACHE_TTL_SUCCESS;
            streamCache.set(cacheKey, { expiresAt: Date.now() + ttl, stream }); 
            
            return { hit: true, stream };
        }
    }

    return { hit: false };
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
        const pWiki = scrapers.checkWikipedia(title).catch(() => null);

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
    let finalResult;
    let bestFallback;
    let title;
    let year;

    const cachedScraperData = rawScraperCache.get(id);
    if (cachedScraperData && Date.now() < cachedScraperData.expiresAt) {
        log(`[Stream] Raw Scraper Cache HIT (Memory). Bypassing duplicate network requests.`);
        finalResult = cachedScraperData.finalResult;
        bestFallback = cachedScraperData.bestFallback;
        title = cachedScraperData.title;
        year = cachedScraperData.year;
    } else {
        const cinemetaController = new AbortController();
        const cinemetaTimeoutId = setTimeout(() => cinemetaController.abort(), CINEMETA_TIMEOUT);
        const cinemetaConfig = { ...axiosConfig, timeout: CINEMETA_TIMEOUT, signal: cinemetaController.signal };

        const cinemetaData = await fetchCinemeta(id, cinemetaConfig);
        title = cinemetaData.title;
        year = cinemetaData.year;
        const moviedbId = cinemetaData.moviedbId;

        clearTimeout(cinemetaTimeoutId);

        if (!title) {
            log(`[Stream] Cinemeta lookup failed or timed out. Returning empty streams.`);
            log(`=================================\n`);
            streamCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_ERROR, stream: null });
            if (redisCache.isRedisEnabled()) {
                redisCache.setCache(cacheKey, { isCachedWrapper: true, stream: null }, Math.floor(CACHE_TTL_ERROR / 1000));
            }
            return null;
        }

        log(`[Stream] Target: "${title}" (${year})`);

        const scraperController = new AbortController();
        const scraperTimeoutId = setTimeout(() => scraperController.abort(), SCRAPER_TIMEOUT);
        const scraperConfig = { ...axiosConfig, timeout: SCRAPER_TIMEOUT, signal: scraperController.signal };

        try {
            const results = await runScrapers(title, year, id, moviedbId, apiKey, scraperConfig, scraperController);
            finalResult = results.finalResult;
            bestFallback = results.bestFallback;

            rawScraperCache.set(id, {
                finalResult,
                bestFallback,
                title,
                year,
                expiresAt: Date.now() + CACHE_TTL_SUCCESS,
            });
        } catch (e) {
            if (e.name !== 'CanceledError' && e.message !== 'canceled') {
                console.error(`[Stream Error] Scrapers block failed: ${sanitizeError(e.message)}`);
            }
            streamCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_ERROR, stream: null });
            if (redisCache.isRedisEnabled()) {
                redisCache.setCache(cacheKey, { isCachedWrapper: true, stream: null }, Math.floor(CACHE_TTL_ERROR / 1000));
            }
            return null;
        } finally {
            clearTimeout(scraperTimeoutId);
            scraperController.abort();
        }
    }

    const resolvedResult = finalResult || bestFallback || {
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
        title: `${formatMessage(styleConfig, resolvedResult)}${styleConfig.showSource ? `\nSource: ${resolvedResult.source}` : ''}`,
        url: resolvedResult.url || `https://aftercredits.com/?s=${encodeURIComponent(year ? `${title} ${year}` : title).replace(/%20/g, '+')}`,
    };

    const cacheDuration = CACHE_TTL_SUCCESS;
    streamCache.set(cacheKey, { expiresAt: Date.now() + cacheDuration, stream });
    if (redisCache.isRedisEnabled()) {
        redisCache.setCache(cacheKey, { isCachedWrapper: true, stream }, Math.floor(CACHE_TTL_SUCCESS / 1000));
    }

    log(`[Stream] Payload generated and cached. Sequence complete.`);
    log(`=================================\n`);
    return stream;
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

    const { rawStyle, apiKey, styleConfig } = parseRequestConfig(req);
    const cacheKey = `${id}_${rawStyle}`;

    const cachedResult = await getCachedStream(cacheKey);
    if (cachedResult.hit) {
        return res.json({ streams: cachedResult.stream ? [cachedResult.stream] : [] });
    }

    if (activeRequests.has(cacheKey)) {
        log(`[Stream] Cache MISS. Concurrent request detected for key: ${cacheKey}. Coalescing...`);
        const p = activeRequests.get(cacheKey);
        activeRequests.delete(cacheKey);
        activeRequests.set(cacheKey, p);
        try {
            const stream = await p;
            return res.json({ streams: stream ? [stream] : [] });
        } catch {
            return res.json({ streams: [] });
        }
    }

    if (activeRequests.size >= 1000) {
        const firstKey = activeRequests.keys().next().value;
        activeRequests.delete(firstKey);
    }

    const scrapePromise = processScrapingSequence(id, apiKey, cacheKey, styleConfig);
    activeRequests.set(cacheKey, scrapePromise);

    try {
        const stream = await scrapePromise;
        return res.json({ streams: stream ? [stream] : [] });
    } catch {
        return res.json({ streams: [] });
    } finally {
        if (activeRequests.get(cacheKey) === scrapePromise) {
            activeRequests.delete(cacheKey);
        }
    }
};

module.exports = { streamHandler };
