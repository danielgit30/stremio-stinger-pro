const { axiosInstance, isCancel } = require('../utils/network');
const cheerio = require('cheerio');
const {
    cleanTitle,
    isTitleMatch,
    decodeHtmlString,
    BLOOPER_REGEX,
    NEGATIVE_REGEX,
    STINGER_EXCEPTION_REGEX,
    AC_BLOOPER_TAGS,
} = require('../utils/strings');
const { getResultObj } = require('../utils/formatter');
const { validateUrl, sanitizeError } = require('../utils/network');
const { log, error } = require('../utils/logger');

async function searchAfterCreditsMatch(title, year, reqConfig) {
    const cleanedTitle = cleanTitle(title.toLowerCase().trim());
    const searchQuery = encodeURIComponent(year ? `${title} ${year}` : title);
    const searchUrl = `https://aftercredits.com/wp-json/wp/v2/posts?search=${searchQuery}&_fields=id,title,link&per_page=10`;
    let searchRes = await axiosInstance.get(searchUrl, reqConfig);

    if ((!searchRes.data || searchRes.data.length === 0) && year) {
        log(`[AfterCredits] No results with year. Retrying search without year...`);
        const searchUrlNoYear = `https://aftercredits.com/wp-json/wp/v2/posts?search=${encodeURIComponent(title)}&_fields=id,title,link&per_page=10`;
        searchRes = await axiosInstance.get(searchUrlNoYear, reqConfig);
    }

    let potentialMatches = [];

    if (Array.isArray(searchRes.data)) {
        for (const post of searchRes.data) {
            const rawLinkText = decodeHtmlString(post.title.rendered).toLowerCase().trim();
            if (!rawLinkText) continue;

            if (isTitleMatch(rawLinkText, cleanedTitle)) {
                potentialMatches.push({
                    id: post.id,
                    url: post.link,
                    isReview: rawLinkText.includes('review'),
                    rawText: rawLinkText,
                });
            }
        }
    }

    if (potentialMatches.length === 0) {
        log(`[AfterCredits] Aborting: No match found.`);
        return null;
    }

    potentialMatches.sort((a, b) => a.isReview - b.isReview);

    return potentialMatches[0];
}

