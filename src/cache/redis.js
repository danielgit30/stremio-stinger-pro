const { createClient } = require('redis');

let redisClient;
let useRedis = false;

// Initialize Redis if URL is provided
if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    
    redisClient.connect()
        .then(() => {
            console.log('[System] Redis distributed cache connected.');
            useRedis = true;
        })
        .catch((err) => console.error('Failed to connect to Redis', err));
}

const getCache = async (key) => {
    if (useRedis) {
        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Redis get error', e);
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
            console.error('Redis set error', e);
        }
    }
};


module.exports = {
    getCache,
    setCache,
    isRedisEnabled: () => useRedis
};
