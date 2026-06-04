const { createClient } = require('redis');
const { sanitizeError } = require('../utils/network');
const { log, warn, error } = require('../utils/logger');

let redisClient;
let useRedis = false;

// Initialize Redis if URL is provided and not in a test environment
const luaScript = `
    local current = redis.call('INCR', KEYS[1])
    local pttl = redis.call('PTTL', KEYS[1])
    if pttl < 0 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
        pttl = tonumber(ARGV[1]) * 1000
    end
    return {current, pttl}
`;
let rateLimitSha = null;

if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
    redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    warn('[System] Redis reconnect limits reached. Falling back to memory cache entirely.');
                    useRedis = false;
                    return new Error('Redis reconnect limits reached');
                }
                return Math.min(retries * 50, 2000);
            },
        },
    });
    redisClient.on('error', (err) => {
        if (redisClient.isOpen) {
            error('Redis Client Error', sanitizeError(err.message || err));
        }
    });

    redisClient
        .connect()
        .then(async () => {
            if (redisClient.isOpen) {
                log('[System] Redis distributed cache connected.');
                useRedis = true;
                try {
                    rateLimitSha = await redisClient.sendCommand(['SCRIPT', 'LOAD', luaScript]);
                    log('[System] Redis rate limit script loaded into cache.');
                } catch (e) {
                    warn(
                        '[System] Failed to load Lua script into Redis, falling back to EVAL',
                        sanitizeError(e.message || e)
                    );
                }
            }
        })
        .catch((err) => {
            error('Failed to connect to Redis', sanitizeError(err.message || err));
        });
}

const withTimeout = (promise, timeoutMs = 500) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Redis operation timed out')), timeoutMs);
    });
    return Promise.race([
        promise.then(
            (val) => {
                clearTimeout(timeoutId);
                return val;
            },
            (err) => {
                clearTimeout(timeoutId);
                throw err;
            }
        ),
        timeoutPromise,
    ]);
};

const getCache = async (key) => {
    if (useRedis) {
        try {
            const data = await withTimeout(redisClient.get(key), 500);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            error('Redis get error', sanitizeError(e.message || e));
            return null;
        }
    }
    // Fallback to memory cache logic will be handled in the orchestrator
    return null;
};

const setCache = async (key, value, ttlSeconds) => {
    if (useRedis) {
        try {
            await withTimeout(redisClient.setEx(key, ttlSeconds, JSON.stringify(value)), 500);
        } catch (e) {
            error('Redis set error', sanitizeError(e.message || e));
        }
    }
};

const quitRedis = async () => {
    if (redisClient) {
        try {
            await withTimeout(redisClient.disconnect(), 1000);
            log('[System] Redis client disconnected.');
        } catch (e) {
            error('Redis disconnect error', sanitizeError(e.message || e));
        } finally {
            useRedis = false;
        }
    }
};

const incrementRateLimit = async (key, ttlSeconds) => {
    if (useRedis) {
        try {
            let results;
            if (rateLimitSha) {
                results = await withTimeout(
                    redisClient.sendCommand(['EVALSHA', rateLimitSha, '1', key, String(ttlSeconds)]),
                    500
                );
            } else {
                results = await withTimeout(
                    redisClient.eval(luaScript, {
                        keys: [key],
                        arguments: [String(ttlSeconds)],
                    }),
                    500
                );
            }

            const count = results[0];
            const pttl = results[1];

            return { count, pttl };
        } catch (e) {
            // If EVALSHA fails because script is flushed, reset SHA and fallback to EVAL next time
            if (e.message && e.message.includes('NOSCRIPT')) {
                rateLimitSha = null;
                warn('Redis NOSCRIPT error, clearing SHA cache to reload next time');
            } else {
                error('Redis incr error', sanitizeError(e.message || e));
            }
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
