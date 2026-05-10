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
    timeout: 8000 
};
const DEFAULT_TMDB_KEY = "dc0aefa944df1ef858fafd8085d2e60f"; 

const streamCache = new Map();
const CACHE_TTL_SUCCESS = 30 * 60 * 1000; 
const CACHE_TTL_ERROR = 60 * 1000;        

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

    if (clean(tLink) === clean(tTarget)) return true;

    const safeSuffixes = /^(blooper|bloopers|outtake|outtakes|extra|extras|and|or|with|scene|scenes|credit|credits|stinger|stingers|review|reviews|post|mid|after|end|during|the|is|a|an|there|are|movie|film|\s)+$/;
    
    if (tTarget.length > 0 && clean(tLink).startsWith(clean(tTarget))) {
        const remainder = clean(tLink).substring(clean(tTarget).length).trim();
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

const getResultObj = (mid, post, no, url, source, bloopers = false, definitive = false) => {
    return { mid, post, no, url, source, bloopers, definitive };
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

async function buildWikiIndex(reqConfig = config) {
    if (Date.now() - wikiLastFetched < WIKI_TTL && wikiCache.size > 0) return;
    try {
        console.log(`[Wiki] Building index...`);
        const res = await axios.get('https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes', reqConfig);
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
            
            newCache.set(cleanTitle, { mid: hasMid, post: hasPost, bloopers: hasBloopers });
        });
        
        wikiCache = newCache;
        wikiLastFetched = Date.now();
        console.log(`[Wiki] Built ${wikiCache.size} entries.`);
    } catch (e) {
        if (e.name !== 'CanceledError' && e.message !== 'canceled') console.error(`[Wiki Error] ${e.message}`);
    }
}

async function checkWikipedia(title, reqConfig) {
    console.log(`\n--- [Wikipedia] Execution Start: "${title}" ---`);
    await buildWikiIndex(reqConfig);
    const cleanQuery = wikiNormalize(title);
    if (wikiCache.has(cleanQuery)) {
        const data = wikiCache.get(cleanQuery);
        console.log(`[Wikipedia] Match -> Mid: ${data.mid}, Post: ${data.post}, Bloopers: ${data.bloopers}`);
        return getResultObj(data.mid, data.post, false, 'https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes', 'Wikipedia', data.bloopers);
    }
    console.log(`[Wikipedia] No match found.`);
    return null;
}

