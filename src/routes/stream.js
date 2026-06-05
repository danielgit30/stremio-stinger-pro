const { axiosInstance, isCancel, sanitizeError } = require('../utils/network');
const {
    CACHE_TTL_SUCCESS,
    CACHE_TTL_ERROR,
    METADATA_TTL,
    CINEMETA_TIMEOUT,
    SCRAPER_TIMEOUT,
    DEFAULT_TMDB_KEY,
} = require('../config');
const { streamCache, cinemetaCache, rawScraperCache } = require('../cache/memory');
const redisCache = require('../cache/redis');
const scrapers = require('../scrapers');
const { formatMessage, formatRelatedMessage } = require('../utils/formatter');
const { log, warn, error } = require('../utils/logger');

const { LRUCache } = require('lru-cache');

const activeRequests = new LRUCache({
    max: 1000,
    ttl: 30000, // Safety net TTL for requests hanging
});
const setCacheError = (cacheKey) => {
    streamCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_ERROR, stream: null });
    if (redisCache.isRedisEnabled()) {
        redisCache
            .setCache(cacheKey, { isCachedWrapper: true, stream: null }, Math.floor(CACHE_TTL_ERROR / 1000))
            .catch((err) => error(`Redis Cache Error: ${err.message}`));
    }
};

const parseRequestConfig = (req) => {
    let rawStyle = req.params.style || req.params.p1 || 'colorful';
    let apiKey =
        req.params.apiKey ||
        (req.params.p1 &&
        !req.params.p1.includes('simple') &&
        !req.params.p1.includes('colorful') &&
        !req.params.p1.includes('monochrome')
            ? req.params.p1
            : null);

    if (rawStyle.length > 50) rawStyle = 'colorful';
    if (apiKey && (apiKey.length > 100 || !/^[a-f0-9]{32}$/i.test(apiKey))) apiKey = null;

    const styleConfig = {
        style: rawStyle.replace(/-nosource|-bloopers|-sequel|-related/g, ''),
        showSource: !rawStyle.includes('-nosource'),
        showBloopers: rawStyle.includes('-bloopers'),
        showSequel: rawStyle.includes('-sequel'),
        showRelated: rawStyle.includes('-related'),
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

const fetchCinemetaNetwork = async (id, signal) => {
    const config = { timeout: CINEMETA_TIMEOUT, signal };
    try {
        const metaRes = await axiosInstance.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`, config);
        const title = metaRes.data?.meta?.name;
        const year = metaRes.data?.meta?.year;
        const moviedbId = metaRes.data?.meta?.moviedb_id;

        if (title) {
            return { title, year, moviedbId };
        }
    } catch (e) {
        if (!isCancel(e)) {
            error(`[Stream Error] Cinemeta Lookup Failed: ${sanitizeError(e.message)}`);
        }
    }
    return null;
};

const fetchTmdbMetadataNetwork = async (imdbId, apiKey, signal) => {
    const config = { timeout: CINEMETA_TIMEOUT, signal };
    try {
        log(`[Stream] Attempting TMDB metadata fallback for ID: ${imdbId}`);
        const findRes = await axiosInstance.get(
            `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&api_key=${encodeURIComponent(apiKey)}`,
            config
        );
        const movieMatch = findRes.data.movie_results?.[0];
        if (movieMatch) {
            const title = movieMatch.title || movieMatch.original_title;
            const year = movieMatch.release_date ? new Date(movieMatch.release_date).getFullYear() : null;
            const moviedbId = Number(movieMatch.id);
            return { title, year, moviedbId };
        }
    } catch (e) {
        if (!isCancel(e)) {
            error(`[Stream Error] TMDB Metadata Fallback Failed: ${sanitizeError(e.message)}`);
        }
    }
    return null;
};

const raceMetadataSources = (id, apiKey) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CINEMETA_TIMEOUT);

    const pCinemeta = fetchCinemetaNetwork(id, controller.signal);
    const pTmdb = fetchTmdbMetadataNetwork(id, apiKey, controller.signal);

    return new Promise((resolve) => {
        let completed = 0;
        let resolved = false;

        const handleResult = (val) => {
            if (resolved) return;
            if (val && val.title) {
                resolved = true;
                clearTimeout(timeoutId);
                controller.abort(); // Cancel the other request
                resolve(val);
            } else {
                completed++;
                if (completed === 2) {
                    clearTimeout(timeoutId);
                    controller.abort();
                    resolve(null);
                }
            }
        };

        pCinemeta.then(handleResult).catch(() => handleResult(null));
        pTmdb.then(handleResult).catch(() => handleResult(null));
    });
};

const fetchMetadata = async (id, apiKey) => {
    const cachedCinemeta = cinemetaCache.get(id);
    if (cachedCinemeta && Date.now() < cachedCinemeta.expiresAt) {
        log(`[Stream] Cinemeta Cache HIT (Memory) for ID: ${id}`);
        return { title: cachedCinemeta.title, year: cachedCinemeta.year, moviedbId: cachedCinemeta.moviedbId };
    }

    if (redisCache.isRedisEnabled()) {
        const redisCinemeta = await redisCache.getCache(`cinemeta_${id}`);
        if (redisCinemeta !== null) {
            log(`[Stream] Cinemeta Cache HIT (Redis) for ID: ${id}`);
            cinemetaCache.set(id, {
                title: redisCinemeta.title,
                year: redisCinemeta.year,
                moviedbId: redisCinemeta.moviedbId,
                expiresAt: Date.now() + METADATA_TTL,
            });
            return { title: redisCinemeta.title, year: redisCinemeta.year, moviedbId: redisCinemeta.moviedbId };
        }
    }

    const key = apiKey || DEFAULT_TMDB_KEY;
    let result;

    if (key) {
        log(`[Stream] Cache MISS. Racing Cinemeta and TMDB fallback for ID: ${id}`);
        result = await raceMetadataSources(id, key);
    } else {
        log(`[Stream] Cache MISS. Fetching Cinemeta for ID: ${id}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CINEMETA_TIMEOUT);
        result = await fetchCinemetaNetwork(id, controller.signal);
        clearTimeout(timeoutId);
    }

    if (result && result.title) {
        cinemetaCache.set(id, {
            title: result.title,
            year: result.year,
            moviedbId: result.moviedbId,
            expiresAt: Date.now() + METADATA_TTL,
        });
        if (redisCache.isRedisEnabled()) {
            redisCache
                .setCache(
                    `cinemeta_${id}`,
                    { title: result.title, year: result.year, moviedbId: result.moviedbId },
                    Math.floor(METADATA_TTL / 1000)
                )
                .catch((err) => error(`Redis Cache Error: ${err.message}`));
        }
        return result;
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
            finalResult = await Promise.any([checkDefinitive(pTmdb, 'TMDB'), checkDefinitive(pWiki, 'Wikipedia')]);
        } catch {
            // AggregateError: All promises were rejected (meaning no definitive result)
            // finalResult remains what it was initialized/set to (null)
        }
    }

    if (finalResult) {
        const definitiveName = finalResult._sourceName || 'Unknown';
        delete finalResult._sourceName;
        log(`[Stream] Definitive state found by ${definitiveName}. Aborting others...`);
        scraperController.abort();
    }

    return { finalResult, bestFallback };
};

