const { createClient } = require('redis');
const { sanitizeError } = require('../utils/network');
const { log } = require('../utils/logger');

let redisClient;
let useRedis = false;

// Initialize Redis if URL is provided
if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error', sanitizeError(err.message || err)));

    redisClient
        .connect()
        .then(() => {
            log('[System] Redis distributed cache connected.');
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

const quitRedis = async () => {
    if (useRedis && redisClient) {
        try {
            await redisClient.quit();
            log('[System] Redis client disconnected gracefully.');
        } catch (e) {
            console.error('Redis quit error', sanitizeError(e.message || e));
        }
    }
};

const incrementRateLimit = async (key, ttlSeconds) => {
    if (useRedis) {
        try {
            const multi = redisClient.multi();
            multi.incr(key);
            multi.pttl(key);
            const results = await multi.exec();

            const count = results[0];
            let pttl = results[1];

            // If key has no expiration (-1) or didn't exist (-2) before incr
            // set the expiration
            if (pttl === -1 || pttl === -2) {
                await redisClient.expire(key, ttlSeconds);
                pttl = ttlSeconds * 1000;
            }

            return { count, pttl };
        } catch (e) {
            console.error('Redis incr error', sanitizeError(e.message || e));
            return null;
        }
    }
    return null;
};

module.exports = {
    getCache,
    setCache,
    isRedisEnabled: () => useRedis,
    quitRedis,
    incrementRateLimit,
};
