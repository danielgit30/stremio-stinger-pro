const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const manifestHandler = (req, res) => {
    res.json({
        id: 'org.stinger.pro',
        version: '1.2.2',
        name: 'Stinger Alerts (Debug)',
        description: 'Detects mid and post-credit scenes.',
        types: ['movie'],
        catalogs: [],
        resources: ['stream'],
        idPrefixes: ['tt'],
        behaviorHints: { configurable: true, configurationRequired: false }
    });
};

app.get('/manifest.json', manifestHandler);
app.get('/:apiKey/manifest.json', manifestHandler);

async function checkAfterCredits(imdbId) {
    const config = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 8000
    };

    console.log(`\n--- STARTING QUERY FOR: ${imdbId} ---`);

    try {
        console.log(`[1] Fetching Title from Cinemeta...`);
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${imdbId}.json`);
        const title = metaRes.data?.meta?.name;
        
        if (!title) {
            console.log(`[ERROR] Cinemeta returned no title.`);
            return null;
        }

        console.log(`[2] Querying AfterCredits search engine...`);
        const searchUrl = `https://aftercredits.com/?s=${encodeURIComponent(title)}`;
        const searchRes = await axios.get(searchUrl, config);
        const $ = cheerio.load(searchRes.data);
        
        // Remove year if present (e.g., "Iron Man 3 2013" -> "iron man 3")
        const cleanTargetTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        
        let targetUrl = null;
        let hasAsterisk = false;

        // Using the selector from the snippet, plus our fallbacks
        const resultLinks = $('h3.entry-title a, .entry-title a, .post-title a, article header h2 a');

        resultLinks.each((i, el) => {
            const rawLinkText = $(el).text().toLowerCase().trim();
            const isReview = rawLinkText.includes('review');
            
            // Clean the text to check for a title match
            const cleanLinkText = rawLinkText.replace(/[*|?]/g, '').replace(/[^\w\s]/g, '').trim();

            if (!isReview && (cleanLinkText.startsWith(cleanTargetTitle) || cleanLinkText === cleanTargetTitle)) {
                targetUrl = $(el).attr('href');
                hasAsterisk = rawLinkText.endsWith('*'); // The crucial check
                return false; 
            }
        });

        if (!targetUrl) {
            console.log(`[ERROR] No valid stinger articles found for "${title}"`);
            return null;
        }

        if (!targetUrl.startsWith('http')) {
            targetUrl = `https://aftercredits.com${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
        }

        console.log(`[3] Target URL found. Asterisk present? ${hasAsterisk}`);

        // Early Exit: If no asterisk, there are no stingers.
        if (!hasAsterisk) {
            console.log(`[3] Success: Evaluated status - No Stinger`);
            return { message: 'No Stinger', url: targetUrl };
        }

        // If asterisk exists, fetch details to determine Mid vs Post
        console.log(`[4] Fetching detail page to classify stinger...`);
        const movieRes = await axios.get(targetUrl, config);
        const $$ = cheerio.load(movieRes.data);
        
        let hasMid = false;
        let hasPost = false;

        // Use the snippet's .spoiler-head logic
        const $$spoilers = $$(".spoiler-wrap");
        
        if ($$spoilers.length > 0) {
            $$spoilers.each((i, el) => {
                const headText = $$(el).find(".spoiler-head").text().trim().toLowerCase();
                if (headText.includes("during the credits") || headText.includes("mid-credits")) {
                    hasMid = true;
                }
                if (headText.includes("after the credits") || headText.includes("post-credits")) {
                    hasPost = true;
                }
            });
        } else {
            // Fallback if they didn't use the spoiler class on an older post
            const rawText = $$('article, .entry-content').text().toLowerCase();
            const cleanText = rawText.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
            if (cleanText.includes('during the credits yes')) hasMid = true;
            if (cleanText.includes('after the credits yes')) hasPost = true;
        }

        let status = 'Stinger Found';
        if (hasMid && hasPost) status = 'Mid & Post-Credits Scenes';
        else if (hasMid) status = 'Mid-Credits Scene Only';
        else if (hasPost) status = 'Post-Credits Scene Only';

        console.log(`[4] Success: Evaluated status - ${status}`);
        return { message: status, url: targetUrl };

    } catch (error) {
        console.log(`[FATAL ERROR] AfterCredits logic failed: ${error.message}`);
        return null;
    }
}

async function checkTmdb(imdbId, apiKey) {
    if (!apiKey) {
        console.log(`[TMDB] Skipped. No API key provided.`);
        return null;
    }
    console.log(`[TMDB] Executing fallback for ${imdbId}...`);
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

        if (hasMid && hasPost) return 'Mid & Post-Credits Scenes';
        if (hasMid) return 'Mid-Credits Scene Only';
        if (hasPost) return 'Post-Credits Scene Only';
        return 'No Stinger';
    } catch (error) {
        console.log(`[TMDB ERROR]: ${error.message}`);
        return null;
    }
}

const streamHandler = async (req, res) => {
    const { type, id } = req.params;
    const apiKey = req.params.apiKey;

    if (type !== 'movie') return res.json({ streams: [] });

    let finalMessage = null;
    let finalUrl = 'https://aftercredits.com/';
    let source = '';

    const acData = await checkAfterCredits(id);
    
    if (acData && acData.message !== 'Status Unknown') {
        finalMessage = acData.message;
        finalUrl = acData.url;
        source = 'AfterCredits';
    } else {
        const tmdbMessage = await checkTmdb(id, apiKey);
        if (tmdbMessage) {
            finalMessage = tmdbMessage;
            finalUrl = `https://www.themoviedb.org/movie/${id}`;
            source = 'TMDB';
        }
    }

    if (!finalMessage) {
        finalMessage = 'Status Unknown';
        source = 'Search Failed';
    }

    res.json({ streams: [{ name: 'Stinger Info', title: `${finalMessage}\nSource: ${source}`, externalUrl: finalUrl }] });
};

app.get('/stream/:type/:id.json', streamHandler);
app.get('/:apiKey/stream/:type/:id.json', streamHandler);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Active on port ${PORT}`));