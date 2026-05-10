const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================

const config = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
    timeout: 5000 
};
const DEFAULT_TMDB_KEY = "849503460613279144415848525b682e"; 

const streamCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; 

let wikiCache = new Map();
let wikiLastFetched = 0;
const WIKI_TTL = 24 * 60 * 60 * 1000; 


// ==========================================
// 2. STRING UTILITIES & FORMATTERS
// ==========================================

const isTitleMatch = (linkText, targetTitle) => {
    let tLink = linkText.toLowerCase().replace(/\(\d{4}\)/g, '').trim();
    let tTarget = targetTitle.toLowerCase().trim();

    const clean = (str) => {
        let s = str.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        return s.replace(/^(the|a|an)\s+/i, '').replace(/\s+(the|a|an)$/i, '').trim(); 
    };

    tLink = clean(tLink);
    tTarget = clean(tTarget);

    if (tLink === tTarget) return true;

    const safeSuffixes = /^(blooper|bloopers|outtake|outtakes|extra|extras|and|or|with|scene|scenes|credit|credits|stinger|stingers|review|reviews|post|mid|after|end|during|the|is|a|an|there|are|movie|film|\s)+$/;
    
    if (tTarget.length > 0 && tLink.startsWith(tTarget)) {
        const remainder = tLink.substring(tTarget.length).trim();
        if (safeSuffixes.test(remainder)) return true;
    }
    
    if (tLink.length > 0 && tTarget.startsWith(tLink)) {
         const remainder = tTarget.substring(tLink.length).trim();
         if (safeSuffixes.test(remainder)) return true;
    }

    return false;
};

const wikiNormalize = (title) => {
    return title.toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/,\s*(the|a|an)$/i, '')
        .replace(/\s*\(.*?\)\s*/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
};

const getResultObj = (mid, post, no, url, source, bloopers = false) => {
    return { mid, post, no, url, source, bloopers };
};

const formatMessage = (styleConfig, data) => {
    let output = [];
    const isSimple = styleConfig.style === 'simple';
    const showBloopers = styleConfig.showBloopers;

    if (data.source === 'Wikipedia') {
        return isSimple ? "Unclassified Scene" : "❓ Unclassified Scene";
    }

    if (isSimple) {
        if (data.mid && data.post) output.push("Mid-Credits Scene\nPost-Credits Scene");
        else if (data.mid) output.push("Mid-Credits Scene");
        else if (data.post) output.push("Post-Credits Scene");
        else if (!data.bloopers || !showBloopers) { 
            output.push((data.no || (data.bloopers && !showBloopers)) ? "No Bonus Scenes" : "No Stingers Found");
        }
    } else {
        if (data.mid && data.post) output.push("🍿 Mid & Post-Credits Scenes");
        else if (data.mid) output.push("⏳ Mid-Credits Scene");
        else if (data.post) output.push("🎬 Post-Credits Scene");
        else if (!data.bloopers || !showBloopers) { 
            output.push((data.no || (data.bloopers && !showBloopers)) ? "🏃‍♂️ Nothing But Credits" : "🕵️‍♂️ Couldn't Find Stingers");
        }
    }

    if (showBloopers && data.bloopers) {
        output.push(isSimple ? "Outtakes Found" : "🎭 Stay For The Outtakes");
    }

    return output.join('\n');
};


// ==========================================
// 3. CORE SCRAPERS
// ==========================================