async function checkAfterCredits(title, year, reqConfig) {
    console.log(`\n--- [AfterCredits] Execution Start: "${title}" (${year}) ---`);
    try {
        // Targeted query with replaced spaces
        const searchUrl = `https://aftercredits.com/?s=${encodeURIComponent(year ? `${title} ${year}` : title).replace(/%20/g, '+')}`;
        console.log(`[AfterCredits] Query URL: ${searchUrl}`);
        
        const searchRes = await axios.get(searchUrl, reqConfig);
        const $ = cheerio.load(searchRes.data);
        let potentialMatches = [];

        $("h2 a, h3 a, .entry-title a, .title a, .post-title a").each((i, el) => {
            const rawLinkText = $(el).text().toLowerCase().trim();
            if (!rawLinkText) return;

            const yearMatchStr = rawLinkText.match(/\((\d{4})\)/);
            const linkYear = yearMatchStr ? parseInt(yearMatchStr[1]) : null;
            const targetYear = year ? parseInt(year) : null;

            if (targetYear && linkYear && Math.abs(targetYear - linkYear) > 2) return; 

            if (isTitleMatch(rawLinkText, title)) {
                potentialMatches.push({
                    url: $(el).attr('href'),
                    yearMatch: (targetYear && linkYear && Math.abs(targetYear - linkYear) <= 2),
                    rawText: rawLinkText
                });
            }
        });

        if (potentialMatches.length === 0) {
            console.log(`[AfterCredits] Aborting: No match found on search page.`);
            return null;
        }

        // Sort for closest year match
        potentialMatches.sort((a, b) => (a.yearMatch !== b.yearMatch ? (a.yearMatch ? -1 : 1) : 0));
        const bestMatch = potentialMatches[0];
        console.log(`[AfterCredits] Fetching -> ${bestMatch.url} (Text: "${bestMatch.rawText}")`);
        
        const movieRes = await axios.get(bestMatch.url, reqConfig);
        const $$ = cheerio.load(movieRes.data);
        
        let catMid = false, catPost = false, catBloopers = false, checkContainer = false;
        let verMid = false, verPost = false, verBloopers = false;

        // 1. Extract and Evaluate CMS Category Tags
        let categoryTags = [];
        $$('ul.td-category li.entry-category a').each((i, el) => {
            categoryTags.push($$(el).text().trim().toLowerCase());
        });
        console.log(`[AfterCredits] Categories Found: [${categoryTags.join(', ')}]`);

        // Explicit "Non-Stingers" Definitive Halt
        if (categoryTags.includes('non-stingers')) {
            console.log(`[AfterCredits] 'non-stingers' detected. Returning definitive negative state.`);
            return getResultObj(false, false, true, bestMatch.url, 'AfterCredits', false, true);
        }

        // Map Categories to Initial Expectations
        if (categoryTags.includes('after credits')) catPost = true;
        if (categoryTags.includes('during credits')) catMid = true;
        if (categoryTags.includes('both during & after credits')) { catMid = true; catPost = true; }
        if (categoryTags.some(t => ['blooper', 'outtake', 'musical'].includes(t))) catBloopers = true;
        if (categoryTags.some(t => ['bonus scene', 'credits clip', 'humorous credit', 'informative'].includes(t))) checkContainer = true;

        // 2. Parse Body Containers for Verification
        console.log(`[AfterCredits] Verifying category tags against body containers...`);
        $$(".spoiler-wrap").each((i, el) => {
            const headText = $$(el).find(".spoiler-head").text().trim().toLowerCase();
            const blockText = $$(el).text().toLowerCase(); 
            
            const isBlooper = blockText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/);
            // Audio check: ensures we don't flag "audio stingers" as visual scenes
            const isAudioOnly = /\b(audio|voice|hear|heard|message)\b/.test(blockText) && !/\b(scene|shot|video|visual|see|shows)\b/.test(blockText);
            const isNegative = blockText.match(/(no extra|no stinger|nothing|are no|no scene)/) && !blockText.match(/(extra shot|laugh|but|however)/);

            if (headText.includes("during") || headText.includes("mid")) {
                if (isBlooper) verBloopers = true;
                else if (!isNegative && !isAudioOnly) verMid = true;
            }

            if (headText.includes("after") || headText.includes("post")) {
                if (isBlooper) verBloopers = true;
                else if (!isNegative && !isAudioOnly) verPost = true;
            }
        });

        // 3. Synthesis: Verify Category Claims against Body Reality
        let finalMid = false, finalPost = false, finalBloopers = false;

        // If category is generic, rely purely on body verification
        if (checkContainer) {
            finalMid = verMid;
            finalPost = verPost;
            finalBloopers = verBloopers || catBloopers;
        } else {
            // Verify specific category claims. If tagged "After Credits", body MUST confirm it.
            if (catMid && verMid) finalMid = true;
            if (catPost && verPost) finalPost = true;
            if (catBloopers || verBloopers) finalBloopers = true;
        }

        const isNegative = (!finalMid && !finalPost && !finalBloopers);
        const isDefinitive = (finalMid || finalPost || finalBloopers); 
        
        console.log(`[AfterCredits] Result -> Mid: ${finalMid}, Post: ${finalPost}, Negative: ${isNegative}, Bloopers: ${finalBloopers}, Definitive: ${isDefinitive}`);
        return getResultObj(finalMid, finalPost, isNegative, bestMatch.url, 'AfterCredits', finalBloopers, isDefinitive);

    } catch (e) { 
        if (e.name !== 'CanceledError' && e.message !== 'canceled') console.error(`[AfterCredits Error] ${e.message}`);
        return null; 
    }
}

