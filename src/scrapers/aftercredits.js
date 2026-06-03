const axios = require('axios');
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
const { log } = require('../utils/logger');

async function searchAfterCreditsMatch(title, year, reqConfig) {
    const cleanedTitle = cleanTitle(title.toLowerCase().trim());
    const searchQuery = encodeURIComponent(year ? `${title} ${year}` : title);
    const searchUrl = `https://aftercredits.com/wp-json/wp/v2/posts?search=${searchQuery}&_fields=id,title,link&per_page=10`;
    const searchRes = await axios.get(searchUrl, reqConfig);
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

    const [postRes, catRes] = await Promise.all([
        axios.get(`https://aftercredits.com/wp-json/wp/v2/posts/${id}?_fields=content`, reqConfig),
        axios.get(`https://aftercredits.com/wp-json/wp/v2/categories?post=${id}&_fields=name`, reqConfig),
    ]);
    const content = postRes.data?.content?.rendered || '';
    const categoryTags = (catRes.data || []).map((c) => decodeHtmlString(c.name).toLowerCase().trim());

    const $$ = cheerio.load(content);
    let hasMid = false,
        hasPost = false,
        bloopers = false,
        sequel = false;

    log(`[AfterCredits] Categories Found: [${categoryTags.join(', ')}]`);

    if (categoryTags.includes('non-stingers')) {
        log(`[AfterCredits] 'non-stingers' category detected. Forcing definitive negative state.`);
        return getResultObj(false, false, true, url, 'AfterCredits', false, true);
    }

    if (categoryTags.includes('unknown')) {
        log(`[AfterCredits] 'unknown' category detected. Forcing non-definitive negative state.`);
        return null;
    }

    if (categoryTags.length > 0) {
        if (categoryTags.includes('both during & after credits')) {
            hasMid = true;
            hasPost = true;
        }
        if (categoryTags.includes('during credits')) {
            hasMid = true;
        }
        if (categoryTags.includes('after credits')) {
            hasPost = true;
        }
        if (categoryTags.some((t) => AC_BLOOPER_TAGS.has(t))) {
            bloopers = true;
        }
        if (categoryTags.includes('sequel setup')) {
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

    $$('.spoiler-wrap').each((i, el) => {
        const $el = $$(el);
        const headText = $el.find('.spoiler-head').first().text().trim().toLowerCase();

        const isMid = headText.includes('during') || headText.includes('mid');
        const isPost = headText.includes('after') || headText.includes('post');

        if (isMid || isPost) {
            const blockText = $el.text().toLowerCase();
            const isBlooper = BLOOPER_REGEX.test(blockText);
            const isNegative = NEGATIVE_REGEX.test(blockText) && !STINGER_EXCEPTION_REGEX.test(blockText);

            if (isMid) {
                hasMid = updateStingerState(isBlooper, isNegative, hasMid, 'MID');
            }

            if (isPost) {
                hasPost = updateStingerState(isBlooper, isNegative, hasPost, 'POST');
            }
        }
    });

    let isDefinitive = false;
    if (hasMid || hasPost || bloopers || sequel) {
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
        if (e.name !== 'CanceledError' && e.message !== 'canceled') {
            console.error(`[AfterCredits Error] ${sanitizeError(e.message)}`);
        }
        return null;
    }
}

module.exports = {
    checkAfterCredits,
};
