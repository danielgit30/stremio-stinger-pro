const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

// --- Global Config & Helpers ---
const config = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
    timeout: 5000 
};

const DEFAULT_TMDB_KEY = "849503460613279144415848525b682e"; 

const streamCache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000; 
const MAX_CACHE_SIZE = 1000; 

const formatMessage = (style, mid, post, no) => {
    if (style === 'simple') {
        if (no) return "Mid-Credits: No\nPost-Credits: No";
        if (mid || post) return `Mid-Credits: ${mid ? 'Yes' : 'No'}\nPost-Credits: ${post ? 'Yes' : 'No'}`;
        return "No information available.";
    }
    if (mid && post) return '🍿 Mid & Post-Credits Scenes!';
    if (mid) return '⏳ Mid-Credits Scene Only.';
    if (post) return '🎬 Post-Credits Scene Only.';
    if (no) return '🏃‍♂️ Show\'s Over When Credits Roll!';
    return '🕵️‍♂️ No info found yet.';
};

const getResultObj = (mid, post, no, url, source) => {
    if (!mid && !post && !no) return null; 
    return { mid, post, no, url, source };
};

// --- Routing ---
const serveConfig = (req, res) => res.sendFile(path.join(__dirname, 'index.html'));
app.get('/', serveConfig);
app.get('/configure', serveConfig);

const manifestHandler = (req, res) => {
    res.json({
        id: 'org.stinger.pro',
        version: '1.5.0',
        name: 'Stremio Stinger Pro',
        description: 'Detects mid and post-credit scenes instantly.',
        logo: 'https://github.com/schultz911/stremio-stinger-pro/blob/main/icon.png?raw=true', 
        types: ['movie'],
        catalogs: [],
        resources: ['stream'],
        idPrefixes: ['tt'],
        behaviorHints: { configurable: true, configurationRequired: false },
        stremioAddonsConfig: {
            issuer: "https://stremio-addons.net",
            signature: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..n_u_i56Tfdzf0d9bIjfzhg.R0YjWt5F9CnsFb4nAW0u-VZvtsRfGU-NFZplto8hRGt5Z3nausiSD78QYpmec-MTgijYqf9pxE7dNBL4OSmRPt1nmnl3_a_RF0I3CNwiLw5-1Vs7oFKI8JgQrQ7vfd1w.MuVPXQBechXx_LPURQZaaA"
        }
    });
};

// Handle legacy and new URL structures
app.get('/manifest.json', manifestHandler);
app.get('/:p1/manifest.json', manifestHandler);
app.get('/:style/:apiKey/manifest.json', manifestHandler);

// --- Source 1: AfterCredits ---
async function checkAfterCredits(title) {
    try {
        const searchRes = await axios.get(`https://aftercredits.com/?s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        const cleanTargetTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        let targetUrl = null;
        let hasAsterisk = false;

       $('h3.entry-title a, .entry-title a').each((i, el) => {
            const rawLinkText = $(el).text().toLowerCase().trim();
            const cleanLinkText = rawLinkText.replace(/[*|?]/g, '').replace(/[^\w\s]/g, '').trim();
            
            if (!rawLinkText.includes('review') && (cleanLinkText.startsWith(cleanTargetTitle) || cleanLinkText === cleanTargetTitle)) {
                targetUrl = $(el).attr('href');
                hasAsterisk = rawLinkText.endsWith('*');
                return false; 
            }
        });

        if (!targetUrl) return null;
        if (!hasAsterisk) return getResultObj(false, false, true, targetUrl, 'AfterCredits');

        const movieRes = await axios.get(targetUrl, config);
        const $$ = cheerio.load(movieRes.data);
        let hasMid = false, hasPost = false;
        const $$spoilers = $$(".spoiler-wrap");
        
        if ($$spoilers.length > 0) {
            $$spoilers.each((i, el) => {
                const headText = $$(el).find(".spoiler-head").text().trim().toLowerCase();
                if (headText.includes("during") || headText.includes("mid")) hasMid = true;
                if (headText.includes("after") || headText.includes("post")) hasPost = true;
            });
        }
        return getResultObj(hasMid, hasPost, false, targetUrl, 'AfterCredits');
    } catch (e) { return null; }
}

// --- Source 2: MediaStinger ---
async function checkMediaStinger(title) {
    try {
        const searchRes = await axios.get(`http://www.mediastinger.com/?tab=MOVIES&s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        const $result = $("ul.highlights li").first();
        if ($result.length === 0) return null;

        const subtitle = $result.find(".subtitle").first().text().trim().toLowerCase();
        return getResultObj(subtitle.includes("during"), subtitle.includes("after"), subtitle.includes("no"), $result.find("a").first().attr("href"), 'MediaStinger');
    } catch (e) { return null; }
}

// --- Source 3: TMDB ---
async function checkTmdb(imdbId, apiKey) {
    const key = apiKey || DEFAULT_TMDB_KEY;
    try {
        const findRes = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${key}`, config);
        const tmdbId = findRes.data.movie_results?.[0]?.id;
        if (!tmdbId) return null;

        const kwRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/keywords?api_key=${key}`, config);
        const keywords = kwRes.data.keywords || [];
        const hasMid = keywords.some(k => k.name === 'duringcreditsstinger');
        const hasPost = keywords.some(k => k.name === 'aftercreditsstinger');
        
        if (!hasMid && !hasPost) return null;
        return getResultObj(hasMid, hasPost, false, `https://www.themoviedb.org/movie/${tmdbId}`, 'TMDB');
    } catch (e) { return null; }
}

