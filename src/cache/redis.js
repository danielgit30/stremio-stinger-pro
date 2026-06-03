const { createClient } = require('redis');
const { sanitizeError } = require('../utils/network');

let redisClient;
let useRedis = false;

// Initialize Redis if URL is provided
if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error', sanitizeError(err.message || err)));

    redisClient
        .connect()
        .then(() => {
            console.log('[System] Redis distributed cache connected.');
            useRedis = true;
        })
        .catch((err) => console.error('Failed to connect to Redis', sanitizeError(err.message || err)));
}

const getCache = async (key) => {
    if (useRedis) {
        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Redis get error', sanitizeError(e.message || e));
            return null;
        }
    }
    // Fallback to memory cache logic will be handled in the orchestrator
    return null;
};

const setCache = async (key, value, ttlSeconds) => {
    if (useRedis) {
        try {
            await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
        } catch (e) {
            console.error('Redis set error', sanitizeError(e.message || e));
        }
    }
};

module.exports = {
    getCache,
    setCache,
    isRedisEnabled: () => useRedis,
};
