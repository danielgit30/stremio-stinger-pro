const { MAX_CACHE_SIZE } = require('../config');

class MemoryCache {
    constructor() {
        this._cache = new Map();
    }

    prune() {
        const now = Date.now();
        for (const [key, value] of this._cache.entries()) {
            if (value && value.expiresAt && now > value.expiresAt) {
                this._cache.delete(key);
            }
        }
    }

    has(key) {
        return this._cache.has(key);
    }

    get(key) {
        const value = this._cache.get(key);
        if (value) {
            // Convert FIFO to LRU by deleting and re-inserting
            this._cache.delete(key);
            this._cache.set(key, value);
        }
        return value;
    }

    delete(key) {
        return this._cache.delete(key);
    }

    set(key, value) {
        const existed = this._cache.delete(key);
        if (!existed && this._cache.size >= MAX_CACHE_SIZE) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }
        this._cache.set(key, value);
    }
}

const streamCache = new MemoryCache();
const cinemetaCache = new MemoryCache();
const rawScraperCache = new MemoryCache();

const gcInterval = setInterval(
    () => {
        streamCache.prune();
        cinemetaCache.prune();
        rawScraperCache.prune();
    },
    10 * 60 * 1000
); // 10 minutes
gcInterval.unref();

module.exports = {
    streamCache,
    cinemetaCache,
    rawScraperCache,
};
