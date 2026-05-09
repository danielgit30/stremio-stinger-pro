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

const normalizeTitle = (title) => {
    return title.toLowerCase()
        .replace(/^(the|a|an)\s+/, '') 
        .replace(/,\s*(the|a|an)$/, '') 
        .replace(/[^\w]/g, '') 
        .trim();
};

const formatMessage = (styleConfig, data) => {
    let output = [];

    if (styleConfig.style === 'simple') {
        if (data.no) {
            output.push("Mid-Credits: No\nPost-Credits: No");
        } else if (data.mid || data.post) {
            output.push(`Mid-Credits: ${data.mid ? 'Yes' : 'No'}\nPost-Credits: ${data.post ? 'Yes' : 'No'}`);
        } else {
            output.push("Status: Unknown");
        }

        if (styleConfig.showBloopers && data.bloopers) output.push("Bloopers: Yes");
        if (styleConfig.showPrequels && data.prequel) output.push(`Follows: ${data.prequel}`);
        if (styleConfig.showSequels && (data.willReturn || data.sequel)) {
            output.push(`Sequel: ${data.sequel ? data.sequel : 'Announced/Will Return'}`);
        }
    } else {
        if (data.mid && data.post) output.push('🍿 Mid & Post-Credits Scenes!');
        else if (data.mid) output.push('⏳ Mid-Credits Scene Only.');
        else if (data.post) output.push('🎬 Post-Credits Scene Only.');
        else if (data.no) output.push('🏃‍♂️ Show\'s Over When Credits Roll!');
        else output.push('🕵️‍♂️ No info found yet.');

        if (styleConfig.showBloopers && data.bloopers) output.push("🤣 Bloopers / Outtakes: Yes");
        if (styleConfig.showPrequels && data.prequel) output.push(`⏪ Follows: ${data.prequel}`);
        if (styleConfig.showSequels && (data.willReturn || data.sequel)) {
            output.push(`🔄 Sequel / 'Will Return': ${data.sequel ? data.sequel : 'Yes'}`);
        }
    }

    return output.join('\n');
};

const getResultObj = (mid, post, no, url, source, bloopers = false, willReturn = false, prequel = null, sequel = null) => {
    return { mid, post, no, url, source, bloopers, willReturn, prequel, sequel };
};

// --- Routing ---
const serveConfig = (req, res) => res.sendFile(path.join(__dirname, 'index.html'));
app.get('/', serveConfig);
app.get('/configure', serveConfig);