async function buildWikiIndex() {
    if (Date.now() - wikiLastFetched < WIKI_TTL && wikiCache.size > 0) return;
    try {
        const res = await axios.get('https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes', config);
        const $ = cheerio.load(res.data);
        const newCache = new Map();
        
        $("table.wikitable tr").each((i, el) => {
            let titleText = $(el).find("i").first().text();
            if (!titleText) titleText = $(el).find("td").eq(1).text(); 
            if (!titleText) return;
            const cleanTitle = wikiNormalize(titleText);
            const rowText = $(el).text().toLowerCase();
            let hasMid = rowText.includes('mid-') || rowText.includes('during');
            let hasPost = rowText.includes('post-') || rowText.includes('after');
            let hasBloopers = !!rowText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/);
            if (hasBloopers) hasMid = false; 
            newCache.set(cleanTitle, { mid: hasMid, post: hasPost, bloopers: hasBloopers });
        });
        
        wikiCache = newCache;
        wikiLastFetched = Date.now();
        console.log(`[System] Wikipedia Index Built: ${wikiCache.size} titles.`);
    } catch (e) {
        console.error(`[Error] Wikipedia index failed: ${e.message}`);
    }
}

async function checkWikipedia(title) {
    console.log(`\n--- [Wikipedia] Execution Start: "${title}" ---`);
    await buildWikiIndex();
    const cleanQuery = wikiNormalize(title);
    if (wikiCache.has(cleanQuery)) {
        const data = wikiCache.get(cleanQuery);
        console.log(`[Wikipedia] Found in local dictionary -> Mid: ${data.mid}, Post: ${data.post}, Bloopers: ${data.bloopers}`);
        return getResultObj(data.mid, data.post, false, 'https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes', 'Wikipedia', data.bloopers);
    }
    console.log(`[Wikipedia] No match found in dictionary for "${cleanQuery}".`);
    return null;
}

async function checkAfterCredits(title, year) {
    console.log(`\n--- [AfterCredits] Execution Start: "${title}" (${year}) ---`);
    try {
        const searchUrl = `https://aftercredits.com/?s=${encodeURIComponent(title)}`;
        const searchRes = await axios.get(searchUrl, config);
        const $ = cheerio.load(searchRes.data);
        let potentialMatches = [];

        $('h3.entry-title a, .entry-title a').each((i, el) => {
            const rawLinkText = $(el).text().toLowerCase().trim();
            const yearMatchStr = rawLinkText.match(/\((\d{4})\)/);
            const linkYear = yearMatchStr ? parseInt(yearMatchStr[1]) : null;
            const targetYear = year ? parseInt(year) : null;

            if (targetYear && linkYear && Math.abs(targetYear - linkYear) > 2) return; 

            if (isTitleMatch(rawLinkText, title)) {
                potentialMatches.push({
                    url: $(el).attr('href'),
                    hasAsterisk: rawLinkText.includes('*'),
                    isReview: rawLinkText.includes('review'),
                    yearMatch: (targetYear && linkYear && Math.abs(targetYear - linkYear) <= 1),
                    rawText: rawLinkText
                });
            }
        });

        console.log(`[AfterCredits] Matches Found: ${potentialMatches.length}`);
        if (potentialMatches.length === 0) {
            console.log(`[AfterCredits] Aborting: No valid matches found.`);
            return null;
        }

        potentialMatches.sort((a, b) => {
            if (a.yearMatch !== b.yearMatch) return a.yearMatch ? -1 : 1;
            if (a.hasAsterisk !== b.hasAsterisk) return a.hasAsterisk ? -1 : 1;
            if (a.isReview !== b.isReview) return a.isReview ? 1 : -1;
            return 0;
        });

        const bestMatch = potentialMatches[0];
        console.log(`[AfterCredits] Fetching Payload -> ${bestMatch.url}`);

        const movieRes = await axios.get(bestMatch.url, config);
        const $$ = cheerio.load(movieRes.data);
        let hasMid = false, hasPost = false, bloopers = false;
        
        $$(".spoiler-wrap").each((i, el) => {
            const headText = $$(el).find(".spoiler-head").text().trim().toLowerCase();
            const bodyText = $$(el).text().toLowerCase(); 
            
            if (bodyText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/)) {
                bloopers = true;
            } else if (!bodyText.match(/(no extra|no stinger|nothing|are no|no scene)/)) {
                if (headText.includes("during") || headText.includes("mid")) hasMid = true;
                if (headText.includes("after") || headText.includes("post")) hasPost = true;
            }
        });

        const contentText = $$('article, .entry-content, #main, [rel="tag"]').text().toLowerCase();
        if (contentText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/)) bloopers = true;
        if (bloopers) hasMid = false;

        const isNegative = (!bestMatch.hasAsterisk && !bloopers);
        console.log(`[AfterCredits] Extracted -> Mid: ${hasMid}, Post: ${hasPost}, Negative: ${isNegative}, Bloopers: ${bloopers}`);
        
        return getResultObj(hasMid, hasPost, isNegative, bestMatch.url, 'AfterCredits', bloopers);
    } catch (e) { 
        console.error(`[AfterCredits] Error: ${e.message}`);
        return null; 
    }
}

