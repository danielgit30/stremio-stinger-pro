const { MAX_CACHE_SIZE } = require('../config');

class MemoryCache {
    constructor() {
        this._cache = new Map();
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
        if (this._cache.size >= MAX_CACHE_SIZE) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }
        this._cache.set(key, value);
    }
}

const streamCache = new MemoryCache();

module.exports = {
    streamCache,
};