async function checkMediaStinger(title, year, reqConfig) {
    console.log(`\n--- [MediaStinger] Execution Start: "${title}" (${year}) ---`);
    try {
        const searchUrl = `http://www.mediastinger.com/?s=${encodeURIComponent(title)}`;
        const searchRes = await axios.get(searchUrl, reqConfig);
        const $ = cheerio.load(searchRes.data);
        let potentialMatches = [];

        $("h2 a, h3 a, .entry-title a, .title a, .post-title a, ul.highlights li a").each((i, el) => {
            const rawLinkText = $(el).text().toLowerCase().trim();
            if (!rawLinkText) return;

            const yearMatchStr = rawLinkText.match(/\((\d{4})\)/);
            const linkYear = yearMatchStr ? parseInt(yearMatchStr[1]) : null;
            const targetYear = year ? parseInt(year) : null;

            if (targetYear && linkYear && Math.abs(targetYear - linkYear) > 2) return; 

            if (isTitleMatch(rawLinkText, title)) {
                potentialMatches.push({
                    url: $(el).attr('href'),
                    yearMatch: (targetYear && linkYear && Math.abs(targetYear - linkYear) <= 2)
                });
            }
        });

        if (potentialMatches.length === 0) {
            console.log(`[MediaStinger] Aborting: No match within boundaries.`);
            return null;
        }

        potentialMatches.sort((a, b) => (a.yearMatch !== b.yearMatch ? (a.yearMatch ? -1 : 1) : 0));
        const bestMatch = potentialMatches[0];
        console.log(`[MediaStinger] Fetching -> ${bestMatch.url}`);
        
        const movieRes = await axios.get(bestMatch.url, reqConfig);
        const $$ = cheerio.load(movieRes.data);
        
        let seoMid = false, seoPost = false, seoBloopers = false, seoNo = false;
        let verMid = false, verPost = false, verBloopers = false;
        
        // 1. Explicit SEO Header Parsing
        const seoText = $$('.groupingforseo').text().toLowerCase();
        if (seoText) {
            console.log(`[MediaStinger] SEO Header Found: "${seoText}"`);
            // Explicit negation search
            if (seoText.match(/\b(no|zero)\b/)) {
                console.log(`[MediaStinger] SEO Header negation detected.`);
                seoNo = true;
            } else {
                if (seoText.includes('during') || seoText.includes('mid')) seoMid = true;
                if (seoText.includes('after') || seoText.includes('post')) seoPost = true;
                if (seoText.includes('blooper') || seoText.includes('outtake')) seoBloopers = true;
            }
        }

        // 2. Parse Body Text for Verification
        console.log(`[MediaStinger] Verifying headers against body context...`);
        const contentNode = $$('.post_secwrapper, main, article, .article, .post, #content, .entry-content').first();
        const rawHtml = contentNode.html() || '';
        const fullText = cheerio.load(rawHtml.replace(/</g, ' <')).text().toLowerCase().replace(/\s+/g, ' ');

        if (fullText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/)) verBloopers = true;

        const midYes = /during (the )?credits\W{1,30}(yes|\d+|extra|scene|\bshots?\b)/.test(fullText);
        const postYes = /after (the )?credits\W{1,30}(yes|\d+|extra|scene|\bshots?\b)/.test(fullText);
        
        const legacyMidYes = /(extra scene|stinger|animation|extra shot|shot).{0,60}during the credits/.test(fullText);
        const legacyPostYes = /(extra scene|stinger|extra shot|shot).{0,60}after the credits/.test(fullText);

        const isAudio = (keyword) => {
            const idx = fullText.indexOf(keyword);
            if (idx === -1) return false;
            const context = fullText.substring(Math.max(0, idx - 80), Math.min(fullText.length, idx + 120));
            return /\b(audio|voice|hear|heard|message)\b/.test(context) && !/\b(scene|scenes|shot|shots|visual)\b/.test(context);
        };

        if ((midYes || legacyMidYes) && !isAudio('during')) verMid = true;
        if ((postYes || legacyPostYes) && !isAudio('after')) verPost = true;

        // 3. Synthesis: Cross-reference SEO with verified Body state
        let finalMid = false, finalPost = false, finalBloopers = false;

        // If SEO was positive, body MUST confirm. If SEO was missing/blank, rely on body.
        if (seoMid && verMid) finalMid = true;
        else if (!seoText && verMid) finalMid = true;

        if (seoPost && verPost) finalPost = true;
        else if (!seoText && verPost) finalPost = true;

        if (seoBloopers || verBloopers) finalBloopers = true;

        // Final Negative Routing
        let noStinger = false;
        const midNo = /during (the )?credits\W{1,30}no\b/.test(fullText);
        const postNo = /after (the )?credits\W{1,30}no\b/.test(fullText);
        const legacyMidNo = /(no|zero) (extra|scene|stinger).{0,40}during the credits/.test(fullText);
        const legacyPostNo = /(no|zero) (extra|scene|stinger).{0,40}after the credits/.test(fullText);

        if ((midNo && postNo) || (legacyMidNo && legacyPostNo) || seoNo) noStinger = true;
        if (!finalMid && !finalPost && (fullText.includes('no extra scenes') || fullText.includes('are no extras'))) noStinger = true;

        if (finalMid || finalPost || finalBloopers) noStinger = false;
        
        console.log(`[MediaStinger] Result -> Mid: ${finalMid}, Post: ${finalPost}, Negative: ${noStinger}, Bloopers: ${finalBloopers}`);
        return getResultObj(finalMid, finalPost, noStinger, bestMatch.url, 'MediaStinger', finalBloopers);

    } catch (e) { 
        if (e.name !== 'CanceledError' && e.message !== 'canceled') console.error(`[MediaStinger Error] ${e.message}`);
        return null; 
    }
}

