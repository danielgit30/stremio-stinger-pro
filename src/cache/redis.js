const { createClient } = require('redis');
const { sanitizeError } = require('../utils/network');
const { log } = require('../utils/logger');

let redisClient;
let useRedis = false;

// Initialize Redis if URL is provided
if (process.env.REDIS_URL) {
    redisClient = createClient({ 
        url: process.env.REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    console.warn('[System] Redis reconnect limits reached. Falling back to memory cache entirely.');
                    useRedis = false;
                    return new Error('Redis reconnect limits reached');
                }
                return Math.min(retries * 50, 2000);
            }
        }
    });
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
            const luaScript = `
                local current = redis.call('INCR', KEYS[1])
                local pttl = redis.call('PTTL', KEYS[1])
                if pttl < 0 then
                    redis.call('EXPIRE', KEYS[1], ARGV[1])
                    pttl = tonumber(ARGV[1]) * 1000
                end
                return {current, pttl}
            `;
            const results = await redisClient.eval(luaScript, {
                keys: [key],
                arguments: [String(ttlSeconds)],
            });

            const count = results[0];
            const pttl = results[1];

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
