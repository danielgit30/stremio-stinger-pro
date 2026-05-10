const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

// --- Configuration ---
const config = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
    timeout: 5000 
};
const DEFAULT_TMDB_KEY = "849503460613279144415848525b682e"; 

// --- Utilities ---
const isTitleMatch = (linkText, targetTitle) => {
    let tLink = linkText.toLowerCase().replace(/\(\d{4}\)/g, '').trim();
    let tTarget = targetTitle.toLowerCase().trim();

    const clean = (str) => {
        let s = str.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        s = s.replace(/^(the|a|an)\s+/i, '').replace(/\s+(the|a|an)$/i, ''); 
        return s.trim();
    };

    tLink = clean(tLink);
    tTarget = clean(tTarget);

    if (tLink === tTarget) return true;

    const safeSuffixes = /^(blooper|bloopers|outtake|outtakes|extra|extras|and|or|with|scene|scenes|credit|credits|stinger|stingers|review|reviews|post|mid|after|end|\s)+$/;
    
    if (tTarget.length > 0 && tLink.startsWith(tTarget)) {
        const remainder = tLink.substring(tTarget.length).trim();
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

const getResultObj = (mid, post, no, url, source, bloopers = false) => ({ mid, post, no, url, source, bloopers });

const formatMessage = (styleConfig, data) => {
    let output = [];
    const isSimple = styleConfig.style === 'simple';

    if (isSimple) {
        if (data.mid && data.post) output.push("Mid-Credits Scene\nPost-Credits Scene");
        else if (data.mid) output.push("Mid-Credits Scene");
        else if (data.post) output.push("Post-Credits Scene");
        else if (!data.bloopers || !styleConfig.showBloopers) { 
            if (data.no || (data.bloopers && !styleConfig.showBloopers)) output.push("No Bonus Scenes");
            else output.push("No Stingers Found");
        }
    } else {
        if (data.mid && data.post) output.push("🍿 Mid & Post-Credits Scenes");
        else if (data.mid) output.push("⏳ Mid-Credits Scene");
        else if (data.post) output.push("🎬 Post-Credits Scene");
        else if (!data.bloopers || !styleConfig.showBloopers) { 
            if (data.no || (data.bloopers && !styleConfig.showBloopers)) output.push("🏃‍♂️ Nothing But Credits");
            else output.push("🕵️‍♂️ Couldn't Find Stingers");
        }
    }

    if (styleConfig.showBloopers && data.bloopers) {
        output.push(isSimple ? "Outtakes Found" : "🎭 Stay For The Outtakes");
    }

    if (data.source === 'Wikipedia' && !data.mid && !data.post && !data.bloopers) {
        output = [isSimple ? "Unclassified Scene" : "❓ Unclassified Scene"];
    }

    return output.join('\n');
};

// --- Scrapers ---
async function checkAfterCredits(title, year) {
    try {
        const searchRes = await axios.get(`https://aftercredits.com/?s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        
        let potentialMatches = [];
        $('h3.entry-title a, .entry-title a').each((i, el) => {
            const rawLinkText = $(el).text().toLowerCase().trim();
            const yearMatchStr = rawLinkText.match(/\((\d{4})\)/);
            const linkYear = yearMatchStr ? parseInt(yearMatchStr[1]) : null;
            const targetYear = year ? parseInt(year) : null;

            // Strict Year Check: Discard if both years known and diff > 2
            if (targetYear && linkYear && Math.abs(targetYear - linkYear) > 2) return;

            if (isTitleMatch(rawLinkText, title)) {
                potentialMatches.push({
                    url: $(el).attr('href'),
                    hasAsterisk: rawLinkText.includes('*'),
                    isReview: rawLinkText.includes('review'),
                    yearMatch: (targetYear && linkYear && Math.abs(targetYear - linkYear) <= 1)
                });
            }
        });

        // Priority Sort: Year Match > Asterisk > Review Status
        potentialMatches.sort((a, b) => {
            if (a.yearMatch !== b.yearMatch) return a.yearMatch ? -1 : 1;
            if (a.hasAsterisk !== b.hasAsterisk) return a.hasAsterisk ? -1 : 1;
            if (a.isReview !== b.isReview) return a.isReview ? 1 : -1;
            return 0;
        });

        if (potentialMatches.length === 0) return null;

        const bestMatch = potentialMatches[0];
        const movieRes = await axios.get(bestMatch.url, config);
        const $$ = cheerio.load(movieRes.data);
        let hasMid = false, hasPost = false, bloopers = false;
        
        $$(".spoiler-wrap").each((i, el) => {
            const headText = $$(el).find(".spoiler-head").text().trim().toLowerCase();
            const bodyText = $$(el).text().toLowerCase(); 
            if (bodyText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/)) bloopers = true;
            else if (!bodyText.match(/(no extra|no stinger|nothing|are no|no scene)/)) {
                if (headText.includes("during") || headText.includes("mid")) hasMid = true;
                if (headText.includes("after") || headText.includes("post")) hasPost = true;
            }
        });

        const contentText = $$('article, .entry-content, #main, [rel="tag"]').text().toLowerCase();
        if (contentText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/)) bloopers = true;
        if (bloopers) hasMid = false;

        return getResultObj(hasMid, hasPost, (!bestMatch.hasAsterisk && !bloopers), bestMatch.url, 'AfterCredits', bloopers);
    } catch (e) { return null; }
}

async function checkMediaStinger(title, year) {
    try {
        const searchRes = await axios.get(`http://www.mediastinger.com/?tab=MOVIES&s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        
        let potentialMatches = [];
        $("ul.highlights li").each((i, el) => {
            const aTag = $(el).find("a").first();
            const rawLinkText = aTag.text().toLowerCase().trim();
            const yearMatchStr = rawLinkText.match(/\((\d{4})\)/);
            const linkYear = yearMatchStr ? parseInt(yearMatchStr[1]) : null;
            const targetYear = year ? parseInt(year) : null;

            if (targetYear && linkYear && Math.abs(targetYear - linkYear) > 2) return;

            if (isTitleMatch(rawLinkText, title)) {
                potentialMatches.push({
                    url: aTag.attr('href'),
                    subtitle: $(el).find(".subtitle").first().text().trim().toLowerCase(),
                    yearMatch: (targetYear && linkYear && Math.abs(targetYear - linkYear) <= 1)
                });
            }
        });

        potentialMatches.sort((a, b) => (a.yearMatch !== b.yearMatch ? (a.yearMatch ? -1 : 1) : 0));

        if (potentialMatches.length === 0) return null;

        const bestMatch = potentialMatches[0];
        let hasMid = bestMatch.subtitle.includes("during"), hasPost = bestMatch.subtitle.includes("after"), noStinger = bestMatch.subtitle.includes("no extra") || bestMatch.subtitle.includes("no scene"), bloopers = false;

        if (bestMatch.url) {
            const movieRes = await axios.get(bestMatch.url, config);
            const $$ = cheerio.load(movieRes.data);
            const contentText = $$('article, #content, [rel="tag"]').text().toLowerCase();
            if (contentText.match(/\b(bloopers?|outtakes?|gags?|gag reel)\b/)) { bloopers = true; hasMid = false; }
        }
        
        return getResultObj(hasMid, hasPost, noStinger, bestMatch.url, 'MediaStinger', bloopers);
    } catch (e) { return null; }
}

async function checkTmdb(imdbId, apiKey) {
    const key = apiKey || DEFAULT_TMDB_KEY;
    try {
        const findRes = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${key}`, config);
        const movieMatch = findRes.data.movie_results?.[0];
        if (!movieMatch) return null;
        
        const tmdbId = Number(movieMatch.id);
        const kwRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/keywords?api_key=${key}`, config);
        const keywords = kwRes.data.keywords || [];
        
        let hasMid = keywords.some(k => k.name.includes('duringcreditsstinger'));
        let hasPost = keywords.some(k => k.name.includes('aftercreditsstinger'));
        let bloopers = keywords.some(k => k.name.includes('blooper') || k.name.includes('outtake'));
        
        if (bloopers) hasMid = false;

        if (!hasMid && !hasPost && !bloopers) return null;

        return getResultObj(hasMid, hasPost, false, `https://www.themoviedb.org/movie/${tmdbId}`, 'TMDB', bloopers);
    } catch (e) { return null; }
}

// --- Express Routes ---
const serveConfig = (req, res) => res.sendFile(path.join(__dirname, 'index.html'));
app.get('/', serveConfig);
app.get('/configure', serveConfig);

const manifestHandler = (req, res) => {
    res.json({
        id: 'org.stinger.pro',
        version: '1.6.4',
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
        if (Date.now() - cached.timestamp < CACHE_TTL) return res.json({ streams: [cached.stream] });
    }

    try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`);
        const title = metaRes.data?.meta?.name;
        const year = metaRes.data?.meta?.year; 

        if (title) {
            
            let result = await new Promise((resolve) => {
                const sources = [
                    checkAfterCredits(title, year),
                    checkMediaStinger(title, year)
                ];

                let finished = 0;
                let bestFallback = null;

                sources.forEach(p => {
                    p.then(val => {
                        finished++;
                        if (val) {
                            if (val.mid || val.post) {
                                resolve(val); 
                            } else {
                                if (val.bloopers) bestFallback = val; 
                                else if (val.no && (!bestFallback || !bestFallback.bloopers)) bestFallback = val;
                            }
                        }
                        if (finished === sources.length) resolve(bestFallback);
                    });
                });
                
                setTimeout(() => resolve(bestFallback), 4500);
            });

            if (!result || (!result.mid && !result.post && !result.bloopers && !result.no)) {
                const tmdbResult = await checkTmdb(id, apiKey);
                if (tmdbResult) {
                    result = tmdbResult; 
                }
            }

            if (!result || (!result.mid && !result.post && !result.bloopers && !result.no)) {
                const wikiResult = await checkWikipedia(title);
                if (wikiResult) {
                    result = wikiResult;
                }
            }

            let finalResult = result || { mid: false, post: false, no: false, bloopers: false, url: `https://aftercredits.com/?s=${encodeURIComponent(title)}`, source: 'Aggregated' };

            const stream = {
                name: 'After-Credits Scenes',
                title: `${formatMessage(styleConfig, finalResult)}${styleConfig.showSource ? `\nSource: ${finalResult.source}` : ''}`,
                externalUrl: finalResult.url || `https://aftercredits.com/?s=${encodeURIComponent(title)}`
            };

            streamCache.set(cacheKey, { timestamp: Date.now(), stream });
            return res.json({ streams: [stream] });
        }
    } catch (e) { console.error(`[Stream Error] ${e.message}`); }
    
    res.json({ streams: [] });
};

app.get('/stream/:type/:id.json', streamHandler);
app.get('/:p1/stream/:type/:id.json', streamHandler);
app.get('/:style/:apiKey/stream/:type/:id.json', streamHandler);

app.listen(process.env.PORT || 7000, () => {
    buildWikiIndex(); 
});