const processScrapingSequence = async (id, apiKey, cacheKey, styleConfig) => {
    let finalResult;
    let bestFallback;
    let relatedData;
    let title;
    let year;
    let moviedbId;

    const cachedScraperData = rawScraperCache.get(id);
    if (cachedScraperData && Date.now() < cachedScraperData.expiresAt) {
        log(`[Stream] Raw Scraper Cache HIT (Memory). Bypassing duplicate network requests.`);
        finalResult = cachedScraperData.finalResult;
        bestFallback = cachedScraperData.bestFallback;
        title = cachedScraperData.title;
        year = cachedScraperData.year;
        relatedData = cachedScraperData.relatedData;
        moviedbId = cachedScraperData.moviedbId;
    } else {
        if (redisCache.isRedisEnabled()) {
            const redisScraperData = await redisCache.getCache(`rawScraper_${id}`);
            if (redisScraperData !== null) {
                log(`[Stream] Raw Scraper Cache HIT (Redis). Bypassing duplicate network requests.`);
                finalResult = redisScraperData.finalResult;
                bestFallback = redisScraperData.bestFallback;
                relatedData = redisScraperData.relatedData;
                title = redisScraperData.title;
                year = redisScraperData.year;
                moviedbId = redisScraperData.moviedbId;

                rawScraperCache.set(id, {
                    finalResult,
                    bestFallback,
                    relatedData,
                    title,
                    year,
                    moviedbId,
                    expiresAt: Date.now() + METADATA_TTL,
                });
            }
        }

        if (!title) {
            const metaData = await fetchMetadata(id, apiKey);
            title = metaData.title;
            year = metaData.year;
            moviedbId = metaData.moviedbId;

            if (!title) {
                log(`[Stream] Cinemeta & TMDB fallback lookup failed or timed out. Returning empty streams.`);
                log(`=================================\n`);
                setCacheError(cacheKey);
                return null;
            }

            log(`[Stream] Target: "${title}" (${year})`);

            const scraperController = new AbortController();
            const scraperTimeoutId = setTimeout(() => scraperController.abort(), SCRAPER_TIMEOUT);
            const scraperConfig = { timeout: SCRAPER_TIMEOUT, signal: scraperController.signal };

            let relatedController = null;
            let relatedTimeoutId = null;
            let relatedConfig = null;

            if (moviedbId && styleConfig.showRelated) {
                relatedController = new AbortController();
                relatedTimeoutId = setTimeout(() => relatedController.abort(), SCRAPER_TIMEOUT);
                relatedConfig = { timeout: SCRAPER_TIMEOUT, signal: relatedController.signal };
            }

            try {
                const pScrapers = runScrapers(title, year, id, moviedbId, apiKey, scraperConfig, scraperController);
                const pRelated = relatedConfig
                    ? scrapers.getRelatedMovies(moviedbId, apiKey, relatedConfig, id)
                    : Promise.resolve(undefined);

                const [results, relatedRes] = await Promise.all([pScrapers, pRelated]);
                finalResult = results.finalResult;
                bestFallback = results.bestFallback;
                relatedData = relatedRes;

                rawScraperCache.set(id, {
                    finalResult,
                    bestFallback,
                    relatedData,
                    title,
                    year,
                    moviedbId,
                    expiresAt: Date.now() + METADATA_TTL,
                });

                if (redisCache.isRedisEnabled()) {
                    redisCache
                        .setCache(
                            `rawScraper_${id}`,
                            { finalResult, bestFallback, relatedData, title, year, moviedbId },
                            Math.floor(METADATA_TTL / 1000)
                        )
                        .catch((err) => error(`Redis Cache Error: ${err.message}`));
                }
            } catch (e) {
                if (!isCancel(e)) {
                    error(`[Stream Error] Scrapers block failed: ${sanitizeError(e.message)}`);
                }
                setCacheError(cacheKey);
                return null;
            } finally {
                clearTimeout(scraperTimeoutId);
                scraperController.abort();
                if (relatedTimeoutId) {
                    clearTimeout(relatedTimeoutId);
                }
                if (relatedController) {
                    relatedController.abort();
                }
            }
        }
    }

    if (styleConfig.showRelated && relatedData === undefined) {
        log(`[Stream] Cache hit but relatedData is undefined. Fetching related data on-demand.`);
        // moviedbId is already in function scope from whichever path populated it (memory/Redis/fresh).
        // Only call fetchMetadata as a last resort (e.g., legacy cache entries that predate moviedbId storage).
        let moviedbIdForRelated = moviedbId;
        if (!moviedbIdForRelated) {
            const metaData = await fetchMetadata(id, apiKey);
            moviedbIdForRelated = metaData?.moviedbId;
        }
        if (moviedbIdForRelated) {
            const scraperController = new AbortController();
            const scraperTimeoutId = setTimeout(() => scraperController.abort(), SCRAPER_TIMEOUT);
            const scraperConfig = { timeout: SCRAPER_TIMEOUT, signal: scraperController.signal };
            try {
                relatedData = await scrapers.getRelatedMovies(moviedbIdForRelated, apiKey, scraperConfig, id);
                rawScraperCache.set(id, {
                    finalResult,
                    bestFallback,
                    relatedData,
                    title,
                    year,
                    moviedbId: moviedbIdForRelated,
                    expiresAt: Date.now() + METADATA_TTL,
                });
                if (redisCache.isRedisEnabled()) {
                    redisCache
                        .setCache(
                            `rawScraper_${id}`,
                            { finalResult, bestFallback, relatedData, title, year, moviedbId: moviedbIdForRelated },
                            Math.floor(METADATA_TTL / 1000)
                        )
                        .catch((err) => error(`Redis Cache Error: ${err.message}`));
                }
            } catch {
                relatedData = null;
            } finally {
                clearTimeout(scraperTimeoutId);
                scraperController.abort();
            }
        } else {
            relatedData = null;
        }
    }

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

    const streamObj = {
        name: 'After-Credits Scenes',
        title: `${formatMessage(styleConfig, resolvedResult)}${styleConfig.showSource ? `\nSource: ${resolvedResult.source}` : ''}`,
        url:
            resolvedResult.url ||
            `https://aftercredits.com/?s=${encodeURIComponent(year ? `${title} ${year}` : title).replace(/%20/g, '+')}`,
    };

    let streamsToReturn = [streamObj];

    if (styleConfig.showRelated && relatedData) {
        streamsToReturn.push({
            name: relatedData.collectionName ? `Part of ${relatedData.collectionName}` : 'Not Part of a Collection',
            title: formatRelatedMessage(styleConfig, relatedData),
            url: relatedData.collectionUrl,
        });
    }

    const cacheDuration = CACHE_TTL_SUCCESS;
    streamCache.set(cacheKey, { expiresAt: Date.now() + cacheDuration, stream: streamsToReturn });
    if (redisCache.isRedisEnabled()) {
        redisCache
            .setCache(
                cacheKey,
                { isCachedWrapper: true, stream: streamsToReturn },
                Math.floor(CACHE_TTL_SUCCESS / 1000)
            )
            .catch((err) => error(`Redis Cache Error: ${err.message}`));
    }

    log(`[Stream] Payload generated and cached. Sequence complete.`);
    log(`=================================\n`);
    return streamsToReturn;
};

