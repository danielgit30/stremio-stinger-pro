const axios = require('axios');
const { DEFAULT_TMDB_KEY } = require('../config');
const { getResultObj } = require('../utils/formatter');
const { sanitizeError } = require('../utils/network');

async function checkTmdb(imdbId, tmdbIdRaw, apiKey, reqConfig) {
    console.log(`\n--- [TMDB] Execution Start: ID ${imdbId} (TMDB: ${tmdbIdRaw}) ---`);
    const key = apiKey || DEFAULT_TMDB_KEY;
    try {
        let tmdbId = tmdbIdRaw;

        if (!tmdbId) {
            const findRes = await axios.get(`https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&api_key=${encodeURIComponent(key)}`, reqConfig);
            const movieMatch = findRes.data.movie_results?.[0];
            if (!movieMatch) {
                console.log(`[TMDB] No match found.`);
                return null;
            }
            tmdbId = Number(movieMatch.id);
        }
        const kwRes = await axios.get(`https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}/keywords?api_key=${encodeURIComponent(key)}`, reqConfig);
        const keywords = kwRes.data.keywords || [];

        let hasMid = false, hasPost = false, bloopers = false;
        for (const k of keywords) {
            const name = k.name;
            if (!hasMid && name.includes('duringcreditsstinger')) hasMid = true;
            if (!hasPost && name.includes('aftercreditsstinger')) hasPost = true;
            if (!bloopers && (name.includes('blooper') || name.includes('outtake'))) bloopers = true;
            if (hasMid && hasPost && bloopers) break;
        }

        if (!hasMid && !hasPost && !bloopers) {
            console.log(`[TMDB] No stinger keywords found.`);
            return null;
        }

        let isDefinitive = true;
        console.log(`[TMDB] Match -> Mid: ${hasMid}, Post: ${hasPost}, Bloopers: ${bloopers}, Definitive: ${isDefinitive}`);
        return getResultObj(hasMid, hasPost, false, `https://www.themoviedb.org/movie/${tmdbId}`, 'TMDB', bloopers, isDefinitive);
    } catch (e) {
        if (e.name !== 'CanceledError' && e.message !== 'canceled') {
            console.error(`[TMDB Error] ${sanitizeError(e.message)}`);
        }
        return null;
    }
}

module.exports = {
    checkTmdb
};