const manifestHandler = (req, res) => {
    res.json({
        id: 'org.stinger.pro',
        version: '1.8.1',
        name: 'Stremio Stinger Pro',
        description: 'Detects mid/post-credit scenes, bloopers, prequels, and sequels.',
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

app.get('/manifest.json', manifestHandler);
app.get('/:p1/manifest.json', manifestHandler);
app.get('/:style/:apiKey/manifest.json', manifestHandler);

// --- Sources ---
async function checkAfterCredits(title) {
    try {
        const searchRes = await axios.get(`https://aftercredits.com/?s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        const cleanTargetTitle = normalizeTitle(title);
        let targetUrl = null;
        let hasAsterisk = false;

       $('h3.entry-title a, .entry-title a').each((i, el) => {
            const rawLinkText = $(el).text().toLowerCase().trim();
            const cleanLinkText = normalizeTitle(rawLinkText.replace(/[*|?]/g, ''));
            
            if (!rawLinkText.includes('review') && (cleanLinkText.startsWith(cleanTargetTitle) || cleanTargetTitle.startsWith(cleanLinkText))) {
                targetUrl = $(el).attr('href');
                hasAsterisk = rawLinkText.endsWith('*');
                return false; 
            }
        });

        if (!targetUrl) return null;
        if (!hasAsterisk) return getResultObj(false, false, true, targetUrl, 'AfterCredits');

        const movieRes = await axios.get(targetUrl, config);
        const $$ = cheerio.load(movieRes.data);
        let hasMid = false, hasPost = false, bloopers = false, willReturn = false;
        
        const rawContent = $$('article, .entry-content').text().toLowerCase();
        if (rawContent.includes('blooper') || rawContent.includes('outtake')) bloopers = true;
        if (rawContent.includes('will return')) willReturn = true;

        const $$spoilers = $$(".spoiler-wrap");
        if ($$spoilers.length > 0) {
            $$spoilers.each((i, el) => {
                const headText = $$(el).find(".spoiler-head").text().trim().toLowerCase();
                if (headText.includes("during") || headText.includes("mid")) hasMid = true;
                if (headText.includes("after") || headText.includes("post")) hasPost = true;
            });
        }
        
        return getResultObj(hasMid, hasPost, false, targetUrl, 'AfterCredits', bloopers, willReturn);
    } catch (e) { return null; }
}

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

async function checkTmdb(imdbId, apiKey, styleConfig) {
    const key = apiKey || DEFAULT_TMDB_KEY;
    try {
        const findRes = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${key}`, config);
        const tmdbId = findRes.data.movie_results?.[0]?.id;
        if (!tmdbId) return null;

        const [kwRes, movieRes] = await Promise.all([
            axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/keywords?api_key=${key}`, config),
            axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${key}`, config)
        ]);

        const keywords = kwRes.data.keywords || [];
        const hasMid = keywords.some(k => k.name === 'duringcreditsstinger');
        const hasPost = keywords.some(k => k.name === 'aftercreditsstinger');
        const bloopers = keywords.some(k => k.name === 'bloopers' || k.name === 'outtakes');
        
        let prequelName = null;
        let sequelName = null;

        if ((styleConfig.showPrequels || styleConfig.showSequels) && movieRes.data.belongs_to_collection) {
            const collectionId = movieRes.data.belongs_to_collection.id;
            try {
                const colRes = await axios.get(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${key}`, config);
                const parts = colRes.data.parts || [];
                
                parts.sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''));
                const currentIndex = parts.findIndex(p => p.id === tmdbId);
                
                if (currentIndex > 0) prequelName = parts[currentIndex - 1].title;
                if (currentIndex < parts.length - 1) sequelName = parts[currentIndex + 1].title;
                
            } catch (colErr) {
                console.error(`[Collection API Error] ${colErr.message}`);
            }
        }
        
        return getResultObj(hasMid, hasPost, false, `https://www.themoviedb.org/movie/${tmdbId}`, 'TMDB', bloopers, false, prequelName, sequelName);
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

    const styleConfig = {
        style: rawStyle.replace(/-nosource|-bloopers|-prequels|-sequels/g, ''),
        showSource: !rawStyle.includes('-nosource'),
        showBloopers: rawStyle.includes('-bloopers'),
        showPrequels: rawStyle.includes('-prequels'),
        showSequels: rawStyle.includes('-sequels')
    };

    // Configuration-Aware Cache Key
    const cacheKey = `${id}_pre:${styleConfig.showPrequels}_seq:${styleConfig.showSequels}`;

    const generateStreamConfig = (resultData, titleStr) => {
        if (resultData) {
            const sourceText = styleConfig.showSource ? `\nSource: ${resultData.source}` : '';
            return {
                name: 'After-Credits Scenes',
                title: `${formatMessage(styleConfig, resultData)}${sourceText}`,
                externalUrl: resultData.url
            };
        } else {
            const fallbackLinkText = styleConfig.showSource ? `\nCheck manually at AfterCredits.com` : '';
            return {
                name: 'After-Credits Scenes',
                title: styleConfig.style === 'simple' ? `Status: Unknown${fallbackLinkText}` : `🕵️‍♂️ No info found yet.${fallbackLinkText}`,
                externalUrl: `https://aftercredits.com/?s=${encodeURIComponent(titleStr)}`
            };
        }
    };

    if (streamCache.has(cacheKey)) {
        const cachedData = streamCache.get(cacheKey);
        if (Date.now() - cachedData.timestamp < CACHE_TTL) {
            return res.json({ streams: [generateStreamConfig(cachedData.result, null)] });
        }
        streamCache.delete(cacheKey);
    }

    try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`);
        const title = metaRes.data?.meta?.name;

        if (title) {
            const results = await Promise.allSettled([
                checkAfterCredits(title),
                checkMediaStinger(title),
                checkTmdb(id, apiKey, styleConfig) 
            ]);

            let finalResult = { 
                mid: false, post: false, no: false, 
                bloopers: false, willReturn: false, prequel: null, sequel: null, 
                url: `https://aftercredits.com/?s=${encodeURIComponent(title)}`, 
                source: 'Aggregated' 
            };
            
            let anyDataFound = false;

            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value) {
                    anyDataFound = true;
                    
                    if (!finalResult.mid && !finalResult.post && !finalResult.no) {
                        finalResult.mid = res.value.mid;
                        finalResult.post = res.value.post;
                        finalResult.no = res.value.no;
                        finalResult.url = res.value.url || finalResult.url;
                        finalResult.source = res.value.source;
                    }
                    
                    if (res.value.bloopers) finalResult.bloopers = true;
                    if (res.value.willReturn) finalResult.willReturn = true;
                    if (res.value.prequel) finalResult.prequel = res.value.prequel;
                    if (res.value.sequel) finalResult.sequel = res.value.sequel;
                }
            });

            if (!anyDataFound) {
                finalResult = null;
            }

            if (finalResult) {
                if (streamCache.size >= MAX_CACHE_SIZE) streamCache.delete(streamCache.keys().next().value);
                streamCache.set(cacheKey, { timestamp: Date.now(), result: finalResult });
            }

            return res.json({ streams: [generateStreamConfig(finalResult, title)] });
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