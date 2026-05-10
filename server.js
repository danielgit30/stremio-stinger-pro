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

// --- State & Caching ---
const streamCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; 
const MAX_CACHE_SIZE = 1000; 

let wikiIndex = new Set();
let wikiLastFetched = 0;
const WIKI_TTL = 24 * 60 * 60 * 1000;

// --- Utilities ---
const normalizeTitle = (title) => {
    return title.toLowerCase()
        .replace(/^(the|a|an)\s+/, '') 
        .replace(/,\s*(the|a|an)$/, '') 
        .replace(/\s*\(.*?\)\s*/g, '') 
        .replace(/[^a-z0-9]/g, '')     
        .trim();
};

const getResultObj = (mid, post, no, url, source, bloopers = false) => ({ mid, post, no, url, source, bloopers });

const formatMessage = (styleConfig, data) => {
    let output = [];
    const isSimple = styleConfig.style === 'simple';

    if (data.source === 'Wikipedia') {
        output.push(isSimple ? "Unclassified Scene" : "❓ Unclassified Scene");
    } else {
        if (isSimple) {
            if (data.mid && data.post) {
                output.push("Mid-Credits Scene\nPost-Credits Scene");
            } else if (data.mid && !data.post) {
                output.push("Mid-Credits Scene");
            } else if (data.post && !data.mid) {
                output.push("Post-Credits Scene");
            } else if (data.no) {
                output.push("No Bonus Scenes");
            } else {
                output.push("No Stingers Found");
            }
        } else {
            if (data.mid && data.post) output.push("🍿 Mid & Post-Credits Scenes");
            else if (data.mid) output.push("⏳ Mid-Credits Scene");
            else if (data.post) output.push("🎬 Post-Credits Scene");
            else if (data.no) output.push("🏃‍♂️ Nothing But Credits");
            else output.push("🕵️‍♂️ Couldn't Find Stingers");
        }
    }

    if (styleConfig.showBloopers && data.bloopers) {
        output.push(isSimple ? "Outtakes Found" : "🎭 Stay For The Outtakes");
    }

    return output.join('\n');
};

// --- Scrapers ---
async function buildWikiIndex() {
    if (Date.now() - wikiLastFetched < WIKI_TTL && wikiIndex.size > 0) return;
    try {
        const res = await axios.get('https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes', config);
        const $ = cheerio.load(res.data);
        const newIndex = new Set();
        
        $("table.wikitable tr").each((i, el) => {
            const titleCell = $(el).find("td").first();
            if (!titleCell.length) return;
            const cleanTitle = normalizeTitle(titleCell.text());
            if (cleanTitle) newIndex.add(cleanTitle);
        });
        
        wikiIndex = newIndex;
        wikiLastFetched = Date.now();
        console.log(`[System] Wikipedia index built: ${wikiIndex.size} entries.`);
    } catch (e) {
        console.error(`[Error] Wikipedia index failed: ${e.message}`);
    }
}

async function checkWikipedia(title) {
    await buildWikiIndex();
    const cleanQuery = normalizeTitle(title);
    if (wikiIndex.has(cleanQuery)) {
        return getResultObj(false, false, false, 'https://en.wikipedia.org/wiki/List_of_films_with_post-credits_scenes', 'Wikipedia');
    }
    return null;
}