const sendJson = (res, streams, isError) => {
    if (isError) {
        res.setHeader('Cache-Control', 'public, max-age=60');
    } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    }
    res.json({ streams: streams || [] });
};

const streamHandler = async (req, res) => {
    const { type, id } = req.params;
    if (type !== 'movie') {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.json({ streams: [] });
    }
    if (!id || !/^tt\d+$/.test(id)) {
        warn(`[Stream] Invalid ID format: ${sanitizeError(id)}`);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.json({ streams: [] });
    }

    log(`
========== NEW REQUEST ==========`);
    log(`[Stream] Request Type: ${type} | ID: ${id}`);

    const { rawStyle, apiKey, styleConfig } = parseRequestConfig(req);
    const cacheKey = `${id}_${rawStyle}`;

    const cachedResult = await getCachedStream(cacheKey);
    if (cachedResult.hit) {
        const isError = !cachedResult.stream;
        const streams = cachedResult.stream
            ? Array.isArray(cachedResult.stream)
                ? cachedResult.stream
                : [cachedResult.stream]
            : [];
        sendJson(res, streams, isError);
        return;
    }

    if (activeRequests.has(cacheKey)) {
        log(`[Stream] Cache MISS. Concurrent request detected for key: ${cacheKey}. Coalescing...`);
        const p = activeRequests.get(cacheKey);
        try {
            const stream = await p;
            const isError = !stream;
            const streams = stream ? (Array.isArray(stream) ? stream : [stream]) : [];
            sendJson(res, streams, isError);
            return;
        } catch {
            sendJson(res, [], true);
            return;
        }
    }

    const scrapePromise = processScrapingSequence(id, apiKey, cacheKey, styleConfig);
    activeRequests.set(cacheKey, scrapePromise);

    try {
        const stream = await scrapePromise;
        const isError = !stream;
        const streams = stream ? (Array.isArray(stream) ? stream : [stream]) : [];
        sendJson(res, streams, isError);
    } catch {
        sendJson(res, [], true);
    } finally {
        // Strict reference equality: guards against an LRU eviction + re-insertion race where
        // a new promise could be stored under the same cacheKey before this cleanup runs.
        if (activeRequests.get(cacheKey) === scrapePromise) {
            activeRequests.delete(cacheKey);
        }
    }
};

module.exports = { streamHandler };