async function checkTmdb(imdbId, apiKey, reqConfig) {
    console.log(`\n--- [TMDB] Execution Start: ID ${imdbId} ---`);
    const key = apiKey || DEFAULT_TMDB_KEY;
    try {
        const findRes = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${key}`, reqConfig);
        const movieMatch = findRes.data.movie_results?.[0];
        if (!movieMatch) {
            console.log(`[TMDB] No match found.`);
            return null;
        }
        
        const tmdbId = Number(movieMatch.id);
        const kwRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/keywords?api_key=${key}`, reqConfig);
        const keywords = kwRes.data.keywords || [];
        
        let hasMid = keywords.some(k => k.name.includes('duringcreditsstinger'));
        let hasPost = keywords.some(k => k.name.includes('aftercreditsstinger'));
        let bloopers = keywords.some(k => k.name.includes('blooper') || k.name.includes('outtake'));
        
        if (!hasMid && !hasPost && !bloopers) {
            console.log(`[TMDB] No stinger keywords found.`);
            return null;
        }

        console.log(`[TMDB] Match -> Mid: ${hasMid}, Post: ${hasPost}, Bloopers: ${bloopers}`);
        return getResultObj(hasMid, hasPost, false, `https://www.themoviedb.org/movie/${tmdbId}`, 'TMDB', bloopers);
    } catch (e) { 
        if (e.name !== 'CanceledError' && e.message !== 'canceled') console.error(`[TMDB Error] ${e.message}`);
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
        version: '1.8.0',
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
    if (streamCache.has(cacheKey)) {
        const cached = streamCache.get(cacheKey);
        if (Date.now() < cached.expiresAt) {
            console.log(`[Stream] Cache HIT. Resolving from memory.`);
            return res.json({ streams: [cached.stream] });
        } else {
            streamCache.delete(cacheKey);
        }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    const reqConfig = { ...config, signal: controller.signal };

    try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`, reqConfig);
        const title = metaRes.data?.meta?.name;
        const year = metaRes.data?.meta?.year; 

        if (title) {
            console.log(`[Stream] Target: "${title}" (${year})`);
            
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

            // Tier 1: AfterCredits
            let acResult = await checkAfterCredits(title, year, reqConfig);
            if (acResult && acResult.definitive) {
                console.log(`[Stream] Definitive state achieved by AfterCredits. Short-circuiting sequence.`);
                finalResult = acResult;
            } else {
                updateFallback(acResult);
                
                // Tier 2: MediaStinger
                let msResult = await checkMediaStinger(title, year, reqConfig);
                if (msResult && (msResult.mid || msResult.post || msResult.bloopers)) {
                    console.log(`[Stream] Positive scene verified by MediaStinger.`);
                    finalResult = msResult;
                } else {
                    updateFallback(msResult);

                    // Tier 3: TMDB
                    let tmdbResult = await checkTmdb(id, apiKey, reqConfig);
                    if (tmdbResult && (tmdbResult.mid || tmdbResult.post || tmdbResult.bloopers)) {
                        console.log(`[Stream] Positive scene found by TMDB.`);
                        finalResult = tmdbResult;
                    } else {
                        updateFallback(tmdbResult);

                        // Tier 4: Wikipedia
                        let wikiResult = await checkWikipedia(title, reqConfig);
                        if (wikiResult && (wikiResult.mid || wikiResult.post || wikiResult.bloopers)) {
                            console.log(`[Stream] Positive scene found by Wikipedia.`);
                            finalResult = wikiResult;
                        } else {
                            updateFallback(wikiResult);
                        }
                    }
                }
            }

            const isAggregatedError = !finalResult && !bestFallback;
            const resolvedResult = finalResult || bestFallback || { mid: false, post: false, no: false, bloopers: false, url: `https://aftercredits.com/?s=${encodeURIComponent(title).replace(/%20/g, '+')}`, source: 'Aggregated' };

            console.log(`[Stream] Final Resolution -> Source Used: ${resolvedResult.source}`);

            const stream = {
                name: 'After-Credits Scenes',
                title: `${formatMessage(styleConfig, resolvedResult)}${styleConfig.showSource ? `\nSource: ${resolvedResult.source}` : ''}`,
                externalUrl: resolvedResult.url || `https://aftercredits.com/?s=${encodeURIComponent(title).replace(/%20/g, '+')}`
            };

            const cacheDuration = isAggregatedError ? CACHE_TTL_ERROR : CACHE_TTL_SUCCESS;
            streamCache.set(cacheKey, { expiresAt: Date.now() + cacheDuration, stream });
            
            console.log(`[Stream] Payload generated and cached. Sequence complete.`);
            console.log(`=================================\n`);
            return res.json({ streams: [stream] });
        }
    } catch (e) { 
        if (e.name !== 'CanceledError' && e.message !== 'canceled') {
            console.error(`[Stream Error] Main Handler Failed: ${e.message}`); 
        }
    } finally {
        clearTimeout(timeoutId);
        controller.abort();
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