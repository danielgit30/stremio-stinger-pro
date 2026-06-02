const axios = require('axios');
const cheerio = require('cheerio');
const { WIKI_TTL } = require('../config');
const { wikiNormalize, BLOOPER_REGEX } = require('../utils/strings');
const { sanitizeError } = require('../utils/network');
const redisCache = require('../cache/redis');
const { log } = require('../utils/logger');
const { getResultObj } = require('../utils/formatter');

let wikiCache = new Map();
let wikiLastFetched = 0;
let wikiFetchPromise = null;

const extractText = (node) => {
    if (!node) return '';
    if (node.type === 'text') return node.data;
    let text = '';
    if (node.children) {
        for (let j = 0; j < node.children.length; j++) {
            text += extractText(node.children[j]);
        }
    }
    return text;
};

const findFirstTag = (node, tagName) => {
    if (node.type === 'tag' && node.name === tagName) return node;
    if (node.children) {
        for (let j = 0; j < node.children.length; j++) {
            const found = findFirstTag(node.children[j], tagName);
            if (found) return found;
        }
    }
    return null;
};

async function buildWikiIndex(reqConfig) {
    if (Date.now() - wikiLastFetched < WIKI_TTL && wikiCache.size > 0) return;
    if (wikiFetchPromise) return wikiFetchPromise;

    wikiFetchPromise = (async () => {
        try {
            log(`[Wiki] Building index...`);

            if (redisCache.isRedisEnabled()) {
                const cachedData = await redisCache.getCache('wiki_index_cache');
                if (cachedData && typeof cachedData === 'object') {
                    wikiCache = new Map(Object.entries(cachedData));
                    wikiLastFetched = Date.now();
                    log(`[Wiki] Loaded ${wikiCache.size} entries from Redis cache.`);
                    return;
                }
            }

            const { axiosConfig } = require('../config');
            const mergedConfig = reqConfig ? { ...axiosConfig, ...reqConfig } : axiosConfig;
            const res = await axios.get(
                'https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes',
                mergedConfig
            );
            const $ = cheerio.load(res.data);
            const newCache = new Map();

            $('table.wikitable tr').each((i, el) => {
                let titleText = '';

                const iNode = findFirstTag(el, 'i');
                if (iNode) {
                    titleText = extractText(iNode);
                } else {
                    let tdCount = 0;
                    if (el.children) {
                        for (let j = 0; j < el.children.length; j++) {
                            const child = el.children[j];
                            if (child.type === 'tag' && child.name === 'td') {
                                if (tdCount === 1) {
                                    titleText = extractText(child);
                                    break;
                                }
                                tdCount++;
                            }
                        }
                    }
                }

                if (!titleText) return;

                const cleanTitle = wikiNormalize(titleText);
                const rowText = extractText(el).toLowerCase();

                let hasMid = rowText.includes('mid-') || rowText.includes('during');
                let hasPost = rowText.includes('post-') || rowText.includes('after');
                let hasBloopers = BLOOPER_REGEX.test(rowText);

                newCache.set(cleanTitle, { mid: hasMid, post: hasPost, bloopers: hasBloopers });
            });

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

async function checkWikipedia(title, reqConfig) {
    log(`\n--- [Wikipedia] Execution Start: "${title}" ---`);
    await buildWikiIndex(reqConfig);
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