async function checkMediaStinger(title, year) {
    console.log(`\n--- [MediaStinger] Execution Start: "${title}" (${year}) ---`);
    try {
        const searchUrl = `http://www.mediastinger.com/?s=${encodeURIComponent(title)}`;
        const searchRes = await axios.get(searchUrl, config);
        const $ = cheerio.load(searchRes.data);
        let potentialMatches = [];

        $("h2 a, h3 a, .entry-title a, .title a, .post-title a, ul.highlights li a").each((i, el) => {
            const aTag = $(el);
            const rawLinkText = aTag.text().toLowerCase().trim();
            const yearMatchStr = rawLinkText.match(/\((\d{4})\)/);
            const linkYear = yearMatchStr ? parseInt(yearMatchStr[1]) : null;
            const targetYear = year ? parseInt(year) : null;

            if (targetYear && linkYear && Math.abs(targetYear - linkYear) > 2) return; 

            if (isTitleMatch(rawLinkText, title)) {
                potentialMatches.push({
                    url: aTag.attr('href'),
                    yearMatch: (targetYear && linkYear && Math.abs(targetYear - linkYear) <= 1),
                    rawText: rawLinkText
                });
            }
        });

        console.log(`[MediaStinger] Matches Found: ${potentialMatches.length}`);
        if (potentialMatches.length === 0) {
            console.log(`[MediaStinger] Aborting: No valid matches found.`);
            return null;
        }

        potentialMatches.sort((a, b) => (a.yearMatch !== b.yearMatch ? (a.yearMatch ? -1 : 1) : 0));
        const bestMatch = potentialMatches[0];
        console.log(`[MediaStinger] Fetching Payload -> ${bestMatch.url}`);
        
        let hasMid = false, hasPost = false, noStinger = false, bloopers = false;

        if (bestMatch.url) {
            const movieRes = await axios.get(bestMatch.url, config);
            const $$ = cheerio.load(movieRes.data);
            
            const contentNode = $$('.post_secwrapper, main, article, .article, .post, #content, .entry-content').first();
            const rawHtml = contentNode.html() || '';
            const fullText = cheerio.load(rawHtml.replace(/</g, ' <')).text().toLowerCase().replace(/\s+/g, ' ');

            if (fullText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/)) bloopers = true;

            const midYes = /during (the )?credits\W{1,15}(yes|\d+|extra|scene)/.test(fullText);
            const midNo = /during (the )?credits\W{1,15}no\b/.test(fullText);
            const postYes = /after (the )?credits\W{1,15}(yes|\d+|extra|scene)/.test(fullText);
            const postNo = /after (the )?credits\W{1,15}no\b/.test(fullText);

            if (midYes) hasMid = true;
            if (postYes) hasPost = true;
            if (midNo && postNo) noStinger = true;

            if (!hasMid && !hasPost && !noStinger) {
                if (fullText.includes('no extra scenes') || fullText.includes('are no extras') || fullText.includes('nothing extra') || fullText.includes('no extras after')) {
                    noStinger = true;
                } else {
                    if (/(extra scene|stinger|animation).{0,60}during the credits/.test(fullText)) hasMid = true;
                    if (/(extra scene|stinger).{0,60}after the credits/.test(fullText)) hasPost = true;
                }
            }

            if (hasMid || hasPost || bloopers) noStinger = false;
        }
        
        console.log(`[MediaStinger] Extracted -> Mid: ${hasMid}, Post: ${hasPost}, Negative: ${noStinger}, Bloopers: ${bloopers}`);
        return getResultObj(hasMid, hasPost, noStinger, bestMatch.url, 'MediaStinger', bloopers);
    } catch (e) { 
        console.error(`[MediaStinger] Error: ${e.message}`);
        return null; 
    }
}

