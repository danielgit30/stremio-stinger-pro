const axios = require('axios');
const cheerio = require('cheerio');
const { WIKI_TTL } = require('../config');
const { wikiNormalize, getResultObj, BLOOPER_REGEX } = require('../utils/strings');
const { sanitizeError } = require('../utils/network');

let wikiCache = new Map();
let wikiLastFetched = 0;
let wikiFetchPromise = null;

async function buildWikiIndex(reqConfig) {
    if (Date.now() - wikiLastFetched < WIKI_TTL && wikiCache.size > 0) return;
    if (wikiFetchPromise) return wikiFetchPromise;

    wikiFetchPromise = (async () => {
        try {
            console.log(`[Wiki] Building index...`);
            const res = await axios.get('https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes', reqConfig);
            const $ = cheerio.load(res.data);
            const newCache = new Map();

            $("table.wikitable tr").each((i, el) => {
                const $el = $(el);
                let titleText = $el.find("i").first().text();
                if (!titleText) titleText = $el.find("td").eq(1).text();
                if (!titleText) return;

                const cleanTitle = wikiNormalize(titleText);
                const rowText = $el.text().toLowerCase();

                let hasMid = rowText.includes('mid-') || rowText.includes('during');
                let hasPost = rowText.includes('post-') || rowText.includes('after');
                let hasBloopers = BLOOPER_REGEX.test(rowText);

                newCache.set(cleanTitle, { mid: hasMid, post: hasPost, bloopers: hasBloopers });
            });

            wikiCache = newCache;
            wikiLastFetched = Date.now();
            console.log(`[Wiki] Built ${wikiCache.size} entries.`);
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
    console.log(`\n--- [Wikipedia] Execution Start: "${title}" ---`);
    await buildWikiIndex(reqConfig);
    const cleanQuery = wikiNormalize(title);
    if (wikiCache.has(cleanQuery)) {
        const data = wikiCache.get(cleanQuery);
        let isDefinitive = true;
        console.log(`[Wikipedia] Match -> Mid: ${data.mid}, Post: ${data.post}, Bloopers: ${data.bloopers}, Definitive: ${isDefinitive}`);
        const { getResultObj } = require('../utils/formatter'); // Delayed require to avoid circular deps if any
        return getResultObj(data.mid, data.post, false, 'https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes', 'Wikipedia', data.bloopers, isDefinitive);
    }
    console.log(`[Wikipedia] No match found.`);
    return null;
}

module.exports = {
    buildWikiIndex,
    checkWikipedia
};
