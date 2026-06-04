const axios = require('axios');
const cheerio = require('cheerio');
const { WIKI_TTL } = require('../config');
const { wikiNormalize, BLOOPER_REGEX } = require('../utils/strings');
const { sanitizeError } = require('../utils/network');

const WIKI_MID_REGEX =
    /mid-|during|throughout|overlay|alongside|while the credits|accompany.*credits|as.*credits roll|before.*credits roll|during.*titles|throughout.*titles|credits crawl|credits scroll/;
const WIKI_POST_REGEX =
    /post-|after|following|follows|at the end|very end|once the credits|final scene|last scene|after the final|after the end titles|ends with|concludes with/;
const redisCache = require('../cache/redis');
const { log } = require('../utils/logger');
const { getResultObj } = require('../utils/formatter');

let wikiCache = new Map();
let wikiLastFetched = 0;
async function loadWikiCacheFromRedis() {
    if (!redisCache.isRedisEnabled()) return false;

    const cachedData = await redisCache.getCache('wiki_index_cache');
    if (cachedData && typeof cachedData === 'object') {
        wikiCache = new Map(Object.entries(cachedData));
        wikiLastFetched = Date.now();
        log(`[Wiki] Loaded ${wikiCache.size} entries from Redis cache.`);
        return true;
    }
    return false;
}

let wikiFetchPromise = null;

async function buildWikiIndex(options = {}) {
    if (Date.now() - wikiLastFetched < WIKI_TTL && wikiCache.size > 0) return;
    if (wikiFetchPromise) return wikiFetchPromise;

    wikiFetchPromise = (async () => {
        try {
            log(`[Wiki] Building index...`);

            if (await loadWikiCacheFromRedis()) {
                return;
            }

            const { axiosConfig } = require('../config');
            // Isolate the global index build from request-specific abort signals
            const controller = new AbortController();
            const timeoutMs = options.timeout || 20000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const mergedHeaders = { ...axiosConfig.headers, ...options.headers };
            const mergedConfig = {
                ...axiosConfig,
                timeout: timeoutMs,
                headers: mergedHeaders,
                signal: controller.signal,
            };
            let htmlContent = '';
            try {
                const res = await axios.get(
                    'https://en.wikipedia.org/w/api.php?action=parse&page=List_of_films_with_post-credits_scenes&prop=text&format=json',
                    mergedConfig
                );
                htmlContent = res.data?.parse?.text?.['*'] || '';
            } finally {
                clearTimeout(timeoutId);
            }

            const newCache = new Map();

            // Tight scope for Cheerio to ensure immediate garbage collection
            (() => {
                const $ = cheerio.load(htmlContent);
                $('table.wikitable tr').each((i, el) => {
                    const $el = $(el);
                    let titleText = '';

                    const $iNode = $el.find('i').first();
                    if ($iNode.length > 0) {
                        titleText = $iNode.text();
                    } else {
                        const $tds = $el.find('td');
                        if ($tds.length > 1) {
                            titleText = $tds.eq(1).text();
                        }
                    }

                    if (!titleText) return;

                    const cleanTitle = wikiNormalize(titleText);
                    const rowText = $el.text().toLowerCase();

                    let hasMid = WIKI_MID_REGEX.test(rowText);
                    let hasPost = WIKI_POST_REGEX.test(rowText);
                    let hasBloopers = BLOOPER_REGEX.test(rowText);

                    newCache.set(cleanTitle, { mid: hasMid, post: hasPost, bloopers: hasBloopers });
                });
            })();

            // Explicitly clear references
            htmlContent = '';

            wikiCache = newCache;
            wikiLastFetched = Date.now();
            log(`[Wiki] Built ${wikiCache.size} entries from Wikipedia.`);

            if (redisCache.isRedisEnabled() && wikiCache.size > 0) {
                const flatData = Object.fromEntries(wikiCache.entries());
                redisCache.setCache('wiki_index_cache', flatData, Math.floor(WIKI_TTL / 1000));
                log(`[Wiki] Saved pre-compiled index to Redis cache.`);
            }
        } catch (e) {
            if (e.name !== 'CanceledError' && e.message !== 'canceled') {
                console.error(`[Wiki Error] ${sanitizeError(e.message)}`);
            }
        } finally {
            wikiFetchPromise = null;
        }
    })();

    return wikiFetchPromise;
}

async function checkWikipedia(title) {
    log(`\n--- [Wikipedia] Execution Start: "${title}" ---`);
    await buildWikiIndex();
    const cleanQuery = wikiNormalize(title);
    if (wikiCache.has(cleanQuery)) {
        const data = wikiCache.get(cleanQuery);
        let isDefinitive = true;
        log(
            `[Wikipedia] Match -> Mid: ${data.mid}, Post: ${data.post}, Bloopers: ${data.bloopers}, Definitive: ${isDefinitive}`
        );
        return getResultObj(
            data.mid,
            data.post,
            false,
            'https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes',
            'Wikipedia',
            data.bloopers,
            isDefinitive
        );
    }
    log(`[Wikipedia] No match found.`);
    return null;
}

module.exports = {
    buildWikiIndex,
    checkWikipedia,
};