async function checkTmdb(imdbId, apiKey) {
    console.log(`\n--- [TMDB] Execution Start: ID ${imdbId} ---`);
    const key = apiKey || DEFAULT_TMDB_KEY;
    try {
        const findRes = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${key}`, config);
        const movieMatch = findRes.data.movie_results?.[0];
        if (!movieMatch) {
            console.log(`[TMDB] Aborting: No movie match found for ID ${imdbId}.`);
            return null;
        }
        
        const tmdbId = Number(movieMatch.id);
        console.log(`[TMDB] TMDB Internal ID found: ${tmdbId}. Fetching keywords...`);
        const kwRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/keywords?api_key=${key}`, config);
        const keywords = kwRes.data.keywords || [];
        
        let hasMid = keywords.some(k => k.name.includes('duringcreditsstinger'));
        let hasPost = keywords.some(k => k.name.includes('aftercreditsstinger'));
        let bloopers = keywords.some(k => k.name.includes('blooper') || k.name.includes('outtake'));
        
        if (bloopers) hasMid = false;

        if (!hasMid && !hasPost && !bloopers) {
            console.log(`[TMDB] No relevant stinger keywords found.`);
            return null;
        }

        console.log(`[TMDB] Keywords Extracted -> Mid: ${hasMid}, Post: ${hasPost}, Bloopers: ${bloopers}`);
        return getResultObj(hasMid, hasPost, false, `https://www.themoviedb.org/movie/${tmdbId}`, 'TMDB', bloopers);
    } catch (e) { 
        console.error(`[TMDB] Error: ${e.message}`);
        return null; 
    }
}


// ==========================================
// 4. EXPRESS APP & API ROUTES
// ==========================================

const serveConfig = (req, res) => res.sendFile(path.join(__dirname, 'index.html'));
app.get('/', serveConfig);
app.get('/configure', serveConfig);

const manifestHandler = (req, res) => {
    res.json({
        id: 'org.stinger.pro',
        version: '1.6.13',
        name: 'Stremio Stinger Pro',
        description: 'Blazing fast mid/post-credit scene detection.',
        logo: 'https://github.com/schultz911/stremio-stinger-pro/blob/main/icon.png?raw=true', 
        types: ['movie'],
        catalogs: [],
        resources: ['stream'],
        idPrefixes: ['tt'],
        behaviorHints: { configurable: true, configurationRequired: false }
    });
};

app.get('/manifest.json', manifestHandler);
app.get('/:p1/manifest.json', manifestHandler);
app.get('/:style/:apiKey/manifest.json', manifestHandler);

