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
            console.log(`[ERROR] Cinemeta returned no title for ${imdbId}`);
            return null;
        }
        console.log(`[1] Success: Resolved title to "${title}"`);

        console.log(`[2] Querying AfterCredits search engine...`);
        const searchUrl = `https://aftercredits.com/?s=${encodeURIComponent(title)}`;
        const searchRes = await axios.get(searchUrl, config);
        const $ = cheerio.load(searchRes.data);
        
        // Cascading selectors to handle varying DOM layouts
        const possibleSelectors = [
            '.entry-title a',
            '.post-title a',
            'article header h2 a',
            'h2.title a',
            'h2 a'
        ];

        let url = null;
        for (const selector of possibleSelectors) {
            url = $(selector).first().attr('href');
            if (url) break; // Stop at the first successful match
        }

        if (!url) {
            console.log(`[ERROR] No search results found on AfterCredits for "${title}"`);
            return null;
        }
        console.log(`[2] Success: Found article URL: ${url}`);

        console.log(`[3] Scraping target article...`);
        const movieRes = await axios.get(url, config);
        const $$ = cheerio.load(movieRes.data);
        const entryText = $$('.entry-content').text().toLowerCase();

        const hasMid = entryText.includes('during the credits? yes') || entryText.includes('mid-credits');
        const hasPost = entryText.includes('after the credits? yes') || entryText.includes('post-credits');

        let status = 'Status Unknown';
        if (hasMid && hasPost) status = 'Mid & Post-Credits Scenes';
        else if (hasMid) status = 'Mid-Credits Scene Only';
        else if (hasPost) status = 'Post-Credits Scene Only';
        else if (entryText.includes('no stinger') || entryText.includes('are there any extras during or after the credits? no')) status = 'No Stinger';

        console.log(`[3] Success: Scraped status - ${status}`);
        return { message: status, url: url };

    } catch (error) {
        console.log(`[FATAL ERROR] AfterCredits logic failed.`);
        if (error.response) {
            console.log(`-> HTTP Status: ${error.response.status}`);
            console.log(`-> Target Website rejected the connection.`);
        } else {
            console.log(`-> Message: ${error.message}`);
        }
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