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
    timeout: 8000
};

const mapStatus = (mid, post, no) => {
    if (mid && post) return '🍿 Mid & Post-Credits Scenes!';
    if (mid) return '⏳ Mid-Credits Scene Only!';
    if (post) return '🎬 Post-Credits Scene Only!';
    if (no) return '🏃‍♂️ No Stinger!';
    return '🕵️‍♂️ Nothing to see here.';
};

// --- Routing ---
// Serve the configuration page on both the root and Stremio's expected /configure path
const serveConfig = (req, res) => res.sendFile(path.join(__dirname, 'index.html'));
app.get('/', serveConfig);
app.get('/configure', serveConfig);

const manifestHandler = (req, res) => {
    res.json({
        id: 'org.stinger.pro',
        version: '1.3.0',
        name: 'Stinger Alerts Pro',
        description: 'Detects mid and post-credit scenes using multiple sources.',
        logo: 'https://github.com/schultz911/stremio-stinger-pro/blob/main/icon.png', 
        
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
app.get('/:apiKey/manifest.json', manifestHandler);

// --- Source 1: AfterCredits ---
async function checkAfterCredits(title) {
    try {
        const searchRes = await axios.get(`https://aftercredits.com/?s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        
        const cleanTargetTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        let targetUrl = null;
        let hasAsterisk = false;

        $('h3.entry-title a, .entry-title a, .post-title a, article header h2 a').each((i, el) => {
            const rawLinkText = $(el).text().toLowerCase().trim();
            const cleanLinkText = rawLinkText.replace(/[*|?]/g, '').replace(/[^\w\s]/g, '').trim();

            if (!rawLinkText.includes('review') && (cleanLinkText.startsWith(cleanTargetTitle) || cleanLinkText === cleanTargetTitle)) {
                targetUrl = $(el).attr('href');
                hasAsterisk = rawLinkText.endsWith('*');
                return false; 
            }
        });

        if (!targetUrl) return null;
        if (!targetUrl.startsWith('http')) targetUrl = `https://aftercredits.com${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

        if (!hasAsterisk) return { message: mapStatus(false, false, true), url: targetUrl };

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
        } else {
            const cleanText = $$('article, .entry-content').text().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
            if (cleanText.includes('during the credits yes')) hasMid = true;
            if (cleanText.includes('after the credits yes')) hasPost = true;
        }

        return { message: mapStatus(hasMid, hasPost, false), url: targetUrl };
    } catch (error) {
        console.error(`[AfterCredits Error] ${error.message}`);
        return null;
    }
}

// --- Source 2: MediaStinger ---
async function checkMediaStinger(title) {
    try {
        const searchRes = await axios.get(`http://www.mediastinger.com/?tab=MOVIES&s=${encodeURIComponent(title)}`, config);
        const $ = cheerio.load(searchRes.data);
        const $result = $("ul.highlights li").first();

        if ($result.length === 0) return null;

        const resultTitle = $result.find(".title").first().text().trim().toLowerCase();
        const cleanTargetTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const cleanResultTitle = resultTitle.replace(/[^\w\s]/g, '').trim();

        if (!cleanResultTitle.startsWith(cleanTargetTitle)) return null;

        const url = $result.find("a").first().attr("href") || 'http://www.mediastinger.com';
        const subtitle = $result.find(".subtitle").first().text().trim().toLowerCase();

        const no = subtitle.includes("no");
        const mid = subtitle.includes("during");
        const post = subtitle.includes("after");

        return { message: mapStatus(mid, post, no), url };
    } catch (error) {
        console.error(`[MediaStinger Error] ${error.message}`);
        return null;
    }
}

// --- Source 3: TMDB ---
async function checkTmdb(imdbId, apiKey) {
    if (!apiKey) return null;
    try {
        const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${apiKey}`;
        const findRes = await axios.get(findUrl);
        const tmdbId = findRes.data.movie_results?.[0]?.id;
        
        if (!tmdbId) return null;

        const kwUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/keywords?api_key=${apiKey}`;
        const kwRes = await axios.get(kwUrl);
        const keywords = kwRes.data.keywords || [];
        
        const hasMid = keywords.some(k => k.name === 'duringcreditsstinger');
        const hasPost = keywords.some(k => k.name === 'aftercreditsstinger');
        const hasNo = !hasMid && !hasPost; // TMDB doesn't explicitly tag "no stinger", it just lacks tags.

        // If TMDB lacks tags, we don't assume "No Stinger", we leave it unknown.
        if (hasNo) return null; 

        return { message: mapStatus(hasMid, hasPost, false), url: `https://www.themoviedb.org/movie/${tmdbId}` };
    } catch (error) {
        console.error(`[TMDB Error] ${error.message}`);
        return null;
    }
}

// --- Main Handler ---
const streamHandler = async (req, res) => {
    const { type, id } = req.params;
    const apiKey = req.params.apiKey;

    if (type !== 'movie') return res.json({ streams: [] });

    let finalMessage = '🕵️‍♂️ Nothing to see here.';
    let finalUrl = 'https://aftercredits.com/';
    let source = 'Search Failed';

    try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${id}.json`);
        const title = metaRes.data?.meta?.name;

        if (title) {
            // 1. AfterCredits
            let data = await checkAfterCredits(title);
            if (data && !data.message.includes('Unknown')) {
                finalMessage = data.message;
                finalUrl = data.url;
                source = 'AfterCredits';
            } else {
                // 2. MediaStinger
                data = await checkMediaStinger(title);
                if (data && !data.message.includes('Unknown')) {
                    finalMessage = data.message;
                    finalUrl = data.url;
                    source = 'MediaStinger';
                } else if (apiKey) {
                    // 3. TMDB Fallback
                    data = await checkTmdb(id, apiKey);
                    if (data) {
                        finalMessage = data.message;
                        finalUrl = data.url;
                        source = 'TMDB';
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[Stream Handler Error] ${error.message}`);
    }

    res.json({ 
        streams: [{ 
            name: 'Should I Stay?', 
            title: `${finalMessage}\nSource: ${source}`, 
            externalUrl: finalUrl 
        }] 
    });
};

app.get('/stream/:type/:id.json', streamHandler);
app.get('/:apiKey/stream/:type/:id.json', streamHandler);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Active on port ${PORT}`));