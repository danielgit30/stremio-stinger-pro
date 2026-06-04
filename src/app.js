const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } = require('./config');
const { sanitizeError } = require('./utils/network');
const { incrementRateLimit, isRedisEnabled } = require('./cache/redis');
const { manifestHandler } = require('./routes/manifest');
const { streamHandler } = require('./routes/stream');
const { serveConfig } = require('./routes/ui');

const app = express();

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' https://github.com https://raw.githubusercontent.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
    );
    next();
});

app.set('trust proxy', 1);

// Rate Limiting
const rateLimitMap = new Map();

const applyLocalRateLimit = (ip, now) => {
    const clientData = rateLimitMap.get(ip) || { count: 0, startTime: now };

    if (now - clientData.startTime > RATE_LIMIT_WINDOW_MS) {
        clientData.count = 1;
        clientData.startTime = now;
    } else {
        clientData.count++;
    }

    const hasIp = rateLimitMap.delete(ip);
    if (rateLimitMap.size >= 5000 && !hasIp) {
        const firstKey = rateLimitMap.keys().next().value;
        rateLimitMap.delete(firstKey);
    }
    rateLimitMap.set(ip, clientData);

    return {
        currentCount: clientData.count,
        resetTimeRemainingMs: Math.max(0, clientData.startTime + RATE_LIMIT_WINDOW_MS - now),
    };
};

const rateLimiter = async (req, res, next) => {
    try {
        const ip = req.ip;
        if (!ip) return next();

        const now = Date.now();
        let currentCount = 0;
        let resetTimeRemainingMs = 0;

        if (isRedisEnabled()) {
            const redisKey = `ratelimit_${ip}`;
            const windowSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);

            const result = await incrementRateLimit(redisKey, windowSeconds);
            if (result !== null) {
                currentCount = result.count;
                resetTimeRemainingMs = result.pttl;
            } else {
                const localRes = applyLocalRateLimit(ip, now);
                currentCount = localRes.currentCount;
                resetTimeRemainingMs = localRes.resetTimeRemainingMs;
            }
        } else {
            const localRes = applyLocalRateLimit(ip, now);
            currentCount = localRes.currentCount;
            resetTimeRemainingMs = localRes.resetTimeRemainingMs;
        }

        const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - currentCount);
        const resetTimeSec = Math.ceil((now + resetTimeRemainingMs) / 1000);

        res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTimeSec);

        if (currentCount > RATE_LIMIT_MAX_REQUESTS) {
            console.warn(`[Security] Rate limit exceeded for IP: ${sanitizeError(ip)}`);
            const retryAfterSec = Math.ceil(resetTimeRemainingMs / 1000);
            res.setHeader('Retry-After', retryAfterSec > 0 ? retryAfterSec : Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
            return res.status(429).json({ error: 'Too many requests, please try again later.' });
        }

        next();
    } catch (e) {
        console.error('Rate limiter error', sanitizeError(e.message || e));
        next();
    }
};

// Redirect icon/favicon to GitHub CDN with aggressive caching to eliminate egress
app.get(['/icon.png', '/favicon.ico'], (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.redirect(301, 'https://raw.githubusercontent.com/schultz911/stremio-stinger-pro/main/public/icon.png');
});

// Static files
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1d', etag: true, lastModified: true }));

// Routes
app.get('/', serveConfig);
app.get('/configure', serveConfig);

app.get('/manifest.json', manifestHandler);
app.get('/:p1/manifest.json', manifestHandler);
app.get('/:style/:apiKey/manifest.json', manifestHandler);

app.get('/stream/:type/:id.json', rateLimiter, streamHandler);
app.get('/:p1/stream/:type/:id.json', rateLimiter, streamHandler);
app.get('/:style/:apiKey/stream/:type/:id.json', rateLimiter, streamHandler);

// Global Error Boundary
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(
        `[System Error] ${sanitizeError(err.message)}`,
        err.stack ? `\nStack: ${sanitizeError(err.stack)}` : ''
    );
    res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred.' });
});

module.exports = app;
