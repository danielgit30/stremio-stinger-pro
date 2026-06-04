const { axiosInstance, isCancel } = require('../utils/network');
const { DEFAULT_TMDB_KEY } = require('../config');
const { getResultObj } = require('../utils/formatter');
const { sanitizeError } = require('../utils/network');
const { log, error } = require('../utils/logger');

/**
 * Shared helper: resolve a numeric TMDB ID from an IMDb ID via the TMDB /find endpoint.
 * Extracted from both checkTmdb and getRelatedMovies to eliminate code duplication.
 */
async function resolveTmdbIdFromImdb(imdbId, key, reqConfig) {
    if (!imdbId) return null;
    const findRes = await axiosInstance.get(
        `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&api_key=${encodeURIComponent(key)}`,
        reqConfig
    );
    const movieMatch = findRes.data.movie_results?.[0];
    return movieMatch ? Number(movieMatch.id) : null;
}

async function checkTmdb(imdbId, tmdbIdRaw, apiKey, reqConfig) {
    log(`\n--- [TMDB] Execution Start: ID ${imdbId} (TMDB: ${tmdbIdRaw}) ---`);
    const key = apiKey || DEFAULT_TMDB_KEY;
    if (!key) {
        log(`[TMDB] Skipping: No API key provided.`);
        return null;
    }
    try {
        let tmdbId = tmdbIdRaw;

        if (!tmdbId) {
            tmdbId = await resolveTmdbIdFromImdb(imdbId, key, reqConfig);
            if (!tmdbId) {
                log(`[TMDB] No match found.`);
                return null;
            }
        }

        let kwRes;
        try {
            kwRes = await axiosInstance.get(
                `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}/keywords?api_key=${encodeURIComponent(key)}`,
                reqConfig
            );
        } catch (err) {
            if (tmdbIdRaw && err.response && err.response.status === 404 && imdbId) {
                log(`[TMDB] 404 using tmdbIdRaw ${tmdbIdRaw}. Attempting to resolve correct TMDB ID via IMDb ID...`);
                tmdbId = await resolveTmdbIdFromImdb(imdbId, key, reqConfig);
                if (tmdbId) {
                    log(`[TMDB] Resolved correct TMDB ID: ${tmdbId}`);
                    kwRes = await axiosInstance.get(
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
        if (!isCancel(e)) {
            error(`[TMDB Error] ${sanitizeError(e.message)}`);
        }
        return null;
    }
}

async function getRelatedMovies(tmdbIdRaw, apiKey, reqConfig, imdbId) {
    log(`\n--- [TMDB - Related] Execution Start: TMDB ID ${tmdbIdRaw} (IMDb: ${imdbId}) ---`);
    const key = apiKey || DEFAULT_TMDB_KEY;
    if (!key) {
        log(`[TMDB - Related] Skipping Related Movies: No API key provided.`);
        return null;
    }

    let basedOnPromise = null;
    if (imdbId) {
        log(`[TMDB - Related] Concurrently launching basedon.media lookup...`);
        basedOnPromise = axiosInstance
            .get(`https://basedon.media/stream/movie/${encodeURIComponent(imdbId)}.json`, {
                ...reqConfig,
                timeout: 3000,
            })
            .catch(() => null);
    }

    try {
        let tmdbId = tmdbIdRaw;

        if (!tmdbId) {
            log(`[TMDB - Related] Resolving TMDB ID from IMDb ID: ${imdbId}...`);
            tmdbId = await resolveTmdbIdFromImdb(imdbId, key, reqConfig);
            if (!tmdbId) {
                log(`[TMDB - Related] No TMDB ID could be resolved.`);
                return null;
            }
            log(`[TMDB - Related] Resolved TMDB ID: ${tmdbId}`);
        }

        let movieRes;
        try {
            log(`[TMDB - Related] Fetching movie details for TMDB ID: ${tmdbId}...`);
            movieRes = await axiosInstance.get(
                `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}?append_to_response=keywords&api_key=${encodeURIComponent(key)}`,
                reqConfig
            );
        } catch (err) {
            if (tmdbIdRaw && err.response && err.response.status === 404 && imdbId) {
                log(
                    `[TMDB - Related] 404 using tmdbIdRaw ${tmdbIdRaw}. Attempting to resolve correct TMDB ID via IMDb ID...`
                );
                tmdbId = await resolveTmdbIdFromImdb(imdbId, key, reqConfig);
                if (tmdbId) {
                    log(`[TMDB - Related] Resolved correct TMDB ID: ${tmdbId}. Fetching details...`);
                    movieRes = await axiosInstance.get(
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
                const rawMaterial = basedOnKeyword.name.substring(9);
                sourceMaterial = rawMaterial
                    .split(' ')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
                log(`[TMDB - Related] TMDB Source Material: "${sourceMaterial}"`);
            }
        }

        if (basedOnPromise) {
            log(`[TMDB - Related] Awaiting concurrent basedon.media query...`);
            const basedOnRes = await basedOnPromise;
            if (basedOnRes && basedOnRes.data) {
                const stream = basedOnRes.data?.streams?.[0];
                if (stream && stream.title) {
                    const match = stream.title.match(/Based on\s+([^:\n]+):\s*\n?([^\n]+)/i);
                    if (match) {
                        const type = match[1].trim();
                        const name = match[2].trim();
                        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
                        sourceMaterial = `${name} (${capitalizedType})`;
                        log(
                            `[TMDB - Related] Exact Source Material from basedon.media prioritized: "${sourceMaterial}"`
                        );
                    }
                }
            } else {
                log(`[TMDB - Related Warning] basedon.media query yielded no valid results.`);
            }
        }

        if (!movie.belongs_to_collection && !sourceMaterial) {
            log(`[TMDB - Related] No collection or source material found.`);
            return null;
        }

        let prequel = null;
        let sequel = null;
        let collectionUrl = null;
        let collectionName = null;

        // Check if movie keywords match any mega-collection keyword
        let franchiseMatch = null;
        if (movie.keywords && movie.keywords.keywords) {
            for (const kw of movie.keywords.keywords) {
                const found = MEGA_COLLECTIONS.find(
                    (mc) => mc.keywordId === Number(kw.id) || mc.name.toLowerCase() === kw.name.toLowerCase()
                );
                if (found) {
                    franchiseMatch = found;
                    break;
                }
            }
        }

        if (franchiseMatch) {
            log(`[TMDB - Related] Detected mega-collection franchise: "${franchiseMatch.name}"`);
            const targetDate = movie.release_date;
            const neighbors = await getFranchiseNeighbors(franchiseMatch.keywordId, key, reqConfig, targetDate);
            prequel = neighbors.prequel;
            sequel = neighbors.sequel;

            collectionName = franchiseMatch.name;
            collectionUrl = `https://www.themoviedb.org/keyword/${franchiseMatch.keywordId}`;
        } else if (movie.belongs_to_collection) {
            const collectionId = movie.belongs_to_collection.id;
            collectionName = movie.belongs_to_collection.name;
            log(
                `[TMDB - Related] Belongs to collection: "${movie.belongs_to_collection.name}" (ID: ${collectionId}). Fetching collection details...`
            );
            const collectionRes = await axiosInstance.get(
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
            collectionName,
            collectionUrl: collectionUrl || `https://www.themoviedb.org/movie/${tmdbId}`,
        };
    } catch (e) {
        if (!isCancel(e)) {
            error(`[TMDB Error - Related] ${sanitizeError(e.message)}`);
        }
        return null;
    }
}

const MEGA_COLLECTIONS = [
    {
        keywordId: 180547,
        name: 'Marvel Cinematic Universe (MCU)',
    },
    {
        keywordId: 312528,
        name: 'DC Universe (DCU)',
    },
    {
        keywordId: 229269,
        name: 'DC Extended Universe (DCEU)',
    },
    {
        keywordId: 290702,
        name: "Sony's Spider-Man Universe (SSU)",
    },
    {
        keywordId: 372735,
        name: 'Star Wars Universe',
    },
    {
        keywordId: 327763,
        name: 'Star Trek Universe',
    },
    {
        keywordId: 253163,
        name: 'Wizarding World',
    },
    {
        keywordId: 261449,
        name: 'The MonsterVerse',
    },
    {
        keywordId: 229156,
        name: 'X-Men Cinematic Universe',
    },
    {
        keywordId: 228795,
        name: 'The Conjuring Universe',
    },
    {
        keywordId: 313881,
        name: 'Spider-Man Expanded Universe',
    },
    {
        keywordId: 295415,
        name: "Tolkien's Middle-Earth",
    },
    {
        keywordId: 246473,
        name: 'Alien & Predator (AVP)',
    },
    {
        keywordId: 297486,
        name: 'The Walking Dead Universe',
    },
    {
        keywordId: 335022,
        name: 'Doctor Who Universe',
    },
];

const BLACKLIST_PATTERNS = [
    /one-shot/i,
    /team thor/i,
    /team darryl/i,
    /holiday special/i,
    /groot/i,
    /magnum opus/i,
    /assembling a universe/i,
    /lego/i,
];

function isMainMovie(title) {
    return !BLACKLIST_PATTERNS.some((pattern) => pattern.test(title));
}

async function getFranchiseNeighbors(keywordId, apiKey, reqConfig, targetReleaseDate) {
    let prequel = null;
    let sequel = null;
    try {
        if (!targetReleaseDate) {
            return { prequel, sequel };
        }

        // Prequel: strictly earlier release date, sorted desc
        const preRes = axiosInstance
            .get(
                `https://api.themoviedb.org/3/discover/movie?with_keywords=${keywordId}&primary_release_date.lt=${targetReleaseDate}&sort_by=primary_release_date.desc&page=1&vote_count.gte=100&api_key=${encodeURIComponent(apiKey)}`,
                reqConfig
            )
            .catch(() => null);

        // Sequel: strictly later release date, sorted asc
        const seqRes = axiosInstance
            .get(
                `https://api.themoviedb.org/3/discover/movie?with_keywords=${keywordId}&primary_release_date.gt=${targetReleaseDate}&sort_by=primary_release_date.asc&page=1&vote_count.gte=100&api_key=${encodeURIComponent(apiKey)}`,
                reqConfig
            )
            .catch(() => null);

        const [pre, seq] = await Promise.all([preRes, seqRes]);

        if (pre && pre.data && pre.data.results) {
            prequel = pre.data.results.find((m) => isMainMovie(m.title)) || null;
        }

        if (seq && seq.data && seq.data.results) {
            sequel = seq.data.results.find((m) => isMainMovie(m.title)) || null;
        }
    } catch (err) {
        error(`[TMDB - Franchise Warning] Neighbor discover failed for keyword ID ${keywordId}: ${err.message}`);
    }
    return { prequel, sequel };
}

module.exports = {
    checkTmdb,
    getRelatedMovies,
};
