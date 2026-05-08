const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

// --- 1. Serve Configuration Page ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 2. Manifest Routing ---
const manifestHandler = (req, res) => {
    res.json({
        id: 'org.stinger.pro',
        version: '1.2.1',
        name: 'Stremio Stinger Pro',
        description: 'Detects mid and post-credit scenes using AfterCredits with an optional TMDB fallback.',
        types: ['movie'],
        catalogs: [],
        resources: ['stream'],
        idPrefixes: ['tt'],
        behaviorHints: { configurable: true, configurationRequired: false }
    });
};

// Handle requests with and without the optional API key
app.get('/manifest.json', manifestHandler);
app.get('/:apiKey/manifest.json', manifestHandler);

// --- 3. Primary Logic (AfterCredits) ---
async function checkAfterCredits(imdbId) {
    try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/movie/${imdbId}.json`);
        const title = metaRes.data?.meta?.name;
        if (!title) return null;

        const searchRes = await axios.get(`https://aftercredits.com/?s=${encodeURIComponent(title)}`);
        const $ = cheerio.load(searchRes.data);
        const url = $('article header h2 a').first().attr('href');
        
        if (!url) return null;

        const movieRes = await axios.get(url);
        const $$ = cheerio.load(movieRes.data);
        const entryText = $$('.entry-content').text().toLowerCase();

        const hasMid = entryText.includes('during the credits? yes') || entryText.includes('mid-credits');
        const hasPost = entryText.includes('after the credits? yes') || entryText.includes('post-credits');

        let status = 'Nothing to see here';
        if (hasMid && hasPost) status = 'Mid & Post-Credits Scenes';
        else if (hasMid) status = 'Mid-Credits Scene Only';
        else if (hasPost) status = 'Post-Credits Scene Only';
        else if (entryText.includes('no stinger') || entryText.includes('are there any extras during or after the credits? no')) status = 'No Stinger';

        return { message: status, url: url };
    } catch (error) {
        return null;
    }
}

// --- 4. Fallback Logic (TMDB) ---
async function checkTmdb(imdbId, apiKey) {
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
        return 'Nothing to see here';
    } catch (error) {
        return null;
    }
}

// --- 5. Stream Routing ---
const streamHandler = async (req, res) => {
    const { type, id } = req.params;
    const apiKey = req.params.apiKey; // Undefined if skipped in config

    if (type !== 'movie') return res.json({ streams: [] });

    let finalMessage = null;
    let finalUrl = 'https://aftercredits.com/';
    let source = '';

    // Execute Primary
    const acData = await checkAfterCredits(id);
    
    if (acData && acData.message !== 'Nothing to see here') {
        finalMessage = acData.message;
        finalUrl = acData.url;
        source = 'AfterCredits';
    } else if (apiKey) {
        // Execute Fallback ONLY if key is present
        const tmdbMessage = await checkTmdb(id, apiKey);
        if (tmdbMessage) {
            finalMessage = tmdbMessage;
            finalUrl = `https://www.themoviedb.org/movie/${id}`;
            source = 'TMDB';
        }
    }

    // Failsafe
    if (!finalMessage) {
        finalMessage = 'Nothing to see here';
        source = 'Search Failed';
    }

    res.json({
        streams: [{
            name: 'Stremio Stinger Pro',
            title: `${finalMessage}\nSource: ${source}`,
            externalUrl: finalUrl
        }]
    });
};

// Handle requests with and without the optional API key
app.get('/stream/:type/:id.json', streamHandler);
app.get('/:apiKey/stream/:type/:id.json', streamHandler);

// --- 6. Server Initialization ---
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Active on port ${PORT}`));