async function checkAfterCredits(title, year) {
    try {
        const searchRes = await axios.get(`https://aftercredits.com/?s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        const cleanTargetTitle = normalizeTitle(title);
        
        let targetUrl = null;
        let hasAsterisk = false;
        let exactMatchUrl = null;
        let exactMatchAsterisk = false;

       $('h3.entry-title a, .entry-title a').each((i, el) => {
            if (targetUrl) return false;

            const rawLinkText = $(el).text().toLowerCase().trim();
            if (rawLinkText.includes('review')) return;

            const cleanLinkText = normalizeTitle(rawLinkText);
            const yearMatch = rawLinkText.match(/\((\d{4})\)/);
            const linkYear = yearMatch ? parseInt(yearMatch[1]) : null;
            const targetYear = year ? parseInt(year) : null;

            if (cleanLinkText === cleanTargetTitle) {
                if (targetYear && linkYear && Math.abs(targetYear - linkYear) <= 1) {
                    targetUrl = $(el).attr('href');
                    hasAsterisk = rawLinkText.endsWith('*');
                } else if (!exactMatchUrl) {
                    exactMatchUrl = $(el).attr('href');
                    exactMatchAsterisk = rawLinkText.endsWith('*');
                }
            }
        });

        targetUrl = targetUrl || exactMatchUrl;
        hasAsterisk = targetUrl ? hasAsterisk : exactMatchAsterisk;

        if (!targetUrl) return null;
        if (!hasAsterisk) return getResultObj(false, false, true, targetUrl, 'AfterCredits');

        const movieRes = await axios.get(targetUrl, config);
        const $$ = cheerio.load(movieRes.data);
        let hasMid = false, hasPost = false, bloopers = false;
        
        $$(".spoiler-wrap").each((i, el) => {
            const headText = $$(el).find(".spoiler-head").text().trim().toLowerCase();
            if (headText.includes("during") || headText.includes("mid")) hasMid = true;
            if (headText.includes("after") || headText.includes("post")) hasPost = true;
        });

        const pText = $$('article p, .entry-content p, #main p').text().toLowerCase();
        if (pText.match(/\b(blooper?|outtake?)\b/)) {
            bloopers = true;
        }

        // Global Override: Prevent Bloopers from registering as Mid-Credits
        if (bloopers) {
            hasMid = false;
        }
        
        return getResultObj(hasMid, hasPost, false, targetUrl, 'AfterCredits', bloopers);
    } catch (e) { return null; }
}

async function checkMediaStinger(title, year) {
    try {
        const searchRes = await axios.get(`http://www.mediastinger.com/?tab=MOVIES&s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        const cleanTargetTitle = normalizeTitle(title);
        
        let exactMatchWithYear = null;
        let exactMatch = null;

        $("ul.highlights li").each((i, el) => {
            const rawLinkText = $(el).find("a").first().text().toLowerCase().trim();
            const cleanLinkText = normalizeTitle(rawLinkText);
            
            const yearMatch = rawLinkText.match(/\((\d{4})\)/);
            const linkYear = yearMatch ? parseInt(yearMatch[1]) : null;
            const targetYear = year ? parseInt(year) : null;

            if (cleanLinkText === cleanTargetTitle) {
                if (targetYear && linkYear && Math.abs(targetYear - linkYear) <= 1) {
                    exactMatchWithYear = el;
                    return false; 
                }
                if (!exactMatch) exactMatch = el;
            }
        });

        const finalMatch = exactMatchWithYear || exactMatch;
        if (!finalMatch) return null; 

        const targetUrl = $(finalMatch).find("a").first().attr("href");
        const subtitle = $(finalMatch).find(".subtitle").first().text().trim().toLowerCase();
        
        let hasMid = false;
        let hasPost = false;
        let noStinger = false;
        let bloopers = false;

        if (subtitle.includes("no extra") || subtitle.includes("no scene") || subtitle.includes("are no")) {
            noStinger = true;
        } else {
            if (subtitle.includes("during")) hasMid = true;
            if (subtitle.includes("after")) hasPost = true;
        }

        if (targetUrl) {
            const movieRes = await axios.get(targetUrl, config);
            const $$ = cheerio.load(movieRes.data);
            const pText = $$('article p, #content p, .post-content p, #main p').text().toLowerCase();
            
            if (pText.match(/\b(blooper?|outtake?)\b/)) {
                bloopers = true;
                hasMid = false; 
            }
        }
        
        return getResultObj(hasMid, hasPost, noStinger, targetUrl, 'MediaStinger', bloopers);
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
        version: '1.6.1',
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
            
            // --- TIER 1: The Web Race (AfterCredits & MediaStinger) ---
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

            // --- TIER 2: Metadata Fallback (TMDB) ---
            if (!result || (!result.mid && !result.post && !result.bloopers && !result.no)) {
                const tmdbResult = await checkTmdb(id, apiKey);
                if (tmdbResult) {
                    if (tmdbResult.mid || tmdbResult.post || tmdbResult.bloopers) {
                        result = tmdbResult;
                    } else if (!result) {
                        result = tmdbResult; 
                    }
                }
            }

            // --- TIER 3: Ultimate Fallback (Wikipedia) ---
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