const streamHandler = async (req, res) => {
    res.setHeader('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate');

    const { type, id } = req.params;
    if (type !== 'movie') return res.json({ streams: [] });

    console.log(`\n========== NEW REQUEST ==========`);
    console.log(`[Stream] Request Type: ${type} | ID: ${id}`);

    let rawStyle = req.params.style || req.params.p1 || 'colorful';
    let apiKey = req.params.apiKey || (req.params.p1 && !req.params.p1.includes('simple') && !req.params.p1.includes('colorful') ? req.params.p1 : null);

    const styleConfig = {
        style: rawStyle.replace(/-nosource|-bloopers/g, ''),
        showSource: !rawStyle.includes('-nosource'),
        showBloopers: rawStyle.includes('-bloopers')
    };

    const cacheKey = `${id}_${rawStyle}`;
    if (CACHE_TTL > 0 && streamCache.has(cacheKey)) {
        const cached = streamCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[Stream] Cache HIT. Returning payload.`);
            console.log(`=================================\n`);
            return res.json({ streams: [cached.stream] });
        }
    }
    console.log(`[Stream] Cache MISS. Initiating scraper sequence.`);

    try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`);
        const title = metaRes.data?.meta?.name;
        const year = metaRes.data?.meta?.year; 
        console.log(`[Stream] Cinemeta Details -> Title: "${title}", Year: ${year}`);

        if (title) {
            console.log(`[Stream] Firing TIER 1 Race: AfterCredits vs MediaStinger`);
            let result = await new Promise((resolve) => {
                const sources = [ checkAfterCredits(title, year), checkMediaStinger(title, year) ];
                let finished = 0;
                let bestFallback = null;

                sources.forEach(p => {
                    p.then(val => {
                        finished++;
                        if (val) {
                            if (val.mid || val.post) {
                                console.log(`[Tier 1] Positive scene found by ${val.source}. Resolving race early.`);
                                resolve(val); 
                            } else {
                                console.log(`[Tier 1] Potential fallback queued from ${val.source}.`);
                                if (val.bloopers) {
                                    bestFallback = val; 
                                } else if (val.no && (!bestFallback || !bestFallback.bloopers)) {
                                    bestFallback = val;
                                } else if (!bestFallback) {
                                    bestFallback = val;
                                }
                            }
                        }
                        if (finished === sources.length) {
                            console.log(`[Tier 1] All sources finished. Passing best fallback: ${bestFallback ? bestFallback.source : 'None'}`);
                            resolve(bestFallback);
                        }
                    });
                });
                
                setTimeout(() => {
                    console.log(`[Tier 1] 4500ms Hard Timeout reached. Passing best fallback: ${bestFallback ? bestFallback.source : 'None'}`);
                    resolve(bestFallback);
                }, 4500);
            });

            if (!result || (!result.mid && !result.post && !result.bloopers && !result.no)) {
                console.log(`[Stream] Tier 1 yielded no definitive results. Triggering TIER 2: TMDB`);
                const tmdbResult = await checkTmdb(id, apiKey);
                if (tmdbResult) result = tmdbResult; 
            }

            if (!result || (!result.mid && !result.post && !result.bloopers && !result.no)) {
                console.log(`[Stream] Tier 2 yielded no definitive results. Triggering TIER 3: Wikipedia`);
                const wikiResult = await checkWikipedia(title);
                if (wikiResult) result = wikiResult;
            }

            const finalResult = result || { mid: false, post: false, no: false, bloopers: false, url: `https://aftercredits.com/?s=${encodeURIComponent(title)}`, source: 'Aggregated' };
            console.log(`[Stream] Final Resolution -> Source Used: ${finalResult.source}`);

            const stream = {
                name: 'After-Credits Scenes',
                title: `${formatMessage(styleConfig, finalResult)}${styleConfig.showSource ? `\nSource: ${finalResult.source}` : ''}`,
                externalUrl: finalResult.url || `https://aftercredits.com/?s=${encodeURIComponent(title)}`
            };

            streamCache.set(cacheKey, { timestamp: Date.now(), stream });
            console.log(`[Stream] Payload generated and cached. Sequence complete.`);
            console.log(`=================================\n`);
            return res.json({ streams: [stream] });
        }
    } catch (e) { 
        console.error(`[Stream Error] Main Handler Failed: ${e.message}`); 
    }
    
    console.log(`[Stream] Sequence aborted. Returning empty streams.`);
    console.log(`=================================\n`);
    res.json({ streams: [] });
};

app.get('/stream/:type/:id.json', streamHandler);
app.get('/:p1/stream/:type/:id.json', streamHandler);
app.get('/:style/:apiKey/stream/:type/:id.json', streamHandler);

app.listen(process.env.PORT || 7000, () => {
    buildWikiIndex(); 
    console.log('[System] Stremio Stinger Pro initialized.');
});