async function parseAfterCreditsPage(bestMatch, reqConfig) {
    const { id, url } = bestMatch;

    let content = '';
    let categoryTagsArray = [];

    try {
        const postRes = await axiosInstance.get(
            `https://aftercredits.com/wp-json/wp/v2/posts/${id}?_fields=content,_links,_embedded&_embed=wp:term`,
            reqConfig
        );
        content = postRes.data?.content?.rendered || '';

        if (postRes.data?._embedded && postRes.data._embedded['wp:term']) {
            for (const taxonomy of postRes.data._embedded['wp:term']) {
                if (Array.isArray(taxonomy)) {
                    for (const term of taxonomy) {
                        if (term && term.name) {
                            categoryTagsArray.push(decodeHtmlString(term.name).toLowerCase().trim());
                        }
                    }
                }
            }
        }
    } catch (e) {
        if (!isCancel(e)) {
            log(`[AfterCredits Warning] Embedded fetch failed: ${sanitizeError(e.message)}. Retrying with fallback...`);
        }
    }

    if (categoryTagsArray.length === 0) {
        try {
            const [postRes, catRes] = await Promise.all([
                axiosInstance.get(`https://aftercredits.com/wp-json/wp/v2/posts/${id}?_fields=content`, reqConfig),
                axiosInstance.get(`https://aftercredits.com/wp-json/wp/v2/categories?post=${id}&_fields=name`, reqConfig),
            ]);
            content = postRes.data?.content?.rendered || '';
            categoryTagsArray = (catRes.data || []).map((c) => decodeHtmlString(c.name).toLowerCase().trim());
        } catch (e) {
            if (!isCancel(e)) {
                error(`[AfterCredits Error] Page parse fallback failed: ${sanitizeError(e.message)}`);
            }
            return null;
        }
    }

    const categoryTags = new Set(categoryTagsArray);

    const $$ = cheerio.load(content);
    let hasMid = false,
        hasPost = false,
        bloopers = false,
        sequel = false;

    log(`[AfterCredits] Categories Found: [${categoryTagsArray.join(', ')}]`);

    if (categoryTags.has('non-stingers')) {
        log(`[AfterCredits] 'non-stingers' category detected. Forcing definitive negative state.`);
        return getResultObj(false, false, true, url, 'AfterCredits', false, true);
    }

    if (categoryTags.has('unknown')) {
        log(`[AfterCredits] 'unknown' category detected. Forcing non-definitive negative state.`);
        return null;
    }

    if (categoryTags.size > 0) {
        if (categoryTags.has('both during & after credits')) {
            hasMid = true;
            hasPost = true;
        }
        if (categoryTags.has('during credits')) {
            hasMid = true;
        }
        if (categoryTags.has('after credits')) {
            hasPost = true;
        }
        if (categoryTagsArray.some((t) => AC_BLOOPER_TAGS.has(t))) {
            bloopers = true;
        }
        if (categoryTags.has('sequel setup')) {
            sequel = true;
        }
    }

    log(`[AfterCredits] Parsing body containers...`);

    const updateStingerState = (isBlooper, isNegative, currentState, type) => {
        if (isBlooper) {
            bloopers = true;
            log(`[AfterCredits] Blooper found in ${type} container.`);
            return currentState;
        }
        return !isNegative;
    };

    let hasStingerInfo = false;

    $$('.spoiler-wrap').each((i, el) => {
        const $el = $$(el);
        const headText = $el.find('.spoiler-head').first().text().trim().toLowerCase();

        const isMid = headText.includes('during') || headText.includes('mid');
        const isPost = headText.includes('after') || headText.includes('post');

        if (isMid || isPost) {
            hasStingerInfo = true;
            const blockText = $el.text().toLowerCase();
            const isBlooper = BLOOPER_REGEX.test(blockText);
            const isNegative = NEGATIVE_REGEX.test(blockText) && !STINGER_EXCEPTION_REGEX.test(blockText);

            if (isMid) {
                hasMid = hasMid || updateStingerState(isBlooper, isNegative, hasMid, 'MID');
            }

            if (isPost) {
                hasPost = hasPost || updateStingerState(isBlooper, isNegative, hasPost, 'POST');
            }
        }
    });

    let isDefinitive = false;
    if (hasMid || hasPost || bloopers || sequel || hasStingerInfo) {
        isDefinitive = true;
    }

    const isNegative = !hasMid && !hasPost && !bloopers;

    log(
        `[AfterCredits] Result -> Mid: ${hasMid}, Post: ${hasPost}, Negative: ${isNegative}, Bloopers: ${bloopers}, Definitive: ${isDefinitive}, Sequel: ${sequel}`
    );
    return getResultObj(hasMid, hasPost, isNegative, url, 'AfterCredits', bloopers, isDefinitive, sequel);
}

async function checkAfterCredits(title, year, reqConfig) {
    log(`\n--- [AfterCredits] Execution Start: "${title}" ---`);
    try {
        const bestMatch = await searchAfterCreditsMatch(title, year, reqConfig);

        if (!bestMatch) {
            return null;
        }

        log(`[AfterCredits] Fetching -> ${bestMatch.url} (Text: "${bestMatch.rawText}")`);

        const safeUrl = validateUrl(bestMatch.url, 'https://aftercredits.com', 'aftercredits.com');
        if (!safeUrl) return null;

        bestMatch.url = safeUrl;
        return await parseAfterCreditsPage(bestMatch, reqConfig);
    } catch (e) {
        if (!isCancel(e)) {
            error(`[AfterCredits Error] ${sanitizeError(e.message)}`);
        }
        return null;
    }
}

module.exports = {
    checkAfterCredits,
};