// --- Main Handler ---
const streamHandler = async (req, res) => {
    const { type, id } = req.params;
    let rawStyle = 'colorful';
    let apiKey = null;

    if (req.params.style && req.params.apiKey) {
        rawStyle = req.params.style;
        apiKey = req.params.apiKey;
    } else if (req.params.p1) {
        if (req.params.p1.includes('simple') || req.params.p1.includes('colorful')) {
            rawStyle = req.params.p1;
        } else {
            apiKey = req.params.p1;
        }
    }

    if (type !== 'movie') return res.json({ streams: [] });

    // Parse the compound style string
    const showSource = !rawStyle.includes('-nosource');
    const style = rawStyle.replace('-nosource', '');

    const generateStreamConfig = (resultData, titleStr) => {
        if (resultData) {
            const sourceText = showSource ? `\nSource: ${resultData.source}` : '';
            return {
                name: 'After-Credits Scenes',
                title: `${formatMessage(style, resultData.mid, resultData.post, resultData.no)}${sourceText}`,
                externalUrl: resultData.url
            };
        } else {
            const fallbackLinkText = showSource ? `\nCheck manually at AfterCredits.com` : '';
            return {
                name: 'After-Credits Scenes',
                title: style === 'simple' ? `Status: Unknown${fallbackLinkText}` : `🕵️‍♂️ No info found yet.${fallbackLinkText}`,
                externalUrl: `https://aftercredits.com/?s=${encodeURIComponent(titleStr)}`
            };
        }
    };

    if (streamCache.has(id)) {
        const cachedData = streamCache.get(id);
        if (Date.now() - cachedData.timestamp < CACHE_TTL) {
            return res.json({ streams: [generateStreamConfig(cachedData.result, null)] });
        }
        streamCache.delete(id);
    }

    try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`);
        const title = metaRes.data?.meta?.name;

        if (title) {
            const result = await new Promise((resolve) => {
                const sources = [
                    checkAfterCredits(title),
                    checkMediaStinger(title),
                    checkTmdb(id, apiKey) 
                ];

                let finished = 0;
                let negativeFallback = null;

                sources.forEach(p => {
                    p.then(val => {
                        finished++;
                        if (val) {
                            if (val.mid || val.post) resolve(val);
                            else if (val.no) if (!negativeFallback) negativeFallback = val;
                        }
                        if (finished === sources.length) resolve(negativeFallback); 
                    });
                });
                
                setTimeout(() => resolve(negativeFallback), 5500);
            });

            if (result) {
                if (streamCache.size >= MAX_CACHE_SIZE) streamCache.delete(streamCache.keys().next().value);
                streamCache.set(id, { timestamp: Date.now(), result: result });
            }

            return res.json({ streams: [generateStreamConfig(result, title)] });
        }
    } catch (error) {
        console.error(`[Error] ${error.message}`);
    }

    res.json({ streams: [] });
};

app.get('/stream/:type/:id.json', streamHandler);
app.get('/:p1/stream/:type/:id.json', streamHandler);
app.get('/:style/:apiKey/stream/:type/:id.json', streamHandler);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Active on port ${PORT}`));