const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors());

const config = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
    timeout: 5000 
};

const DEFAULT_TMDB_KEY = "849503460613279144415848525b682e"; 

const streamCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 mins for testing
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
    const isSimple = styleConfig.style === 'simple';

    // 1. Stingers
    if (isSimple) {
        if (data.mid || data.post) {
            output.push(`Mid-Credits: ${data.mid ? 'Yes' : 'No'}\nPost-Credits: ${data.post ? 'Yes' : 'No'}`);
        } else if (data.no) {
            output.push("Mid-Credits: No\nPost-Credits: No");
        } else {
            output.push("Stinger Status: Unknown");
        }
    } else {
        if (data.mid && data.post) output.push('🍿 Mid & Post-Credits Scenes!');
        else if (data.mid) output.push('⏳ Mid-Credits Scene Only.');
        else if (data.post) output.push('🎬 Post-Credits Scene Only.');
        else if (data.no) output.push('🏃‍♂️ Show\'s Over When Credits Roll!');
        else output.push('🕵️‍♂️ Stinger info not found.');
    }

    // 2. Extras
    if (styleConfig.showBloopers && data.bloopers) {
        output.push(isSimple ? "Bloopers: Yes" : "🤣 Bloopers / Outtakes: Yes");
    }
    if (styleConfig.showPrequels && data.prequel) {
        output.push(isSimple ? `Follows: ${data.prequel}` : `⏪ Follows: ${data.prequel}`);
    }
    if (styleConfig.showSequels && (data.willReturn || data.sequel)) {
        const seqName = data.sequel || "Yes (Announced)";
        output.push(isSimple ? `Sequel: ${seqName}` : `🔄 Sequel / 'Will Return': ${seqName}`);
    }

    return output.join('\n');
};

const getResultObj = (mid, post, no, url, source, bloopers = false, willReturn = false, prequel = null, sequel = null) => {
    return { mid, post, no, url, source, bloopers, willReturn, prequel, sequel };
};

const serveConfig = (req, res) => res.sendFile(path.join(__dirname, 'index.html'));
app.get('/', serveConfig);
app.get('/configure', serveConfig);

const manifestHandler = (req, res) => {
    res.json({
        id: 'org.stinger.pro',
        version: '1.8.2',
        name: 'Stremio Stinger Pro',
        description: 'Fixed Prequel/Sequel aggregator logic.',
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

        $$(".spoiler-wrap").each((i, el) => {
            const headText = $$(el).find(".spoiler-head").text().trim().toLowerCase();
            if (headText.includes("during") || headText.includes("mid")) hasMid = true;
            if (headText.includes("after") || headText.includes("post")) hasPost = true;
        });
        
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
        const movieMatch = findRes.data.movie_results?.[0];
        if (!movieMatch) return null;
        const tmdbId = Number(movieMatch.id);

        const [kwRes, movieRes] = await Promise.all([
            axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/keywords?api_key=${key}`, config),
            axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${key}`, config)
        ]);

        const keywords = kwRes.data.keywords || [];
        const hasMid = keywords.some(k => k.name.includes('duringcreditsstinger'));
        const hasPost = keywords.some(k => k.name.includes('aftercreditsstinger'));
        const bloopers = keywords.some(k => k.name.includes('blooper') || k.name.includes('outtake'));
        
        let prequelName = null;
        let sequelName = null;

        if ((styleConfig.showPrequels || styleConfig.showSequels) && movieRes.data.belongs_to_collection) {
            const colId = movieRes.data.belongs_to_collection.id;
            const colRes = await axios.get(`https://api.themoviedb.org/3/collection/${colId}?api_key=${key}`, config);
            const parts = (colRes.data.parts || [])
                .filter(p => p.release_date) // Only released/dated items
                .sort((a, b) => a.release_date.localeCompare(b.release_date));
            
            const currentIndex = parts.findIndex(p => Number(p.id) === tmdbId);
            if (currentIndex > 0) prequelName = parts[currentIndex - 1].title;
            if (currentIndex !== -1 && currentIndex < parts.length - 1) sequelName = parts[currentIndex + 1].title;
        }
        
        return getResultObj(hasMid, hasPost, false, `https://www.themoviedb.org/movie/${tmdbId}`, 'TMDB', bloopers, false, prequelName, sequelName);
    } catch (e) { return null; }
}

const streamHandler = async (req, res) => {
    const { type, id } = req.params;
    let rawStyle = req.params.style || req.params.p1 || 'colorful';
    let apiKey = req.params.apiKey || (req.params.p1 && !req.params.p1.includes('simple') && !req.params.p1.includes('colorful') ? req.params.p1 : null);

    if (type !== 'movie') return res.json({ streams: [] });

    const styleConfig = {
        style: rawStyle.replace(/-nosource|-bloopers|-prequels|-sequels/g, ''),
        showSource: !rawStyle.includes('-nosource'),
        showBloopers: rawStyle.includes('-bloopers'),
        showPrequels: rawStyle.includes('-prequels'),
        showSequels: rawStyle.includes('-sequels')
    };

    const cacheKey = `${id}_${rawStyle}`;
    if (CACHE_TTL > 0 && streamCache.has(cacheKey)) {
        const cached = streamCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) return res.json({ streams: [cached.stream] });
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

            let merged = { mid: false, post: false, no: false, bloopers: false, willReturn: false, prequel: null, sequel: null, url: '', source: 'Aggregated' };
            let hasPrimary = false;

            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value) {
                    const val = res.value;
                    // Only lock in stinger status if a source has a POSITIVE (true) confirmation
                    if (!hasPrimary && (val.mid || val.post || val.no)) {
                        merged.mid = val.mid; merged.post = val.post; merged.no = val.no;
                        merged.url = val.url; merged.source = val.source;
                        hasPrimary = true;
                    }
                    if (val.bloopers) merged.bloopers = true;
                    if (val.willReturn) merged.willReturn = true;
                    if (val.prequel) merged.prequel = val.prequel;
                    if (val.sequel) merged.sequel = val.sequel;
                }
            });

            const stream = {
                name: 'After-Credits Scenes',
                title: `${formatMessage(styleConfig, merged)}${styleConfig.showSource ? `\nSource: ${merged.source}` : ''}`,
                externalUrl: merged.url || `https://aftercredits.com/?s=${encodeURIComponent(title)}`
            };

            streamCache.set(cacheKey, { timestamp: Date.now(), stream });
            return res.json({ streams: [stream] });
        }
    } catch (e) { console.error(e.message); }
    res.json({ streams: [] });
};

app.get('/stream/:type/:id.json', streamHandler);
app.get('/:p1/stream/:type/:id.json', streamHandler);
app.get('/:style/:apiKey/stream/:type/:id.json', streamHandler);

app.listen(process.env.PORT || 7000);