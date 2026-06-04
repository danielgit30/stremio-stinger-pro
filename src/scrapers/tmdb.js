const axios = require('axios');
const { DEFAULT_TMDB_KEY } = require('../config');
const { getResultObj } = require('../utils/formatter');
const { sanitizeError } = require('../utils/network');
const { log } = require('../utils/logger');

async function checkTmdb(imdbId, tmdbIdRaw, apiKey, reqConfig) {
    log(`\n--- [TMDB] Execution Start: ID ${imdbId} (TMDB: ${tmdbIdRaw}) ---`);
    const key = apiKey || DEFAULT_TMDB_KEY;
    if (!key) {
        log(`[TMDB] Skipping: No API key provided.`);
        return null;
    }
    try {
        let tmdbId = tmdbIdRaw;

        const resolveTmdbId = async () => {
            if (!imdbId) return null;
            const findRes = await axios.get(
                `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&api_key=${encodeURIComponent(key)}`,
                reqConfig
            );
            const movieMatch = findRes.data.movie_results?.[0];
            return movieMatch ? Number(movieMatch.id) : null;
        };

        if (!tmdbId) {
            tmdbId = await resolveTmdbId();
            if (!tmdbId) {
                log(`[TMDB] No match found.`);
                return null;
            }
        }

        let kwRes;
        try {
            kwRes = await axios.get(
                `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}/keywords?api_key=${encodeURIComponent(key)}`,
                reqConfig
            );
        } catch (err) {
            if (tmdbIdRaw && err.response && err.response.status === 404 && imdbId) {
                log(`[TMDB] 404 using tmdbIdRaw ${tmdbIdRaw}. Attempting to resolve correct TMDB ID via IMDb ID...`);
                tmdbId = await resolveTmdbId();
                if (tmdbId) {
                    log(`[TMDB] Resolved correct TMDB ID: ${tmdbId}`);
                    kwRes = await axios.get(
                        `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}/keywords?api_key=${encodeURIComponent(key)}`,
                        reqConfig
                    );
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
        const keywords = kwRes.data.keywords || [];

        let hasMid = false,
            hasPost = false,
            bloopers = false;
        for (const k of keywords) {
            const name = k.name;
            if (!hasMid && name.includes('duringcreditsstinger')) hasMid = true;
            if (!hasPost && name.includes('aftercreditsstinger')) hasPost = true;
            if (!bloopers && (name.includes('blooper') || name.includes('outtake'))) bloopers = true;
            if (hasMid && hasPost && bloopers) break;
        }

        if (!hasMid && !hasPost && !bloopers) {
            log(`[TMDB] No stinger keywords found.`);
            return null;
        }

        let isDefinitive = true;
        log(`[TMDB] Match -> Mid: ${hasMid}, Post: ${hasPost}, Bloopers: ${bloopers}, Definitive: ${isDefinitive}`);
        return getResultObj(
            hasMid,
            hasPost,
            false,
            `https://www.themoviedb.org/movie/${tmdbId}`,
            'TMDB',
            bloopers,
            isDefinitive
        );
    } catch (e) {
        if (e.name !== 'CanceledError' && e.message !== 'canceled') {
            console.error(`[TMDB Error] ${sanitizeError(e.message)}`);
        }
        return null;
    }
}

module.exports = {
    checkTmdb,
    getRelatedMovies,
};

async function getRelatedMovies(tmdbIdRaw, apiKey, reqConfig, imdbId) {
    log(`\n--- [TMDB - Related] Execution Start: TMDB ID ${tmdbIdRaw} (IMDb: ${imdbId}) ---`);
    const key = apiKey || DEFAULT_TMDB_KEY;
    if (!key) {
        log(`[TMDB - Related] Skipping Related Movies: No API key provided.`);
        return null;
    }

    try {
        let tmdbId = tmdbIdRaw;

        const resolveTmdbId = async () => {
            if (!imdbId) return null;
            log(`[TMDB - Related] Resolving TMDB ID from IMDb ID: ${imdbId}...`);
            const findRes = await axios.get(
                `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&api_key=${encodeURIComponent(key)}`,
                reqConfig
            );
            const movieMatch = findRes.data.movie_results?.[0];
            return movieMatch ? Number(movieMatch.id) : null;
        };

        if (!tmdbId) {
            tmdbId = await resolveTmdbId();
            if (!tmdbId) {
                log(`[TMDB - Related] No TMDB ID could be resolved.`);
                return null;
            }
            log(`[TMDB - Related] Resolved TMDB ID: ${tmdbId}`);
        }

        let movieRes;
        try {
            log(`[TMDB - Related] Fetching movie details for TMDB ID: ${tmdbId}...`);
            movieRes = await axios.get(
                `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}?append_to_response=keywords&api_key=${encodeURIComponent(key)}`,
                reqConfig
            );
        } catch (err) {
            if (tmdbIdRaw && err.response && err.response.status === 404 && imdbId) {
                log(`[TMDB - Related] 404 using tmdbIdRaw ${tmdbIdRaw}. Attempting to resolve correct TMDB ID via IMDb ID...`);
                tmdbId = await resolveTmdbId();
                if (tmdbId) {
                    log(`[TMDB - Related] Resolved correct TMDB ID: ${tmdbId}. Fetching details...`);
                    movieRes = await axios.get(
                        `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}?append_to_response=keywords&api_key=${encodeURIComponent(key)}`,
                        reqConfig
                    );
                } else {
                    throw err;
                }
            } else {
                throw err;
            }
        }
        const movie = movieRes.data;
        log(`[TMDB - Related] Fetched details for: "${movie.title}"`);

        let sourceMaterial = null;
        if (movie.keywords && movie.keywords.keywords) {
            log(`[TMDB - Related] Checking ${movie.keywords.keywords.length} keywords for source material...`);
            const basedOnKeyword = movie.keywords.keywords.find(
                (k) => k.name && k.name.toLowerCase().startsWith('based on ')
            );
            if (basedOnKeyword) {
                // Strip "based on " from the beginning
                const rawMaterial = basedOnKeyword.name.substring(9);
                sourceMaterial = rawMaterial
                    .split(' ')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
                log(`[TMDB - Related] Found Source Material: "${sourceMaterial}"`);
            }
        }

        if (!movie.belongs_to_collection && !sourceMaterial) {
            log(`[TMDB - Related] No collection or source material found.`);
            return null;
        }

        let prequel = null;
        let sequel = null;
        let collectionUrl = null;

        if (movie.belongs_to_collection) {
            const collectionId = movie.belongs_to_collection.id;
            log(`[TMDB - Related] Belongs to collection: "${movie.belongs_to_collection.name}" (ID: ${collectionId}). Fetching collection details...`);
            const collectionRes = await axios.get(
                `https://api.themoviedb.org/3/collection/${encodeURIComponent(collectionId)}?api_key=${encodeURIComponent(key)}`,
                reqConfig
            );
            const collection = collectionRes.data;

            let parts = collection.parts || [];
            log(`[TMDB - Related] Collection has ${parts.length} parts.`);
            // Filter out items without release date and sort by release date
            parts = parts
                .filter((p) => p.release_date)
                .sort((a, b) => {
                    return new Date(a.release_date) - new Date(b.release_date);
                });

            const currentIndex = parts.findIndex((p) => p.id === Number(tmdbId));
            if (currentIndex !== -1) {
                prequel = currentIndex > 0 ? parts[currentIndex - 1] : null;
                sequel = currentIndex < parts.length - 1 ? parts[currentIndex + 1] : null;
            }
            collectionUrl = `https://www.themoviedb.org/collection/${collectionId}`;
        }

        if (!prequel && !sequel && !sourceMaterial) {
            log(`[TMDB - Related] No prequel, sequel, or source material found.`);
            return null;
        }

        log(
            `[TMDB - Related] Result -> Prequel: ${prequel ? `"${prequel.title}"` : 'None'}, Sequel: ${sequel ? `"${sequel.title}"` : 'None'}, Source: ${sourceMaterial ? `"${sourceMaterial}"` : 'None'}`
        );

        return {
            prequel,
            sequel,
            sourceMaterial,
            collectionUrl: collectionUrl || `https://www.themoviedb.org/movie/${tmdbId}`,
        };
    } catch (e) {
        if (e.name !== 'CanceledError' && e.message !== 'canceled') {
            console.error(`[TMDB Error - Related] ${sanitizeError(e.message)}`);
        }
        return null;
    }
}
