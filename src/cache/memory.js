const { LRUCache } = require('lru-cache');
const { MAX_CACHE_SIZE, CACHE_TTL_SUCCESS } = require('../config');

class MemoryCacheWrapper {
    constructor(defaultTtlMs) {
        this.cache = new LRUCache({
            max: MAX_CACHE_SIZE,
            ttl: defaultTtlMs,
            updateAgeOnGet: true, // Equivalent to the LRU refresh behavior
        });
    }

    has(key) {
        return this.cache.has(key);
    }

    get(key) {
        return this.cache.get(key);
    }

    delete(key) {
        return this.cache.delete(key);
    }

    set(key, value) {
        let itemTtl = undefined;
        if (value && value.expiresAt) {
            itemTtl = Math.max(1, value.expiresAt - Date.now());
        }
        this.cache.set(key, value, { ttl: itemTtl });
    }
}

const streamCache = new MemoryCacheWrapper(CACHE_TTL_SUCCESS);
const cinemetaCache = new MemoryCacheWrapper(CACHE_TTL_SUCCESS);
const rawScraperCache = new MemoryCacheWrapper(CACHE_TTL_SUCCESS);

module.exports = {
    streamCache,
    cinemetaCache,
    rawScraperCache,
};
